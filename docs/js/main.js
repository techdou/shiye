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
  await handleSharedFiles();
  await handleNativeShare();
  handleShareTarget();
  bindNativeShareEvents();
  registerSW();
}

// 系统返回键 / 手势关闭阅读器
function bindReaderShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && reader.isOpen()) reader.close();
  });
}

// PWA share_target（文件）：SW 已把分享的文件落进 shiye-inbox 库并重定向到 ?shared=1，
// 这里读出、导入、清库。收件箱打不开或为空都不影响主流程
async function handleSharedFiles() {
  const sp = new URLSearchParams(location.search);
  let records = [];
  try { records = await takeSharedFiles(); } catch (e) { /* 无收件箱环境（如浏览器首启） */ }
  if (records.length) {
    const files = records.map(r => new File([r.blob], r.name, { type: r.type || '' }));
    try {
      await store.importFiles(files);
      sheets.toast(`已导入 ${records.length} 个分享文件`);
    } catch (e) {
      sheets.toast(e.message);
    }
  }
  if (sp.has('shared') || records.length) {
    sp.delete('shared');
    const qs = sp.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
  }
}

function takeSharedFiles() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('shiye-inbox', 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains('files')) {
        r.result.createObjectStore('files', { autoIncrement: true });
      }
    };
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const d = r.result;
      const t = d.transaction('files', 'readwrite');
      const s = t.objectStore('files');
      const req = s.getAll();
      req.onsuccess = () => {
        const out = req.result || [];
        s.clear();
        t.oncomplete = () => { d.close(); resolve(out); };
        t.onerror = () => reject(t.error);
      };
    };
  });
}

// PWA share_target：从系统分享菜单接收网址（GET 旧入口 + POST 重定向带 text 均走这里）
function handleShareTarget() {
  const sp = new URLSearchParams(location.search);
  const text = sp.get('text') || sp.get('url') || '';
  if (!text) return;
  history.replaceState(null, '', location.pathname);
  setTimeout(() => collectUrlFromText(text), 400);
}

// 从分享文字里提取网址 → 收藏确认弹窗（PWA 与 APK 共用）
async function collectUrlFromText(text) {
  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  if (!urlMatch) {
    sheets.toast('未识别到链接，仅支持收藏网址');
    return;
  }
  const url = urlMatch[0];
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
}

// ---------- APK 壳（Capacitor）原生分享接收 ----------

function nativeSharePlugin() {
  return window.Capacitor?.Plugins?.ShareReceiver || null;
}

// 冷启动/被分享拉起时从原生侧取暂存的分享内容
async function handleNativeShare() {
  const plugin = nativeSharePlugin();
  if (!plugin) return;
  try {
    const res = await plugin.getShared();
    const files = (res.files || []).map(f =>
      new File([base64ToBlob(f.data, f.type)], f.name, { type: f.type || '' })
    );
    if (files.length) {
      await store.importFiles(files);
      sheets.toast(`已导入 ${files.length} 个分享文件`);
    } else if (res.text) {
      await collectUrlFromText(res.text);
    }
  } catch (e) { /* 插件不可用或读取失败，不影响主流程 */ }
}

// APP 已在前台时再次被分享（onNewIntent → 原生事件）
function bindNativeShareEvents() {
  const plugin = nativeSharePlugin();
  if (!plugin?.addListener) return;
  plugin.addListener('sharedReceived', () => { handleNativeShare(); });
}

function base64ToBlob(b64, type) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: type || '' });
}

function registerSW() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* SW 失败不影响功能 */ });
  }
}

boot();
