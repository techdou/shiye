// 拾页 · 设置：主题切换 + 备份/恢复

import * as store from '../store.js';
import * as db from '../db.js';
import { showSheet, toast } from './sheets.js';

export let theme = 'auto';   // auto | light | dark

const mq = window.matchMedia('(prefers-color-scheme: dark)');

export function applyTheme() {
  const dark = theme === 'dark' || (theme === 'auto' && mq.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#171410' : '#f7f4ec';
}

mq.addEventListener('change', () => { if (theme === 'auto') applyTheme(); });

export async function loadTheme() {
  theme = await db.getSetting('theme', 'auto');
  applyTheme();
}

export async function setTheme(t) {
  theme = t;
  applyTheme();
  await db.setSetting('theme', t);
}

export function showSettingsSheet() {
  const box = document.createElement('div');
  box.className = 'settings-box';

  const label = document.createElement('div');
  label.className = 'settings-label';
  label.textContent = '外观';
  box.appendChild(label);

  const seg = document.createElement('div');
  seg.className = 'seg';
  [['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色']].forEach(([v, t]) => {
    const b = document.createElement('button');
    b.textContent = t;
    b.className = 'seg-btn' + (theme === v ? ' on' : '');
    b.addEventListener('click', async () => {
      await setTheme(v);
      seg.querySelectorAll('.seg-btn').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      // 若正开着 MD 阅读器，刷新内核主题
      document.dispatchEvent(new CustomEvent('themechanged'));
    });
    seg.appendChild(b);
  });
  box.appendChild(seg);

  const label2 = document.createElement('div');
  label2.className = 'settings-label';
  label2.textContent = '数据';
  box.appendChild(label2);

  const exportBtn = document.createElement('button');
  exportBtn.className = 'settings-row';
  exportBtn.textContent = '导出备份（.json）';
  exportBtn.addEventListener('click', () => { doExport(); });
  box.appendChild(exportBtn);

  const importBtn = document.createElement('button');
  importBtn.className = 'settings-row';
  importBtn.textContent = '从备份恢复';
  importBtn.addEventListener('click', pickBackup);
  box.appendChild(importBtn);

  const about = document.createElement('div');
  about.className = 'settings-about';
  about.innerHTML = '拾页 · 网页资料库<br>Markdown 内核来自 <a href="https://github.com/woyin2024/lengyi-markdown-editor" target="_blank" rel="noopener">冷铱编辑器</a>';
  box.appendChild(about);

  showSheet('设置', box);
}

// ---------- 备份 ----------

function b64(blob) {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.readAsDataURL(blob);
  });
}

async function un64(b64str) {
  const r = await fetch('data:application/octet-stream;base64,' + b64str);
  return await r.blob();
}

async function doExport() {
  const items = [];
  store.getState().items.forEach(it => items.push(it));
  const payload = { app: 'shiye', version: 1, exportedAt: Date.now(), items: [] };
  for (const it of items) {
    const row = { ...it };
    if (it.content instanceof Blob) row.contentB64 = await b64(it.content);
    payload.items.push(row);
  }
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `shiye-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('备份已导出');
}

function pickBackup() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', async () => {
    const f = input.files && input.files[0];
    input.remove();
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== 'shiye' || !Array.isArray(data.items)) throw new Error('格式不对');
      const restored = [];
      for (const row of data.items) {
        const it = { ...row };
        if (row.contentB64) it.content = await un64(row.contentB64);
        restored.push(it);
      }
      // 孤儿校验：parentId 指向不存在的条目时挂到根，避免躺在库里却永远看不见的数据
      const idSet = new Set([...store.getState().items.keys(), ...restored.map(x => x.id)]);
      restored.forEach(it => {
        if (it.parentId && !idSet.has(it.parentId)) it.parentId = null;
      });
      await db.putItems(restored);
      restored.forEach(it => store.getState().items.set(it.id, it));
      store.emit();
      toast(`已恢复 ${restored.length} 个条目`);
    } catch (e) {
      toast('恢复失败：' + (e.message || '文件无效'));
    }
  });
  input.click();
}
