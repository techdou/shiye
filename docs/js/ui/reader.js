// 拾页 · 阅读器
// 全屏 overlay：HTML / Markdown / 图片 / 网页收藏 的统一阅读界面
// Markdown 渲染在隔离 iframe 内进行（内核加载自 /vendor，管线见 js/render/md-view.js）

import * as store from '../store.js';

let current = null;        // 当前阅读的条目
let editing = false;       // MD 编辑模式
let mdBlobUrls = [];       // 相对图片 blob URL，关闭时回收
let mdFrameEl = null;      // MD 渲染 iframe

const el = {};

function q(sel) { return document.querySelector(sel); }

export function initReader() {
  el.reader = q('#reader');
  el.bar = q('#reader-bar');
  el.back = q('#reader-back');
  el.title = q('#reader-title');
  el.actions = q('#reader-actions');
  el.stage = q('#reader-stage');

  el.back.addEventListener('click', close);
  // 主题切换时重渲染正在阅读的 MD（iframe 主题在渲染时固化，收不到 CSS 变量更新）
  document.addEventListener('themechanged', () => {
    if (isOpen() && current && current.type === 'MD' && !editing) render();
  });
}

export function isOpen() { return !el.reader.classList.contains('hidden'); }

export async function open(id) {
  const item = store.getItem(id);
  if (!item) return;
  if (item.type === 'FOLDER') { store.navigate(id); return; }
  current = item;
  editing = false;
  store.touch(id);
  el.reader.classList.remove('hidden');
  document.body.classList.add('noscroll');
  render();
  history.pushState({ reader: true }, '');
}

export function close() {
  if (editing && !confirm('放弃未保存的修改？')) return;
  current = null;
  editing = false;
  el.reader.classList.add('hidden');
  document.body.classList.remove('noscroll');
  el.stage.innerHTML = '';
  releaseBlobs();
  if (history.state && history.state.reader) history.back();
}

window.addEventListener('popstate', () => {
  if (!isOpen()) return;
  // 编辑态按返回：先确认再放行；取消则推回一条历史占位，让阅读器维持打开
  if (editing) {
    history.pushState({ reader: true }, '');
    if (window.confirm('放弃未保存的修改？')) closeSilent();
    return;
  }
  if (!history.state || !history.state.reader) closeSilent();
});

function closeSilent() {
  current = null;
  editing = false;
  el.reader.classList.add('hidden');
  document.body.classList.remove('noscroll');
  el.stage.innerHTML = '';
  releaseBlobs();
}

function releaseBlobs() {
  mdBlobUrls.forEach(u => URL.revokeObjectURL(u));
  mdBlobUrls = [];
  mdFrameEl = null;
}

function setTitle(t) { el.title.textContent = t || ''; }

function actionBtn(label, icon, fn, primary) {
  const b = document.createElement('button');
  b.className = 'icon-btn' + (primary ? ' primary' : '');
  b.title = label;
  b.innerHTML = icon;
  b.addEventListener('click', fn);
  return b;
}

const ICONS = {
  edit: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
  save: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.3"/><path d="M21 3v6h-6"/></svg>',
  external: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
};

function render() {
  el.actions.innerHTML = '';
  el.stage.innerHTML = '';
  releaseBlobs();
  const it = current;
  if (!it) return;

  if (editing) { renderMdEditor(it); return; }

  if (it.type === 'MD') {
    setTitle(it.name.replace(/\.(md|markdown)$/i, ''));
    el.actions.appendChild(actionBtn('编辑', ICONS.edit, () => { editing = true; render(); }));
    renderMdFrame(it);
  } else if (it.type === 'HTML') {
    setTitle(it.name.replace(/\.html?$/i, ''));
    const blob = new Blob([it.content], { type: 'text/html;charset=utf-8' });
    mdBlobUrls.push(URL.createObjectURL(blob));
    el.actions.appendChild(actionBtn('刷新', ICONS.refresh, () => render()));
    el.actions.appendChild(actionBtn('浏览器打开', ICONS.external, () => openExternal(blobUrl)));
    appendFrame(mdBlobUrls[0], 'html');
  } else if (it.type === 'IMAGE') {
    setTitle(it.name);
    renderImageFrame(it);
  } else if (it.type === 'BOOKMARK') {
    setTitle(it.name);
    el.actions.appendChild(actionBtn('刷新', ICONS.refresh, () => render()));
    el.actions.appendChild(actionBtn('浏览器打开', ICONS.external, () => openExternal(it.url)));
    appendFrame(it.url, 'web');
  }
}

function openExternal(url) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.click();
}

function appendFrame(src, kind) {
  const frame = document.createElement('iframe');
  frame.className = 'reader-frame' + (kind === 'web' ? ' web' : '');
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads');
  frame.referrerPolicy = 'no-referrer-when-downgrade';
  frame.src = src;
  frame.addEventListener('load', () => frame.classList.add('loaded'));
  el.stage.appendChild(frame);
}

