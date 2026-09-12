// 拾页 · 入口
import * as store from './store.js';
import * as library from './ui/library.js';
import * as reader from './ui/reader.js';
import * as settings from './ui/settings.js';
import * as sheets from './ui/sheets.js';

async function boot() {
  await settings.loadTheme();
  await store.init();

  library.initLibrary();
  reader.initReader();
  store.subscribe(library.render);
  library.render();

  bindReaderShortcuts();
  handleShareTarget();
  registerSW();
}

// 系统返回键 / 手势关闭阅读器
function bindReaderShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && reader.isOpen()) reader.close();
  });
}

// PWA share_target：从系统分享菜单接收网址
function handleShareTarget() {
  const sp = new URLSearchParams(location.search);
  const text = sp.get('text') || sp.get('url') || '';
  if (!text) return;
  history.replaceState(null, '', location.pathname);
  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  if (!urlMatch) {
    sheets.toast('未识别到链接，仅支持收藏网址');
    return;
  }
  const url = urlMatch[0];
  setTimeout(async () => {
    const name = text.replace(url, '').trim();
    const finalName = await sheets.promptSheet({
      title: '收藏网页',
      value: name,
      placeholder: '名称（可留空）',
    });
    if (finalName == null) return;
    try {
      await store.addBookmark(url, finalName);
      sheets.toast('已收藏');
    } catch (e) {
      sheets.toast(e.message);
    }
  }, 400);
}

function registerSW() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* SW 失败不影响功能 */ });
  }
}

boot();
