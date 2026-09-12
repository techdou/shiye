// 拾页 · Service Worker
// 策略：app shell 预缓存（cache-first）；vendor 大件与字体运行时缓存（stale-while-revalidate）
// 更新版本时递增 CACHE_VERSION 即可

const CACHE_VERSION = 'shiye-v6';
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
      .then(c => c.addAll(SHELL))
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
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 外部资源直接走网络

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

  // shell：cache-first，未命中再网络
  e.respondWith(
    caches.match(req).then(hit =>
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
