// 拾页 · MD 渲染适配层(iframe 内使用)
// ============================================================
// 渲染管线已抽至 js/render/kernel.js(ShiyeRender),本文件只做
// iframe 环境的装配:读取主题、初始化内核、保持 renderMD(text) 全局签名
// (reader.js 的 srcdoc 注入约定不变)。
//
// 代码块配色:scheme:'follow' —— 跟随 body[data-theme](由 reader.js 按
// 主题写入对应 hljs 样式,见 reader.js renderMdFrame)。
// 如需"恒深底浅字"方案,把 follow 改为 'dark' 即可。
(function () {
  'use strict';

  var THEME = document.body.dataset.theme === 'dark' ? 'dark' : 'light';

  if (window.ShiyeRender) {
    window.ShiyeRender.init({
      vendorBase: 'vendor/',
      theme: THEME,
      codeScheme: 'follow',
      headingIds: true,
    });
  }

  window.renderMD = function (rawText) {
    var root = document.getElementById('content');
    if (!root) return;

    if (window.ShiyeRender) {
      window.ShiyeRender.render(rawText, { container: root });
    } else {
      // 内核缺失时的兜底:转义后纯文本展示
      root.innerHTML = '<pre style="white-space:pre-wrap"></pre>';
      root.firstChild.textContent = String(rawText == null ? '' : rawText);
    }

    var h1 = root.querySelector('h1');
    document.title = (h1 && h1.textContent) || '拾页';
  };
})();
