// 拾页 · Service Worker
// 策略：app shell 预缓存（cache-first）；vendor 大件与字体运行时缓存（stale-while-revalidate）
// 更新版本时递增 CACHE_VERSION 即可

const CACHE_VERSION = 'shiye-v7';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/main.js',
  './js/db.js',
  './js/store.js',
  './js/ui/library.js',
  './js/ui/reader.js',
  './js/ui/sheets.js',
  './js/ui/settings.js',
  './js/render/md-view.js',
  './vendor/marked.min.js',
  './vendor/highlight.min.js',
  './vendor/highlight-github.min.css',
  './vendor/highlight-github-dark.min.css',
  './vendor/katex/katex.min.css',
  './vendor/katex/katex.min.js',
  './vendor/katex/auto-render.min.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];
const RUNTIME_PATTERNS = [
  /\/vendor\/mermaid\.min\.js$/,
  /\/vendor\/katex\/fonts\//,
  /\/icons\//,
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      // cache:'reload' 绕过 HTTP 缓存：否则版本升级时 addAll 可能从浏览器缓存
      // 拉到旧文件，导致"SW 更新了但内容没变"的假升级
      .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 外部资源直接走网络

  // 系统分享入口（manifest share_target POST）：文件落收件箱库后重定向首页
  if (req.method === 'POST') {
    if (url.pathname.endsWith('/share/')) e.respondWith(handleSharePost(req));
    return;
  }
  if (req.method !== 'GET') return;

  const runtime = RUNTIME_PATTERNS.some(re => re.test(url.pathname));

  if (runtime) {
    // stale-while-revalidate
    e.respondWith(
      caches.open(CACHE_VERSION).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req).then(res => {
          if (res.ok) c.put(req, res.clone());
          return res;
        }).catch(() => hit || new Response('', { status: 504, statusText: 'offline' }));
        return hit || net;
      })
    );
    return;
  }

  // shell：cache-first，未命中再网络。导航请求带查询参数（如分享进入 ?shared=1）
  // 时靠 ignoreSearch 命中壳缓存，离线分享也能打开
  e.respondWith(
    caches.match(req, req.mode === 'navigate' ? { ignoreSearch: true } : undefined).then(hit =>
      hit || fetch(req).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, clone));
        }
        return res;
      })
    )
  );
});

// ---------- 系统分享接收（Web Share Target Level 2） ----------

const INBOX_DB = 'shiye-inbox';
const INBOX_STORE = 'files';

async function handleSharePost(req) {
  try {
    const form = await req.formData();
    const files = form.getAll('files').filter(f => f instanceof File);
    const text = (form.get('text') || form.get('url') || '').toString();
    const params = new URLSearchParams();
    if (files.length) {
      await stashSharedFiles(files);
      params.set('shared', '1');
    } else if (text) {
      params.set('text', text);
    }
    return Response.redirect(new URL('./?' + params.toString(), self.registration.scope).toString(), 303);
  } catch (err) {
    return Response.redirect(new URL('./', self.registration.scope).toString(), 303);
  }
}

async function stashSharedFiles(files) {
  const d = await openInbox();
  await new Promise((resolve, reject) => {
    const t = d.transaction(INBOX_STORE, 'readwrite');
    const s = t.objectStore(INBOX_STORE);
    files.forEach(f => s.put({ name: f.name, type: f.type, blob: f }));
    t.oncomplete = () => { d.close(); resolve(); };
    t.onerror = () => reject(t.error);
  });
}

function openInbox() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(INBOX_DB, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(INBOX_STORE)) {
        r.result.createObjectStore(INBOX_STORE, { autoIncrement: true });
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