// 图片查看：深色中性底 + 居中适配，避免大图从左上角原尺寸溢出
function renderImageFrame(it) {
  const url = URL.createObjectURL(it.content);
  mdBlobUrls.push(url);
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    'html,body{margin:0;height:100%;background:#161410;display:flex;align-items:center;justify-content:center}' +
    'img{max-width:100%;max-height:100%;object-fit:contain}' +
    '</style></head><body><img src="' + url + '" alt=""></body></html>';
  const pageUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  mdBlobUrls.push(pageUrl);
  appendFrame(pageUrl, 'image');
}

// ---------- Markdown 渲染（iframe 隔离） ----------

function renderMdFrame(it) {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  const text = resolveRelativeImages(String(it.content || ''), it.parentId);
  // 相对路径：srcdoc 以父页面 URL 为 base，根部署/子路径部署通吃
  const hljsCss = theme === 'dark' ? 'vendor/highlight-github-dark.min.css' : 'vendor/highlight-github.min.css';

  const doc = [
    '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<link rel="stylesheet" href="vendor/katex/katex.min.css">',
    '<link rel="stylesheet" href="' + hljsCss + '">',
    '<style>' + MD_CSS + '</style>',
    '</head><body data-theme="' + theme + '">',
    '<article id="content" class="markdown-body"></article>',
    '<script src="vendor/marked.min.js"><\/script>',
    '<script src="vendor/highlight.min.js"><\/script>',
    '<script src="vendor/katex/katex.min.js"><\/script>',
    '<script src="vendor/katex/auto-render.min.js"><\/script>',
    '<script src="js/render/md-view.js"><\/script>',
    '<script>renderMD(decodeURIComponent("' + encodeURIComponent(text) + '"));<\/script>',
    '</body></html>',
  ].join('');

  const frame = document.createElement('iframe');
  frame.className = 'reader-frame md';
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  mdFrameEl = frame;
  frame.srcdoc = doc;
  frame.addEventListener('load', () => frame.classList.add('loaded'));
  el.stage.appendChild(frame);
}

// 同文件夹相对图片 → blob URL（讲义 md 与图片成批导入的场景）
function resolveRelativeImages(text, parentId) {
  if (!parentId) return text;
  const siblings = store.children(parentId).filter(x => x.type === 'IMAGE');
  if (!siblings.length) return text;
  const pick = (raw) => {
    let p = raw.trim();
    try { p = decodeURIComponent(p.split('#')[0].split('?')[0]); } catch (e) { return null; }
    p = p.replace(/^\.\//, '').replace(/^\/+/, '');
    const hit = siblings.find(s => s.name === p || s.name.endsWith('/' + p));
    return hit ? URL.createObjectURL(hit.content) : null;
  };
  // Markdown 图片
  text = text.replace(/(!\[[^\]]*\]\()([^)\s]+)([^)]*\))/g, (m, pre, url, post) => {
    if (/^[a-z]+:\/\//i.test(url)) return m;
    const u = pick(url);
    if (u) { mdBlobUrls.push(u); return pre + u + post; }
    return m;
  });
  // HTML <img>（md 允许内嵌 html）
  text = text.replace(/(<img\b[^>]*\bsrc=)(["'])([^"']+)\2/gi, (m, pre, q, url) => {
    if (/^[a-z]+:\/\//i.test(url) || url.startsWith('data:')) return m;
    const u = pick(url);
    if (u) { mdBlobUrls.push(u); return pre + q + u + q; }
    return m;
  });
  return text;
}

// ---------- Markdown 编辑器 ----------

const TOOL_ITEMS = [
  { label: 'H2', text: '## ' },
  { label: 'B', text: '**加粗**', wrap: 2 },
  { label: '引用', text: '> ' },
  { label: '列表', text: '- ' },
  { label: '代码', text: '```\n\n```', caret: 4 },
  { label: '链接', text: '[标题](https://)' },
  { label: '公式', text: '$$\n\n$$', caret: 3 },
];

function renderMdEditor(it) {
  setTitle(it.name);
  el.actions.appendChild(actionBtn('放弃', ICONS.close, () => { editing = false; render(); }));
  el.actions.appendChild(actionBtn('保存', ICONS.save, saveMd, true));

  const wrap = document.createElement('div');
  wrap.className = 'md-editor';
  const tools = document.createElement('div');
  tools.className = 'md-tools';
  TOOL_ITEMS.forEach(t => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = t.label;
    b.addEventListener('click', () => insertAt(t, ta));
    tools.appendChild(b);
  });
  const ta = document.createElement('textarea');
  ta.value = it.content || '';
  ta.spellcheck = false;
  ta.placeholder = '# 标题\n\n正文……';
  wrap.appendChild(tools);
  wrap.appendChild(ta);
  el.stage.appendChild(wrap);

  async function doSave() {
    const text = ta.value;
    await store.updateContent(current.id, text);
    current = store.getItem(current.id);
    editing = false;
    render();
    window.showToast && window.showToast('已保存');
  }
  function saveMd() { doSave(); }
}

