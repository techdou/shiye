// 拾页 · 通用工具(模块侧共享;iframe 内渲染内核自带实现,互不依赖)
export function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}
