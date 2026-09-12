// 拾页 · 浮层面板
// bottom sheet 通用组件 + 添加/操作/移动/输入/确认/toast

import * as store from '../store.js';
import * as reader from './reader.js';

const ICONS = {
  import: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>',
  folder: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
  link: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  rename: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
  move: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6-6 6 6 6"/><path d="m15 6 6 6-6 6"/><path d="M9 18h6"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/></svg>',
};

export function toast(msg) {
  let t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}
window.showToast = toast;

// ---------- 通用 bottom sheet ----------

let activeSheet = null;

export function showSheet(title, contentEl, opts = {}) {
  hideSheet();
  const mask = document.createElement('div');
  mask.className = 'sheet-mask';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  if (title) {
    const h = document.createElement('div');
    h.className = 'sheet-title';
    h.textContent = title;
    sheet.appendChild(h);
  }
  sheet.appendChild(contentEl);
  mask.appendChild(sheet);
  document.body.appendChild(mask);
  requestAnimationFrame(() => mask.classList.add('open'));
  mask.addEventListener('click', (e) => { if (e.target === mask && !opts.locked) hideSheet(); });
  activeSheet = mask;
  return { mask, sheet, close: hideSheet };
}

export function hideSheet() {
  if (!activeSheet) return;
  const m = activeSheet;
  activeSheet = null;
  m.classList.remove('open');
  setTimeout(() => m.remove(), 240);
}

// ---------- 输入框（替代 window.prompt） ----------

export function promptSheet({ title, value = '', placeholder = '', okText = '确定', multiline = false }) {
  return new Promise((resolve) => {
    const box = document.createElement('div');
    box.className = 'prompt-box';
    const input = multiline ? document.createElement('textarea') : document.createElement('input');
    if (!multiline) { input.type = 'text'; input.enterKeyHint = 'done'; }
    input.value = value;
    input.placeholder = placeholder;
    input.className = 'prompt-input';
    box.appendChild(input);
    const row = document.createElement('div');
    row.className = 'btn-row';
    const cancel = document.createElement('button');
    cancel.className = 'btn ghost'; cancel.textContent = '取消';
    const ok = document.createElement('button');
    ok.className = 'btn solid'; ok.textContent = okText;
    row.appendChild(cancel); row.appendChild(ok);
    box.appendChild(row);
    showSheet(title, box);

    const done = (val) => { hideSheet(); resolve(val); };
    cancel.addEventListener('click', () => done(null));
    ok.addEventListener('click', () => done(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !multiline) done(input.value);
    });
    setTimeout(() => input.focus(), 260);
  });
}

export function confirmSheet(message, danger = true) {
  return new Promise((resolve) => {
    const box = document.createElement('div');
    box.className = 'prompt-box';
    const p = document.createElement('p');
    p.className = 'confirm-text';
    p.textContent = message;
    box.appendChild(p);
    const row = document.createElement('div');
    row.className = 'btn-row';
    const cancel = document.createElement('button');
    cancel.className = 'btn ghost'; cancel.textContent = '取消';
    const ok = document.createElement('button');
    ok.className = 'btn' + (danger ? ' danger' : ' solid'); ok.textContent = '确定';
    row.appendChild(cancel); row.appendChild(ok);
    box.appendChild(row);
    showSheet('确认', box);
    cancel.addEventListener('click', () => { hideSheet(); resolve(false); });
    ok.addEventListener('click', () => { hideSheet(); resolve(true); });
  });
}

// ---------- 添加菜单 ----------

export function showAddSheet() {
  const box = document.createElement('div');
  box.className = 'add-menu';
  const mk = (icon, label, desc, fn) => {
    const b = document.createElement('button');
    b.className = 'add-item';
    b.innerHTML = `<span class="add-icon">${icon}</span><span class="add-text"><b>${label}</b><i>${desc}</i></span>`;
    b.addEventListener('click', fn);
    return b;
  };
  box.appendChild(mk(ICONS.import, '导入文件', 'HTML · Markdown · 图片', () => { hideSheet(); pickFiles(); }));
  box.appendChild(mk(ICONS.folder, '新建文件夹', '分类整理你的内容', async () => {
    hideSheet();
    const name = await promptSheet({ title: '新建文件夹', placeholder: '文件夹名称' });
    if (name == null) return;
    try { await store.createFolder(name); } catch (e) { toast(e.message); }
  }));
  box.appendChild(mk(ICONS.link, '收藏网页', '保存已上线的讲义地址', async () => {
    hideSheet();
    const url = await promptSheet({ title: '收藏网页', placeholder: '粘贴网址，如 shiye.example.com/lec3' });
    if (url == null) return;
    if (!url.trim()) { toast('网址不能为空'); return; }
    const name = await promptSheet({ title: '名称（可留空，默认用域名）', value: '', placeholder: '如：第 3 讲 · 积分学' });
    if (name == null) return;
    try { await store.addBookmark(url, name); toast('已收藏'); } catch (e) { toast(e.message); }
  }));
  showSheet('添加到当前文件夹', box);
}

let fileInput = null;
export function pickFiles() {
  if (!fileInput) {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = '.html,.htm,.md,.markdown,.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    fileInput.addEventListener('change', async () => {
      const files = fileInput.files;
      if (!files || !files.length) return;
      const r = await store.importFiles(files, (done, total) => {
        toast(`正在导入 ${done}/${total}…`);
      });
      if (r.imported) toast(`已导入 ${r.imported} 个文件` + (r.skipped.length ? `，跳过 ${r.skipped.length} 个不支持的` : ''));
      else toast('没有可导入的文件（支持 html/md/图片）');
      fileInput.value = '';
    });
  }
  fileInput.click();
}

