// 拾页 · 数据层
// IndexedDB 封装：items（条目树）+ settings（偏好）
// 库规模小，采用"全量载入内存、写入即落盘"策略

const DB_NAME = 'shiye';
const DB_VERSION = 1;
const STORE_ITEMS = 'items';
const STORE_SETTINGS = 'settings';

let _db = null;

function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE_ITEMS)) {
        const s = d.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
        s.createIndex('parentId', 'parentId');
      }
      if (!d.objectStoreNames.contains(STORE_SETTINGS)) {
        d.createObjectStore(STORE_SETTINGS);
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode) {
  return open().then(d => d.transaction(store, mode).objectStore(store));
}

function reqAsPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllItems() {
  const s = await tx(STORE_ITEMS, 'readonly');
  return reqAsPromise(s.getAll());
}

export async function putItem(item) {
  const s = await tx(STORE_ITEMS, 'readwrite');
  return reqAsPromise(s.put(item));
}

export async function putItems(items) {
  const d = await open();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE_ITEMS, 'readwrite');
    const s = t.objectStore(STORE_ITEMS);
    items.forEach(it => s.put(it));
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}

export async function deleteItems(ids) {
  const d = await open();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE_ITEMS, 'readwrite');
    const s = t.objectStore(STORE_ITEMS);
    ids.forEach(id => s.delete(id));
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}

export async function getSetting(key, fallback = null) {
  const s = await tx(STORE_SETTINGS, 'readonly');
  const v = await reqAsPromise(s.get(key));
  return v === undefined ? fallback : v;
}

export async function setSetting(key, value) {
  const s = await tx(STORE_SETTINGS, 'readwrite');
  return reqAsPromise(s.put(value, key));
}
