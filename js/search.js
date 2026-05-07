// SEARCH state: DuckDuckGo HTML版で検索 → 結果領域(#links)をそのまま取り込み → クリックを乗っ取り
window.SearchView = (function () {
  'use strict';

  const DDG_HTML = 'https://html.duckduckgo.com/html/?q=';
  const PROXY_BASE = (window.Extractor && window.Extractor.PROXY_BASE) ||
                     'https://furigana-proxy.furigana-reader.workers.dev/';
  const esc = (s) => window.App.escapeHtml(s);

  // 連続検索時に古いfetchの結果が新しい結果を上書きしないよう、リクエストIDで判定する
  let currentReqId = 0;

  function buildSearchUrl(query) {
    return DDG_HTML + encodeURIComponent(query);
  }

  // DDGの結果リンクは //duckduckgo.com/l/?uddg=<encodedURL>&... 形式
  function unwrapDdgUrl(href) {
    if (!href) return href;
    const m = href.match(/[?&]uddg=([^&]+)/);
    if (m) {
      try { return decodeURIComponent(m[1]); } catch { /* noop */ }
    }
    return href;
  }

  async function fetchHtml(url) {
    const proxyUrl = PROXY_BASE + '?url=' + encodeURIComponent(url);
    const res = await fetch(proxyUrl);
    if (!res.ok) {
      throw new Error('プロキシ取得エラー (' + res.status + ' ' + res.statusText + ')');
    }
    return await res.text();
  }

  // 相対URL・プロトコル相対URLを絶対化（DDGをbaseとして）
  // → 結果HTML内の /foo や //foo がローカルに解決されて404になるのを防ぐ
  function absolutizeUrls(root, baseUrl) {
    root.querySelectorAll('img, a, source, link, script').forEach((el) => {
      ['src', 'href'].forEach((attr) => {
        const v = el.getAttribute(attr);
        if (!v) return;
        if (/^(https?:|data:|mailto:|tel:|#)/i.test(v)) return;
        try {
          el.setAttribute(attr, new URL(v, baseUrl).href);
        } catch (_) { /* noop */ }
      });
    });
  }

  async function applyFurigana(resultsEl, ctx, reqId) {
    try {
      const grades = await window.App.loadKanjiGrades();
      if (reqId !== currentReqId) return;
      await window.Furigana.init();
      if (reqId !== currentReqId) return;
      await window.Furigana.addFuriganaToDOM(resultsEl, grades);
      if (reqId !== currentReqId) return;
      window.Furigana.applyGradeFilter(resultsEl, ctx.grade);
    } catch (err) {
      // ふりがな失敗時もクリックはできるので silent
      console.warn('Search furigana failed:', err);
    }
  }

  function attachClickHandler(container) {
    container.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      // 結果以外のリンク（DDGの内部UI等）は無視
      if (!a.closest('.result')) return;

      const href = a.getAttribute('href') || '';
      if (!href || href.startsWith('#')) return;
      if (/^(javascript:|mailto:|tel:)/i.test(href)) return;

      e.preventDefault();

      // 絶対URL化: //... はDDGのプロトコル相対、相対パスはDDGをbaseとして解決
      let abs = href;
      if (href.startsWith('//')) {
        abs = 'https:' + href;
      } else if (!/^https?:/i.test(href)) {
        try { abs = new URL(href, 'https://html.duckduckgo.com/').href; } catch { return; }
      }

      const real = unwrapDdgUrl(abs);
      if (real && /^https?:/i.test(real)) {
        window.App.navigate({ u: real });
      }
    });
  }

  function showError(resultsEl, err) {
    resultsEl.innerHTML =
      '<div class="search-error">' +
        '<p>けんさくにしっぱいしました。</p>' +
        '<p class="search-error-detail"><small>' + esc(String((err && err.message) || err)) + '</small></p>' +
        '<p><a href="#" data-back-home>ホームへもどる</a></p>' +
      '</div>';
    const back = resultsEl.querySelector('[data-back-home]');
    if (back) {
      back.addEventListener('click', (e) => {
        e.preventDefault();
        window.App.navigate({});
      });
    }
  }

  async function render(container, ctx) {
    // 検索履歴に記録（HOMEのサジェストで再利用）
    if (ctx.query && window.Storage && typeof window.Storage.addSearchHistory === 'function') {
      window.Storage.addSearchHistory(ctx.query);
    }

    container.innerHTML =
      '<section class="search">' +
        '<h2 class="search-heading">「' + esc(ctx.query) + '」のけんさくけっか</h2>' +
        '<div class="search-results" data-search-results>' +
          '<p class="search-loading">よみこみちゅう…</p>' +
        '</div>' +
      '</section>';

    const resultsEl = container.querySelector('[data-search-results]');
    const reqId = ++currentReqId;

    try {
      const html = await fetchHtml(buildSearchUrl(ctx.query));
      if (reqId !== currentReqId) return; // ナビゲーションが進んだので破棄

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const links = doc.getElementById('links');

      if (!links || links.querySelectorAll('.result__a').length === 0) {
        resultsEl.innerHTML =
          '<p class="search-empty">「' + esc(ctx.query) + '」のけっかは見つかりませんでした。</p>';
        return;
      }

      // 安全のため危険要素を除去
      links.querySelectorAll('script, iframe, noscript, style, form').forEach((el) => el.remove());

      // 相対URLをDDG基準で絶対化（ローカルへの404防止）
      absolutizeUrls(links, 'https://html.duckduckgo.com/');

      // favicon等のロード失敗（DDG外部サービスが持っていない場合等）は
      // 画像を非表示にして「壊れた画像アイコン」を見せないようにする
      links.querySelectorAll('img').forEach((img) => {
        img.addEventListener('error', () => { img.style.display = 'none'; }, { once: true });
      });

      resultsEl.innerHTML = '';
      resultsEl.appendChild(links);

      attachClickHandler(resultsEl);

      // ふりがなは結果描画後に非同期で（結果クリックは即時可能）
      applyFurigana(resultsEl, ctx, reqId);
    } catch (err) {
      if (reqId !== currentReqId) return;
      console.error('Search failed:', err);
      showError(resultsEl, err);
    }
  }

  return {
    render,
    buildSearchUrl,
    unwrapDdgUrl,
  };
})();