// ---------- 条目操作菜单 ----------

export function showActionSheet(item) {
  const box = document.createElement('div');
  box.className = 'action-menu';
  const mk = (icon, label, fn, cls = '') => {
    const b = document.createElement('button');
    b.className = 'action-item ' + cls;
    b.innerHTML = `${icon}<span>${label}</span>`;
    b.addEventListener('click', fn);
    return b;
  };
  box.appendChild(mk(ICONS.rename, '重命名', async () => {
    hideSheet();
    const name = await promptSheet({ title: '重命名', value: item.name });
    if (name == null) return;
    try { await store.rename(item.id, name); } catch (e) { toast(e.message); }
  }));
  box.appendChild(mk(ICONS.move, '移动到…', () => { hideSheet(); showMovePicker(item); }));
  box.appendChild(mk(ICONS.trash, '删除', async () => {
    hideSheet();
    const n = store.subtreeIds(item.id).length;
    const ok = await confirmSheet(
      item.type === 'FOLDER' && n > 1
        ? `删除「${item.name}」及其中的 ${n - 1} 个内容？此操作不可恢复。`
        : `删除「${item.name}」？此操作不可恢复。`
    );
    if (ok) { await store.remove(item.id); toast('已删除'); }
  }, 'danger'));
  showSheet(item.name, box);
}

// ---------- 移动选择器 ----------

export function showMovePicker(item) {
  const box = document.createElement('div');
  box.className = 'move-picker';
  let cwd = store.getState().cwd;
  const crumb = document.createElement('div');
  crumb.className = 'move-crumb';
  const list = document.createElement('div');
  list.className = 'move-list';
  const foot = document.createElement('div');
  foot.className = 'btn-row';
  const okBtn = document.createElement('button');
  okBtn.className = 'btn solid';
  okBtn.textContent = '移动到此处';
  foot.appendChild(okBtn);
  box.appendChild(crumb); box.appendChild(list); box.appendChild(foot);

  const isSelfOrDesc = (fid) => fid === item.id || (item.type === 'FOLDER' && store.isDescendant(fid, item.id));

  function drawCwd() {
    const path = store.pathOf(cwd);
    crumb.innerHTML = '';
    const rootBtn = document.createElement('button');
    rootBtn.textContent = '全部';
    rootBtn.className = 'crumb-btn' + (cwd === null ? ' on' : '');
    rootBtn.addEventListener('click', () => { cwd = null; drawCwd(); });
    crumb.appendChild(rootBtn);
    path.forEach(p => {
      const b = document.createElement('button');
      b.textContent = p.name;
      b.className = 'crumb-btn' + (cwd === p.id ? ' on' : '');
      b.addEventListener('click', () => { cwd = p.id; drawCwd(); });
      crumb.appendChild(b);
    });
    list.innerHTML = '';
    const folders = store.children(cwd).filter(x => x.type === 'FOLDER');
    if (!folders.length) {
      const empty = document.createElement('div');
      empty.className = 'move-empty';
      empty.textContent = '此层没有子文件夹';
      list.appendChild(empty);
    }
    folders.forEach(f => {
      const row = document.createElement('button');
      row.className = 'move-row' + (isSelfOrDesc(f.id) ? ' disabled' : '');
      row.innerHTML = `${ICONS.folder}<span>${escapeHtml(f.name)}</span><i>›</i>`;
      if (!isSelfOrDesc(f.id)) row.addEventListener('click', () => { cwd = f.id; drawCwd(); });
      list.appendChild(row);
    });
  }

  okBtn.addEventListener('click', async () => {
    try {
      await store.move(item.id, cwd);
      hideSheet();
      toast(cwd === null ? '已移动到「全部」' : `已移动到「${store.getItem(cwd).name}」`);
    } catch (e) { toast(e.message); }
  });

  drawCwd();
  showSheet(`移动「${item.name}」`, box);
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ---------- 长按手势（绑定在列表容器上） ----------

export function bindLongPress(container, selector, onFire) {
  let timer = null, firedAt = 0, startX = 0, startY = 0;
  container.addEventListener('pointerdown', (e) => {
    const row = e.target.closest(selector);
    if (!row) return;
    firedAt = 0;
    startX = e.clientX; startY = e.clientY;
    timer = setTimeout(() => { firedAt = Date.now(); onFire(row.dataset.id, row); }, 480);
  });
  container.addEventListener('pointermove', (e) => {
    if (timer && (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10)) {
      clearTimeout(timer); timer = null;
    }
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
    container.addEventListener(ev, () => { clearTimeout(timer); timer = null; }));
  container.addEventListener('click', (e) => {
    // 长按后短时间窗内拦截紧随的 click；时间窗外不拦截，键盘触发的 click 不受影响
    if (firedAt && Date.now() - firedAt < 800) {
      e.stopPropagation(); e.preventDefault(); firedAt = 0;
    }
  }, true);
  container.addEventListener('contextmenu', (e) => {
    const row = e.target.closest(selector);
    if (row) { e.preventDefault(); onFire(row.dataset.id, row); }
  });
}
