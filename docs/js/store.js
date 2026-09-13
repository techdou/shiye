// 拾页 · 状态与业务操作
// 条目模型：{ id, type, name, parentId, content, url, size, createdAt, updatedAt, lastOpenedAt }
// type: FOLDER / HTML / MD / IMAGE / BOOKMARK
// parentId 为 null 表示根目录

import * as db from './db.js';

export const TYPES = { FOLDER: 'FOLDER', HTML: 'HTML', MD: 'MD', IMAGE: 'IMAGE', BOOKMARK: 'BOOKMARK' };

const state = {
  items: new Map(),      // id -> item
  cwd: null,             // 当前文件夹 id（null = 根目录）
  query: '',             // 搜索词（非空时进入全局搜索视图）
  seeded: false,
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit() { listeners.forEach(fn => fn()); }

export function getState() { return state; }

export function getItem(id) { return state.items.get(id) || null; }

export async function init() {
  const all = await db.getAllItems();
  all.forEach(it => state.items.set(it.id, it));
  // 播种只看标志：用户清空资料库后，示例内容不再复活
  const seeded = await db.getSetting('seeded', false);
  if (all.length === 0 && !seeded) {
    await seed();
    await db.setSetting('seeded', true);
  }
  emit();
}

// ---------- 派生查询 ----------

export function children(parentId) {
  const list = [];
  state.items.forEach(it => {
    if ((it.parentId ?? null) === (parentId ?? null)) list.push(it);
  });
  list.sort((a, b) => {
    if (a.type === 'FOLDER' && b.type !== 'FOLDER') return -1;
    if (b.type === 'FOLDER' && a.type !== 'FOLDER') return 1;
    return a.name.localeCompare(b.name, 'zh-Hans-CN');
  });
  return list;
}

// 当前位置面包屑：从根到 cwd
export function breadcrumb() {
  const path = [];
  let cur = state.cwd;
  while (cur) {
    const it = state.items.get(cur);
    if (!it) break;
    path.unshift(it);
    cur = it.parentId;
  }
  return path;
}

export function pathOf(id) {
  const path = [];
  let cur = state.items.get(id);
  while (cur) {
    path.unshift(cur);
    cur = cur.parentId ? state.items.get(cur.parentId) : null;
  }
  return path;
}

export function recents(limit = 6) {
  const list = [];
  state.items.forEach(it => {
    if (it.type !== 'FOLDER' && it.lastOpenedAt) list.push(it);
  });
  return list.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt).slice(0, limit);
}

export function searchAll(q) {
  const kw = q.trim().toLowerCase();
  if (!kw) return [];
  const list = [];
  state.items.forEach(it => {
    if (it.name.toLowerCase().includes(kw)) list.push(it);
  });
  return list
    .sort((a, b) => (a.type === 'FOLDER' ? -1 : 1) - (b.type === 'FOLDER' ? -1 : 1) || a.name.localeCompare(b.name, 'zh-Hans-CN'))
    .slice(0, 60);
}

// ---------- 写操作 ----------

function uid() { return crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2); }

export function uniqueName(parentId, name) {
  const siblings = children(parentId).map(it => it.name);
  if (!siblings.includes(name)) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let n = 2;
  while (siblings.includes(`${base} ${n}${ext}`)) n++;
  return `${base} ${n}${ext}`;
}

async function save(item) {
  state.items.set(item.id, item);
  await db.putItem(item);
}

export function navigate(folderId) { state.cwd = folderId; state.query = ''; emit(); }

export function setQuery(q) { state.query = q; emit(); }

export async function createFolder(name) {
  name = name.trim();
  if (!name) throw new Error('名称不能为空');
  const now = Date.now();
  const item = {
    id: uid(), type: TYPES.FOLDER, name: uniqueName(state.cwd, name),
    parentId: state.cwd, content: null, url: null, size: 0,
    createdAt: now, updatedAt: now, lastOpenedAt: null,
  };
  await save(item);
  emit();
  return item;
}

const EXT_MAP = {
  'html': TYPES.HTML, 'htm': TYPES.HTML,
  'md': TYPES.MD, 'markdown': TYPES.MD, 'txt': TYPES.MD,
  'png': TYPES.IMAGE, 'jpg': TYPES.IMAGE, 'jpeg': TYPES.IMAGE,
  'gif': TYPES.IMAGE, 'webp': TYPES.IMAGE, 'svg': TYPES.IMAGE, 'bmp': TYPES.IMAGE,
};