function insertAt(t, ta) {
  const s = ta.selectionStart, e = ta.selectionEnd;
  const v = ta.value;
  let insert = t.text, caret = null;
  if (t.wrap != null && e > s) {
    insert = t.text.slice(0, t.wrap) + v.slice(s, e) + t.text.slice(t.wrap);
  } else if (t.caret != null) {
    caret = s + t.caret;
  } else if (t.wrap != null) {
    caret = s + t.wrap;
  }
  ta.value = v.slice(0, s) + insert + v.slice(e);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = caret != null ? caret : s + insert.length;
}

// ---------- MD 阅读样式（注入 iframe，与拾页纸感一致） ----------

const MD_CSS = `
:root { --paper:#faf8f2; --ink:#28241d; --muted:#8a8375; --line:#e7e1d2; --accent:#c4522f;
        --code-bg:#f1ede2; --quote-bg:#f6f2e8; }
[data-theme="dark"] { --paper:#171410; --ink:#e9e3d6; --muted:#96907f; --line:#2e2a22;
        --accent:#e0764f; --code-bg:#211d16; --quote-bg:#1e1a14; }
* { box-sizing:border-box; }
::-webkit-scrollbar { width:5px; height:5px; }
::-webkit-scrollbar-thumb { background:var(--muted); background:color-mix(in srgb,var(--muted) 40%,transparent); border-radius:3px; }
::-webkit-scrollbar-track { background:transparent; }
html,body { margin:0; padding:0; background:var(--paper); scrollbar-width:thin; scrollbar-color:var(--muted) transparent; scrollbar-color:color-mix(in srgb,var(--muted) 40%,transparent) transparent; }
body { color:var(--ink); font:16px/1.85 -apple-system,"PingFang SC","HarmonyOS Sans SC","Microsoft YaHei",sans-serif;
       -webkit-text-size-adjust:100%; overflow-wrap:break-word; }
.markdown-body { max-width:44rem; margin:0 auto; padding:20px 20px 64px; }
.markdown-body h1,.markdown-body h2,.markdown-body h3,.markdown-body h4 { line-height:1.4; margin:1.6em 0 .7em; font-weight:650; }
.markdown-body h1 { font-size:1.65em; padding-bottom:.35em; border-bottom:1px solid var(--line); }
.markdown-body h2 { font-size:1.35em; padding-bottom:.3em; border-bottom:1px solid var(--line); }
.markdown-body h3 { font-size:1.15em; }
.markdown-body h4 { font-size:1.02em; }
.markdown-body p { margin:.85em 0; }
.markdown-body a { color:var(--accent); text-decoration:none; border-bottom:1px solid var(--accent); border-bottom-color:color-mix(in srgb,var(--accent) 40%,transparent); }
.markdown-body strong { font-weight:650; }
.markdown-body img { max-width:100%; border-radius:8px; }
.markdown-body hr { border:0; border-top:1px solid var(--line); margin:2em 0; }
.markdown-body blockquote { margin:1.1em 0; padding:.6em 1.1em; color:var(--muted);
  background:var(--quote-bg); border-left:3px solid var(--accent); border-radius:0 8px 8px 0; }
.markdown-body blockquote p { margin:.3em 0; }
.markdown-body code { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:.88em;
  background:var(--code-bg); padding:.15em .45em; border-radius:5px; }
.markdown-body pre { background:var(--code-bg); border:1px solid var(--line); border-radius:10px;
  padding:1em 1.1em; overflow-x:auto; line-height:1.6; }
.markdown-body pre code { background:none; padding:0; font-size:.86em; }
.markdown-body table { border-collapse:collapse; width:100%; margin:1.2em 0; display:block; overflow-x:auto; }
.markdown-body th,.markdown-body td { border:1px solid var(--line); padding:.5em .85em; }
.markdown-body th { background:var(--quote-bg); font-weight:600; }
.markdown-body ul.task-list { list-style:none; padding-left:1.2em; }
.markdown-body li.task-item { margin:.3em 0; }
.markdown-body li.task-item input[type=checkbox] { margin-right:.45em; accent-color:var(--accent); }
.markdown-body .katex { font-size:1.1em; }
.markdown-body .katex-display { margin:16px 0; overflow-x:auto; overflow-y:hidden; padding:4px 0; }
.markdown-body .mermaid { text-align:center; margin:1.4em 0; overflow-x:auto; }
.markdown-body .mermaid svg { max-width:100%; height:auto; }
`;
