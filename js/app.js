// SPAルーター + state管理
// HOME / SEARCH / BROWSE の3stateを history.pushState で切り替える。
// 各stateの描画は対応するViewモジュール (HomeView/SearchView/BrowseView) に委譲。
// Viewモジュールが未ロードの場合はプレースホルダを表示する（段階実装のため）。
window.App = (function () {
  'use strict';

  const APP_EL_ID = 'app';

  function getAppEl() {
    return document.getElementById(APP_EL_ID);
  }

  function parseLocation() {
    const p = new URLSearchParams(location.search);
    const u = p.get('u');
    const q = p.get('q');
    const grade = parseInt(p.get('grade'), 10);
    const mode = p.get('mode');

    if (u) {
      return {
        state: 'browse',
        url: u,
        mode: (mode === 'extract' || mode === 'fullcopy') ? mode : Storage.getMode(),
        grade: (grade >= 1 && grade <= 6) ? grade : Storage.getGrade(),
      };
    }
    if (q) {
      return {
        state: 'search',
        query: q,
        grade: (grade >= 1 && grade <= 6) ? grade : Storage.getGrade(),
      };
    }
    return { state: 'home' };
  }

  function buildUrl(params) {
    const keys = Object.keys(params || {});
    if (keys.length === 0) return './';
    const sp = new URLSearchParams();
    keys.forEach((k) => {
      const v = params[k];
      if (v === undefined || v === null || v === '') return;
      sp.set(k, String(v));
    });
    const qs = sp.toString();
    return qs ? './?' + qs : './';
  }

  function navigate(params, replace) {
    const url = buildUrl(params);
    if (replace) history.replaceState(params || {}, '', url);
    else history.pushState(params || {}, '', url);
    render();
  }

  function renderPlaceholder(ctx) {
    const el = getAppEl();
    if (!el) return;
    const lines = ['<section class="placeholder">'];
    lines.push('<h2>state: ' + ctx.state + '</h2>');
    if (ctx.state === 'search') lines.push('<p>query: ' + escapeHtml(ctx.query) + '</p>');
    if (ctx.state === 'browse') lines.push('<p>url: ' + escapeHtml(ctx.url) + '</p>');
    lines.push('<p><a href="./" data-nav-home>ホームへ</a></p>');
    lines.push('</section>');
    el.innerHTML = lines.join('');
    const homeLink = el.querySelector('[data-nav-home]');
    if (homeLink) {
      homeLink.addEventListener('click', (e) => {
        e.preventDefault();
        navigate({});
      });
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function render() {
    const ctx = parseLocation();
    const el = getAppEl();
    if (!el) return;

    // ブラウザヘッダー（あれば）を先に描画
    const chromeEl = document.getElementById('chrome');
    if (chromeEl && window.BrowserChrome && typeof window.BrowserChrome.render === 'function') {
      window.BrowserChrome.render(chromeEl, ctx);
    }

    // Viewモジュールがあれば委譲、無ければプレースホルダ
    if (ctx.state === 'home' && window.HomeView && typeof window.HomeView.render === 'function') {
      window.HomeView.render(el, ctx);
    } else if (ctx.state === 'search' && window.SearchView && typeof window.SearchView.render === 'function') {
      window.SearchView.render(el, ctx);
    } else if (ctx.state === 'browse' && window.BrowseView && typeof window.BrowseView.render === 'function') {
      window.BrowseView.render(el, ctx);
    } else {
      renderPlaceholder(ctx);
    }
  }

  // 学年漢字辞書（複数Viewで共有するためApp名前空間で一元管理）
  let kanjiGrades = null;
  let kanjiGradesPromise = null;
  function loadKanjiGrades() {
    if (kanjiGrades) return Promise.resolve(kanjiGrades);
    if (kanjiGradesPromise) return kanjiGradesPromise;
    kanjiGradesPromise = fetch('./data/kanji-grades.json')
      .then((r) => {
        if (!r.ok) throw new Error('kanji-grades.json 取得失敗 (' + r.status + ')');
        return r.json();
      })
      .then((data) => { kanjiGrades = data; return data; })
      .catch((err) => { kanjiGradesPromise = null; throw err; });
    return kanjiGradesPromise;
  }

  function init() {
    window.addEventListener('popstate', render);
    // 初回レンダリングは現在のURLに基づく
    render();
  }

  return {
    init,
    navigate,
    render,
    parseLocation,
    buildUrl,
    escapeHtml,
    loadKanjiGrades,
  };
})();