export function extOf(name) {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

export async function importFiles(fileList, onProgress) {
  const files = Array.from(fileList || []);
  const accepted = [], skipped = [];
  files.forEach(f => {
    const t = EXT_MAP[extOf(f.name)];
    if (t) accepted.push({ file: f, type: t });
    else skipped.push(f.name);
  });
  let done = 0;
  for (const { file, type } of accepted) {
    const now = Date.now();
    let content;
    if (type === TYPES.IMAGE) {
      content = file; // Blob
    } else {
      content = await file.text();
    }
    const item = {
      id: uid(), type, name: uniqueName(state.cwd, file.name),
      parentId: state.cwd, content, url: null, size: file.size,
      createdAt: now, updatedAt: now, lastOpenedAt: null,
    };
    await save(item);
    done++;
    if (onProgress) onProgress(done, accepted.length);
  }
  emit();
  return { imported: accepted.length, skipped };
}

export async function addBookmark(url, name) {
  url = url.trim();
  if (!url) throw new Error('网址不能为空');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = 'https://' + url;
  let host = url;
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { /* 保持原文 */ }
  if (!name || !name.trim()) name = host;
  const now = Date.now();
  const item = {
    id: uid(), type: TYPES.BOOKMARK, name: uniqueName(state.cwd, name.trim()),
    parentId: state.cwd, content: null, url, size: 0,
    createdAt: now, updatedAt: now, lastOpenedAt: null,
  };
  await save(item);
  emit();
  return item;
}

export async function rename(id, newName) {
  const it = state.items.get(id);
  if (!it) return;
  newName = newName.trim();
  if (!newName) throw new Error('名称不能为空');
  // 文件类条目：新名不带扩展名时自动补回原扩展名（类型由 type 字段驱动，扩展名只为导出/通用性）
  if (it.type === TYPES.HTML || it.type === TYPES.MD || it.type === TYPES.IMAGE) {
    const oldExt = extOf(it.name);
    if (oldExt && !newName.includes('.')) newName = `${newName}.${oldExt}`;
  }
  it.name = (it.type === 'FOLDER' || it.type === 'BOOKMARK')
    ? newName
    : uniqueNameExcept(id, it.parentId, newName);
  it.updatedAt = Date.now();
  await save(it);
  emit();
}

function uniqueNameExcept(selfId, parentId, name) {
  const siblings = children(parentId).filter(it => it.id !== selfId).map(it => it.name);
  if (!siblings.includes(name)) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let n = 2;
  while (siblings.includes(`${base} ${n}${ext}`)) n++;
  return `${base} ${n}${ext}`;
}

export function isDescendant(maybeChildId, ancestorId) {
  let cur = state.items.get(maybeChildId);
  while (cur && cur.parentId) {
    if (cur.parentId === ancestorId) return true;
    cur = state.items.get(cur.parentId);
  }
  return false;
}

export async function move(id, targetFolderId) {
  const it = state.items.get(id);
  if (!it) return;
  if (id === targetFolderId) throw new Error('不能移动到自身');
  if (it.type === 'FOLDER' && targetFolderId && isDescendant(targetFolderId, id)) {
    throw new Error('不能移动到自己的子文件夹');
  }
  it.parentId = targetFolderId ?? null;
  it.name = uniqueNameExcept(id, it.parentId, it.name);
  it.updatedAt = Date.now();
  await save(it);
  emit();
}

export async function remove(id) {
  const ids = subtreeIds(id);
  state.cwd = ids.includes(state.cwd) ? (getItem(id).parentId ?? null) : state.cwd;
  state.items.forEach((it, key) => { if (ids.includes(key)) state.items.delete(key); });
  await db.deleteItems(ids);
  emit();
}

export function subtreeIds(id) {
  const out = [id];
  const walk = (pid) => {
    state.items.forEach(it => {
      if (it.parentId === pid && !out.includes(it.id)) { out.push(it.id); walk(it.id); }
    });
  };
  const it = state.items.get(id);
  if (it && it.type === 'FOLDER') walk(id);
  return out;
}

export async function touch(id) {
  const it = state.items.get(id);
  if (!it) return;
  it.lastOpenedAt = Date.now();
  await save(it);
  emit();
}

// 更新 MD/HTML 文本内容（编辑器保存）
export async function updateContent(id, content) {
  const it = state.items.get(id);
  if (!it || it.type === 'FOLDER' || it.type === 'BOOKMARK') return;
  it.content = content;
  it.size = content.length;
  it.updatedAt = Date.now();
  await save(it);
  emit();
}

// ---------- 首次启动示例内容 ----------

async function seed() {
  const now = Date.now();
  const folder = {
    id: uid(), type: TYPES.FOLDER, name: '示例与指南', parentId: null,
    content: null, url: null, size: 0, createdAt: now, updatedAt: now, lastOpenedAt: null,
  };
  const welcome = {
    id: uid(), type: TYPES.MD, name: '欢迎使用拾页.md', parentId: folder.id,
    content: WELCOME_MD, url: null, size: WELCOME_MD.length,
    createdAt: now, updatedAt: now, lastOpenedAt: null,
  };
  const demo = {
    id: uid(), type: TYPES.HTML, name: '示例讲义.html', parentId: folder.id,
    content: DEMO_HTML, url: null, size: DEMO_HTML.length,
    createdAt: now, updatedAt: now, lastOpenedAt: null,
  };
  const bm = {
    id: uid(), type: TYPES.BOOKMARK, name: '冷铱 Markdown 编辑器', parentId: folder.id,
    content: null, url: 'https://github.com/woyin2024/lengyi-markdown-editor', size: 0,
    createdAt: now, updatedAt: now, lastOpenedAt: null,
  };
  state.items.set(folder.id, folder);
  state.items.set(welcome.id, welcome);
  state.items.set(demo.id, demo);
  state.items.set(bm.id, bm);
  await db.putItems([folder, welcome, demo, bm]);
}

const WELCOME_MD = `# 欢迎使用拾页

> 拾页 —— 把散落的网页与讲义，拾进一本随身的册子。

这是一款装在手机桌面的轻量阅读库：**导入 HTML / Markdown / 图片**、**文件夹整理**、**收藏常用网页**，全部数据存在本机，离线可用。

## 能做什么

1. **导入文件**：点右下角 ⊕ 按钮，从手机里选取 \`.html\` \`.md\` \`.md\` 图片等文件
2. **新建文件夹**：像整理书架一样分类归档
3. **收藏网页**：已上线的讲义直接存网址，随点随看
4. **编辑 Markdown**：打开任何一篇 MD，点右上角 ✎ 即可修改

## 渲染内核

Markdown 渲染管线移植自 [冷铱 Markdown 编辑器](https://github.com/woyin2024/lengyi-markdown-editor)——和你在电脑上的写作体验保持一致。

### 数学公式

行内公式 $E = mc^2$，块级公式：

$$
\\int_{-\\infty}^{+\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
$$

### 代码块

\`\`\`python
def fib(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

print([fib(i) for i in range(10)])
\`\`\`

### Mermaid 图表

\`\`\`mermaid
graph LR
    A[手机导入] --> B(拾页资料库)
    C[收藏网址] --> B
    B --> D{阅读}
    D -->|HTML| E[完整渲染]
    D -->|Markdown| F[公式与图表]
\`\`\`

### 表格与任务

| 格式 | 渲染方式 | 离线 |
| --- | --- | --- |
| HTML | 完整网页 | ✅ |
| Markdown | 冷铱内核 | ✅ |
| 网页收藏 | 在线加载 | ❌ |

- [x] 支持文件夹与搜索
- [x] 深色模式
- [ ] 更多主题（可以做）

## 小提示

- 长按任意条目可以**重命名 / 移动 / 删除**
- 同一文件夹里导入的图片，可以被同文件夹的 MD 用相对路径引用
- 示例内容不需要了就长按删掉

开始整理你的第一本册子吧。
`;

const DEMO_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>示例讲义</title>
<style>
  body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
         max-width: 42rem; margin: 0 auto; padding: 2rem 1.25rem; line-height: 1.8; color: #2a2620; }
  h1 { border-bottom: 3px solid #c4522f; padding-bottom: .4rem; }
  .tag { display: inline-block; background: #c4522f; color: #fff; border-radius: 4px;
         padding: 2px 10px; font-size: .8rem; margin-right: 6px; }
  blockquote { border-left: 4px solid #c4522f; margin: 1rem 0; padding: .5rem 1rem;
               background: #faf6ef; color: #6b6459; }
  code { background: #f0ece2; padding: 2px 6px; border-radius: 4px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d8d2c4; padding: 8px 12px; text-align: left; }
  th { background: #f4efe4; }
</style>
</head>
<body>
<h1>示例讲义 · 一元函数积分学</h1>
<p><span class="tag">高等数学</span><span class="tag">第 3 讲</span></p>
<p>这是一个 <strong>导入的 HTML 文件</strong>——拾页用内置浏览器完整渲染它，样式、脚本、外部资源照常工作。你已上线的讲义页面也可以直接用「收藏网页」存网址阅读。</p>
<blockquote>提示：把这份 HTML 从手机文件管理器分享/导入，或点右下角 ⊕ 导入。</blockquote>
<h2>本讲要点</h2>
<table>
  <tr><th>知识点</th><th>要求</th></tr>
  <tr><td>不定积分的定义</td><td>理解原函数与积分常数</td></tr>
  <tr><td>换元积分法</td><td>熟练第一类换元（凑微分）</td></tr>
  <tr><td>分部积分法</td><td>掌握 ∫u dv 公式与选取原则</td></tr>
</table>
<h2>随堂小练习</h2>
<p>求 <code>∫ x·e^x dx</code>。用分部积分：设 u = x，dv = e^x dx，则 du = dx，v = e^x，</p>
<p>原式 = x·e^x − ∫ e^x dx = <strong>x·e^x − e^x + C</strong>。</p>
</body>
</html>`;
