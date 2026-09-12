// 拾页 · Markdown 渲染内核（运行于阅读器 iframe 内）
// 管线移植自冷铱 Markdown 编辑器（wegin2024/lengyi-markdown-editor）：
//   protectMath（保护代码块中的 $ 不被 KaTeX 误渲染）
//   → marked.parse（breaks:true, gfm:true）
//   → restoreMath → 任务列表修饰 → highlight.js → KaTeX auto-render → Mermaid
(function () {
  'use strict';

  var THEME = document.body.dataset.theme === 'dark' ? 'dark' : 'light';

  // ---------- 冷铱 protectMath / restoreMath ----------
  function protectMath(text) {
    var placeholders = [];
    var counter = 0;
    var parts = text.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
    var out = parts.map(function (part) {
      if (part.startsWith('```') || part.startsWith('`')) return part;
      part = part.replace(/\$\$[\s\S]*?\$\$/g, function (m) { return store(m); });
      part = part.replace(/(^|[^\\])\$([^$\n]+?)\$/g, function (m, p1) { return p1 + store(m.slice(p1.length)); });
      return part;
    }).join('');

    return { text: out, placeholders: placeholders };

    function store(match) {
      var key = '<!--MATH' + counter++ + '-->';
      placeholders.push({ key: key, value: match });
      return key;
    }
  }

  function restoreMath(html, placeholders) {
    placeholders.forEach(function (p) {
      html = html.split(p.key).join(p.value);
    });
    return html;
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function styleTaskLists(root) {
    root.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      var li = cb.closest('li');
      if (!li) return;
      li.classList.add('task-item');
      var ul = li.closest('ul, ol');
      if (ul && ul.tagName === 'UL') ul.classList.add('task-list');
    });
  }

  // ---------- Mermaid（按需懒加载） ----------
  var mermaidLoading = null;
  function ensureMermaid(cb) {
    if (window.mermaid) { cb(); return; }
    if (mermaidLoading) { mermaidLoading.then(cb); return; }
    mermaidLoading = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = 'vendor/mermaid.min.js';
      s.onload = function () {
        mermaid.initialize({ startOnLoad: false, theme: THEME === 'dark' ? 'dark' : 'default' });
        resolve();
      };
      s.onerror = resolve;
      document.head.appendChild(s);
    });
    mermaidLoading.then(cb);
  }

  function renderMermaidBlocks(root) {
    var blocks = root.querySelectorAll('pre code.language-mermaid');
    if (!blocks.length) return;
    ensureMermaid(function () {
      blocks.forEach(function (code) {
        var pre = code.parentElement;
        var source = code.textContent.trim();
        if (!source) return;
        var container = document.createElement('div');
        container.className = 'mermaid';
        container.textContent = source;
        pre.replaceWith(container);
      });
      try {
        mermaid.run({ querySelector: '.markdown-body .mermaid' });
      } catch (err) { console.error('Mermaid render error:', err); }
    });
  }

  // ---------- 主渲染 ----------
  window.renderMD = function (rawText) {
    var root = document.getElementById('content');
    var text = String(rawText == null ? '' : rawText);
    var placeholders = [];
    var html = '';

    try {
      if (window.renderMathInElement) {
        var protectedText = protectMath(text);
        text = protectedText.text;
        placeholders = protectedText.placeholders;
      }

      if (window.marked) {
        marked.setOptions({ breaks: true, gfm: true });
        html = marked.parse(text);
      } else {
        html = '<pre style="white-space:pre-wrap">' + escapeHtml(text) + '</pre>';
      }

      if (placeholders.length) html = restoreMath(html, placeholders);

      root.innerHTML = html;
      styleTaskLists(root);

      // 代码高亮
      if (window.hljs) {
        root.querySelectorAll('pre code:not(.language-mermaid)').forEach(function (el) {
          try { hljs.highlightElement(el); } catch (e) { /* 忽略未知语言 */ }
        });
      }

      // KaTeX 公式
      if (window.renderMathInElement) {
        renderMathInElement(root, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      }

      renderMermaidBlocks(root);
    } catch (err) {
      root.innerHTML = '<p style="color:#c4522f">渲染出错：' + escapeHtml(String(err && err.message || err)) + '</p>';
    }

    document.title = (root.querySelector('h1') || {}).textContent || '拾页';
  };
})();
