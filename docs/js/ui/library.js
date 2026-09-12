// 拾页 · 资料库主界面
// 面包屑 + 最近打开 + 条目列表 + 搜索结果

import * as store from '../store.js';
import * as reader from './reader.js';
import * as sheets from './sheets.js';
import * as settings from './settings.js';

const ICONS = {
  folder: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
  html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="9 13 7 15 9 17"/><polyline points="15 13 17 15 15 17"/></svg>',
  md: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M7 16v-5l2.5 2.5L12 11v5"/><path d="M17 11v5m0 0-1.6-1.6M17 16l1.6-1.6"/></svg>',
  image: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  chevron: '<i class="row-chev">›</i>',
  clock: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  searchOff: '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
};

const TYPE_META = {
  HTML: { icon: 'html', label: '网页' },
  MD: { icon: 'md', label: '笔记' },
  IMAGE: { icon: 'image', label: '图片' },
  BOOKMARK: { icon: 'bookmark', label: '收藏' },
};

let els = {};
let longPressBound = false;

export function initLibrary() {
  els = {
    crumbs: document.getElementById('crumbs'),
    recentsWrap: document.getElementById('recents-wrap'),
    recents: document.getElementById('recents'),
    list: document.getElementById('list'),
    empty: document.getElementById('empty'),
    search: document.getElementById('search'),
    fab: document.getElementById('fab'),
    gear: document.getElementById('gear'),
    up: document.getElementById('btn-up'),
  };

  els.search.addEventListener('input', () => store.setQuery(els.search.value));
  els.fab.addEventListener('click', () => sheets.showAddSheet());
  els.gear.addEventListener('click', () => settings.showSettingsSheet());
  els.up.addEventListener('click', goUp);
  document.getElementById('crumbs').addEventListener('click', onCrumbClick);

  if (!longPressBound) {
    sheets.bindLongPress(els.list, '.row', (id) => {
      const it = store.getItem(id);
      if (it) sheets.showActionSheet(it);
    });
    sheets.bindLongPress(els.recents, '.recent-card', (id) => {
      const it = store.getItem(id);
      if (it) sheets.showActionSheet(it);
    });
    longPressBound = true;
  }
  window.addEventListener('resize', updateRecentsOverflow);

  // 条目点击
  els.list.addEventListener('click', onRowClick);
  els.recents.addEventListener('click', (e) => {
    const card = e.target.closest('.recent-card');
    if (card) openItem(card.dataset.id);
  });
}

function goUp() {
  const cur = store.getState().cwd;
  if (!cur) return;
  const parent = store.getItem(cur);
  store.navigate(parent ? parent.parentId : null);
}

function onCrumbClick(e) {
  const b = e.target.closest('.crumb-btn');
  if (!b) return;
  store.navigate(b.dataset.id === '' ? null : b.dataset.id);
}

function onRowClick(e) {
  if (e.target.closest('.row-chev-wrap')) {
    const row = e.target.closest('.row');
    if (row) {
      const it = store.getItem(row.dataset.id);
      if (it) sheets.showActionSheet(it);
    }
    return;
  }
  const row = e.target.closest('.row');
  if (row) openItem(row.dataset.id);
}

function openItem(id) {
  const it = store.getItem(id);
  if (!it) return;
  if (it.type === 'FOLDER') store.navigate(id);
  else reader.open(id);
}

// ---------- 渲染 ----------

