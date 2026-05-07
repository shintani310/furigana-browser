// extract / fullcopy 両モードのリンク乗っ取り
window.LinkRouter = (function () {
  'use strict';

  // DDGトラッキングURLの展開（保険: extract対象がDDGリンクを含む場合に備える）
  function unwrapDdgUrl(href) {
    if (!href) return href;
    const m = href.match(/[?&]uddg=([^&]+)/);
    if (m) {
      try { return decodeURIComponent(m[1]); } catch { /* noop */ }
    }
    return href;
  }

  // extract モード: 抽出済みコンテナ内の <a href> クリックを捕捉
  // onNavigate: function(absoluteUrl: string) — 親が遷移処理を実行する
  function attachExtractClick(container, onNavigate) {
    container.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (!href || href.startsWith('#')) return;
      if (/^(javascript:|mailto:|tel:)/i.test(href)) return;
      e.preventDefault();
      // extractor.absolutizeUrls 済み or <base> 設定済みなので a.href は絶対URL
      const abs = a.href || href;
      const real = unwrapDdgUrl(abs);
      if (real && /^https?:/i.test(real)) {
        onNavigate(real);
      }
    });
  }

  // fullcopy モード: iframe srcdoc に注入するスクリプト
  // クリックを capture phase で捕捉して、絶対URLを親に postMessage で通知。
  // ES5互換で書く（任意のサイトが iframe 内で動くため、古いブラウザ実装に近い形が安全）
  const FULLCOPY_INJECT_SCRIPT =
    "(function(){\n" +
    "  document.addEventListener('click', function(e){\n" +
    "    var a = e.target && e.target.closest && e.target.closest('a[href]');\n" +
    "    if (!a) return;\n" +
    "    var href = a.getAttribute('href');\n" +
    "    if (!href) return;\n" +
    "    if (href.charAt(0) === '#') return;\n" +
    "    if (/^(javascript:|mailto:|tel:)/i.test(href)) return;\n" +
    "    e.preventDefault();\n" +
    "    try { parent.postMessage({ type: 'fr-navigate', url: a.href }, '*'); } catch(_){}\n" +
    "  }, true);\n" +
    "})();";

  // fullcopy モード: 親側で iframe からの postMessage を受信
  // 戻り値は detach 関数（state遷移時にリスナーを外せるよう）
  function attachFullcopyListener(onNavigate) {
    function handler(e) {
      if (!e.data || e.data.type !== 'fr-navigate') return;
      const url = e.data.url;
      if (!url) return;
      const real = unwrapDdgUrl(url);
      if (real && /^https?:/i.test(real)) {
        onNavigate(real);
      }
    }
    window.addEventListener('message', handler);
    return function detach() {
      window.removeEventListener('message', handler);
    };
  }

  return {
    unwrapDdgUrl,
    attachExtractClick,
    FULLCOPY_INJECT_SCRIPT,
    attachFullcopyListener,
  };
})();
