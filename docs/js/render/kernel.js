// 拾页 · Markdown 渲染内核(SDK 版)
// ============================================================
// 从 md-view.js 抽取的独立渲染模块,不依赖特定 DOM 结构与 iframe
// 环境:iframe 内(md-view.js 适配层)与普通页面均可直接引用。
//
// 依赖(由宿主页面以 <script>/<link> 引入,与 vendor/ 自托管文件配套):
//   marked.min.js · highlight.min.js · katex/katex.min.js · katex/auto-render.min.js
//   (mermaid 由本内核按需懒加载,无需预引入)
//   可选:link[data-shiye-hljs](hljs 主题样式,codeScheme='follow' 时随主题切换)
//
// 用法:
//   ShiyeRender.init({ vendorBase: 'vendor/', theme: 'light', codeScheme: 'follow' });
//   ShiyeRender.render('# 标题\n\n正文', { container: document.querySelector('.md') });
//
// 管线(移植自冷铱 Markdown 编辑器,经拾页增强):
//   protectMath(保护代码块中的 $)→ marked.parse → restoreMath → 任务列表
//   → heading 锚点 → highlight.js → KaTeX auto-render → Mermaid(懒加载)
(function () {
  'use strict';

  var cfg = {
    vendorBase: 'vendor/',
    theme: 'light',
    codeScheme: 'follow',   // 'follow' = 代码块配色随主题 | 'dark' = 恒为深底浅字
    headingIds: true,
  };

  // ---------- 公开 API ----------

  window.ShiyeRender = {
    /** 初始化/更新配置;重复调用以最后一次为准 */
    init: function (opts) {
      opts = opts || {};
      if (opts.vendorBase != null) cfg.vendorBase = opts.vendorBase;
      if (opts.theme) cfg.theme = opts.theme;
      if (opts.codeScheme) cfg.codeScheme = opts.codeScheme;
      if (opts.headingIds != null) cfg.headingIds = !!opts.headingIds;
      if (window.marked) marked.setOptions({ breaks: true, gfm: true, headerIds: false, mangle: false });
    },

    /** 主题变化时由宿主调用:follow 模式下同步 hljs 主题样式与 mermaid 主题 */
    setTheme: function (theme) {
      cfg.theme = theme === 'dark' ? 'dark' : 'light';
      applyCodeScheme();
      if (window.mermaid) {
        try { mermaid.initialize({ startOnLoad: false, theme: cfg.theme }); } catch (e) {}
      }
    },

    /** 代码块配色方案:'follow'(随主题) | 'dark'(恒深底浅字) */
    setCodeScheme: function (scheme) {
      cfg.codeScheme = scheme === 'dark' ? 'dark' : 'follow';
      applyCodeScheme();
    },

    /** 主渲染入口:text → container */
    render: function (rawText, opts) {
      opts = opts || {};
      var root = opts.container || document.getElementById('content');
      if (!root) return;
      var text = String(rawText == null ? '' : rawText);
      var placeholders = [];
      var html;

      try {
        if (window.renderMathInElement) {
          var p = protectMath(text);
          text = p.text; placeholders = p.placeholders;
        }
        if (window.marked) {
          html = marked.parse(text);
        } else {
          html = '<pre style="white-space:pre-wrap">' + escapeHtml(text) + '</pre>';
        }
        if (placeholders.length) html = restoreMath(html, placeholders);
      } catch (err) {
        root.innerHTML = '<p style="color:#c4522f">渲染出错:' + escapeHtml(String(err && err.message || err)) + '</p>';
        return;
      }

      root.innerHTML = html;
      root.classList.add('shiye-scope');
      postprocess(root);
    },
  };

  // ---------- 渲染后处理 ----------

  function postprocess(root) {
    styleTaskLists(root);
    applyHeadingIds(root);
    applyCodeScheme();
    highlightCode(root);
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
  }

  function highlightCode(root) {
    if (!window.hljs) return;
    root.querySelectorAll('pre code:not(.language-mermaid)').forEach(function (el) {
      try { hljs.highlightElement(el); } catch (e) { /* 未知语言忽略 */ }
    });
  }

  /** h2/h3 自动生成锚点 id(sec-1、sec-2…),供目录/深链使用 */
  function applyHeadingIds(root) {
    if (!cfg.headingIds) return;
    var heads = root.querySelectorAll('h1[id], h2, h3');
    var i = 0;
    heads.forEach(function (h) {
      if (!h.id) h.id = 'sec-' + (++i);
    });
  }

  /** 代码块配色方案注入(幂等,一次注入后续渲染持续生效) */
  function applyCodeScheme() {
    var doc = document;
    var style = doc.getElementById('shiye-code-scheme');
    if (cfg.codeScheme !== 'dark') {
      if (style) style.remove();
      syncHljsLink(cfg.theme);
      return;
    }
    if (!style) {
      style = doc.createElement('style');
      style.id = 'shiye-code-scheme';
      doc.head.appendChild(style);
    }
    // 恒深底浅字:对 .shiye-scope 容器生效(由 render 时为容器补类),或整页 pre
    style.textContent =
      '.shiye-scope pre, .shiye-scope pre code { background:#0d1117 !important; border-color:rgba(240,246,252,.12); }' +
      '.shiye-scope pre code { color:#e6edf3 !important; }' +
      '.shiye-scope pre code .hljs, .shiye-scope pre .hljs { background:transparent !important; }';
    syncHljsLink('dark');
  }

  /** 同步 link[data-shiye-hljs] 指向的 hljs 主题文件(follow 模式用;dark 模式恒 dark) */
  function syncHljsLink(theme) {
    var link = document.querySelector('link[data-shiye-hljs]');
    if (!link) return;
    var want = (cfg.codeScheme === 'dark' || theme === 'dark')
      ? 'highlight-github-dark.min.css' : 'highlight-github.min.css';
    if (link.getAttribute('href').indexOf(want) === -1) {
      link.href = cfg.vendorBase + want;
    }
  }

  // ---------- 工具 ----------

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function styleTaskLists(root) {
    root.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      var li = cb.closest('li'); if (!li) return;
      li.classList.add('task-item');
      var ul = li.closest('ul, ol');
      if (ul && ul.tagName === 'UL') ul.classList.add('task-list');
    });
  }

  // ---------- protectMath / restoreMath(冷铱管线) ----------

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
    placeholders.forEach(function (p) { html = html.split(p.key).join(p.value); });
    return html;
  }

  // ---------- Mermaid(按需懒加载) ----------

  var mermaidLoading = null;
  function ensureMermaid(cb) {
    if (window.mermaid) { cb(); return; }
    if (mermaidLoading) { mermaidLoading.then(cb); return; }
    mermaidLoading = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = cfg.vendorBase + 'mermaid.min.js';
      s.onload = function () {
        mermaid.initialize({ startOnLoad: false, theme: cfg.theme === 'dark' ? 'dark' : 'default' });
        resolve();
      };
      s.onerror = function () {
        console.error('[shiye] Mermaid 加载失败:', s.src);
        resolve();
      };
      document.head.appendChild(s);
    });
    mermaidLoading.then(cb);
  }

  function renderMermaidBlocks(root) {
    var blocks = root.querySelectorAll('pre code.language-mermaid');
    if (!blocks.length) return;
    ensureMermaid(function () {
      if (!window.mermaid) {
        blocks.forEach(function (code) {
          var pre = code.parentElement;
          pre.insertAdjacentHTML('afterend',
            '<p style="color:#c4522f;font-size:.9em">⚠ Mermaid 依赖加载失败,图表无法渲染。</p>');
        });
        return;
      }
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
        var nodes = Array.prototype.slice.call(root.querySelectorAll('.mermaid'));
        if (nodes.length) mermaid.run({ nodes: nodes });
      } catch (err) {
        console.error('Mermaid render error:', err);
      }
      // 语法错误的容器:mermaid 会置为 error 状态,补一条可见提示并保留源码
      root.querySelectorAll('.mermaid').forEach(function (el) {
        if (el.getAttribute('data-processed') === 'error' ||
            (el.querySelector('svg') == null && el.querySelector('.error-text'))) {
          el.insertAdjacentHTML('beforeend',
            '<p style="color:#c4522f;font-size:.85em">⚠ 图表语法有误,请检查 Mermaid 源码。</p>');
        }
      });
    });
  }
})();