export function render() {
  const st = store.getState();
  // 搜索框单向跟随状态：navigate 等路径清掉 query 后输入框同步归零
  if (els.search && els.search.value !== st.query) els.search.value = st.query;
  const searching = st.query.trim().length > 0;
  renderCrumbs(searching);

  els.up.classList.toggle('hidden', searching || st.cwd === null);

  if (searching) {
    const results = store.searchAll(st.query);
    els.recentsWrap.classList.add('hidden');
    els.empty.classList.add('hidden');
    els.list.classList.remove('hidden');
    els.list.innerHTML = results.length
      ? results.map(rowHtml).join('')
      : '';
    if (!results.length) {
      els.empty.classList.remove('hidden');
      els.empty.innerHTML = `<div class="empty-icon">${ICONS.searchOff}</div><p>没有找到「${escapeHtml(st.query.trim())}」</p><span>换个关键词试试</span>`;
    }
    return;
  }

  const items = store.children(st.cwd);
  els.list.innerHTML = items.map(rowHtml).join('');
  els.list.classList.toggle('hidden', items.length === 0);
  els.empty.classList.toggle('hidden', items.length !== 0);
  if (!items.length) {
    const atRoot = st.cwd === null;
    els.empty.innerHTML = `<div class="empty-glyph">拾</div><p>${atRoot ? '册子还是空的' : '这个文件夹是空的'}</p><span>点右下角 ⊕ 导入文件、建文件夹或收藏网页</span>`;
  }

  // 最近打开（仅根目录且非搜索态）
  const recent = st.cwd === null ? store.recents() : [];
  els.recentsWrap.classList.toggle('hidden', recent.length === 0);
  if (recent.length) {
    els.recents.innerHTML = recent.map(it => {
      const m = TYPE_META[it.type] || {};
      return `<button class="recent-card" data-id="${it.id}">
        <span class="t-icon ${it.type.toLowerCase()}">${ICONS[m.icon]}</span>
        <b>${escapeHtml(displayName(it))}</b>
        <i>${m.label}</i>
      </button>`;
    }).join('');
    // 溢出才启用右缘渐隐（宽屏放得下时不做无谓的淡出）
    updateRecentsOverflow();
  }
}

function updateRecentsOverflow() {
  if (!els.recents) return;
  els.recents.toggleAttribute('data-overflow', els.recents.scrollWidth > els.recents.clientWidth + 1);
}

function renderCrumbs(searching) {
  const st = store.getState();
  els.crumbs.innerHTML = '';
  if (searching) {
    els.crumbs.appendChild(crumbBtn('', '搜索结果', true));
    return;
  }
  els.crumbs.appendChild(crumbBtn('', '全部', st.cwd === null));
  store.breadcrumb().forEach(p => {
    els.crumbs.appendChild(crumbBtn(p.id, p.name, st.cwd === p.id));
  });
}

function crumbBtn(id, label, on) {
  const b = document.createElement('button');
  b.className = 'crumb-btn' + (on ? ' on' : '');
  b.dataset.id = id || '';
  b.textContent = label;
  return b;
}

function displayName(it) {
  if (it.type === 'MD') return it.name.replace(/\.(md|markdown)$/i, '');
  if (it.type === 'HTML') return it.name.replace(/\.html?$/i, '');
  return it.name;
}

function metaLine(it) {
  const m = TYPE_META[it.type] || {};
  const bits = [m.label];
  if (it.type === 'BOOKMARK') {
    try { bits.push(new URL(it.url).hostname.replace(/^www\./, '')); } catch (e) { /* 忽略 */ }
  } else if (it.size) {
    bits.push(fmtSize(it.size));
  }
  const t = it.updatedAt || it.createdAt;
  if (t) bits.push(fmtDate(t));
  return bits.join(' · ');
}

function rowHtml(it) {
  const m = TYPE_META[it.type] || {};
  const isFolder = it.type === 'FOLDER';
  return `<button class="row" data-id="${it.id}">
    <span class="t-icon ${isFolder ? 'folder' : it.type.toLowerCase()}">${isFolder ? ICONS.folder : ICONS[m.icon]}</span>
    <span class="row-main">
      <b>${escapeHtml(displayName(it))}</b>
      <i>${escapeHtml(metaLine(it))}</i>
    </span>
    <span class="row-chev-wrap">${isFolder ? ICONS.chevron : ICONS.chevron}</span>
  </button>`;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function fmtSize(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

function fmtDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  return sameYear ? md : `${d.getFullYear()}年${md}`;
}
