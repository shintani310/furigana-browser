// BROWSE state: 任意ページを extract または fullcopy モードで表示
window.BrowseView = (function () {
  'use strict';

  const esc = (s) => window.App.escapeHtml(s);

  let fullcopyListenerAttached = false;
  let currentReqId = 0;
  // 直近に開いたページのタイトル（お気に入り追加時の表示名に使う）
  let currentPageTitle = null;
  let currentPageUrl = null;

  function getCurrentTitle() {
    return currentPageTitle;
  }
  function getCurrentUrl() {
    return currentPageUrl;
  }

  // 現URLに明示された mode/grade をリンク遷移にも引き継ぐ
  // （fullcopyで開いたページからのリンクはfullcopyのまま、など）
  function buildBrowseNavParams(url) {
    const p = new URLSearchParams(location.search);
    const params = { u: url };
    const mode = p.get('mode');
    if (mode === 'extract' || mode === 'fullcopy') params.mode = mode;
    const grade = p.get('grade');
    if (grade) params.grade = grade;
    return params;
  }

  // fullcopy iframe からの postMessage 受信を1度だけ仕掛ける（多重登録防止）
  function ensureFullcopyListener() {
    if (fullcopyListenerAttached) return;
    window.LinkRouter.attachFullcopyListener((url) => {
      // 受信時に現在のstateを再確認してから遷移（古いiframeからの遅延メッセージ対策）
      const ctx = window.App.parseLocation();
      if (ctx.state === 'browse') {
        window.App.navigate(buildBrowseNavParams(url));
      }
    });
    fullcopyListenerAttached = true;
  }

  function showProgress(progressEl, msg, done, total) {
    if (!progressEl) return;
    let html = '<div class="browse-progress">';
    html += '<p class="browse-progress-msg">' + esc(msg) + '</p>';
    if (typeof done === 'number' && typeof total === 'number' && total > 0) {
      const pct = Math.min(100, Math.round((done / total) * 100));
      html += '<p class="browse-progress-count">' + done + ' / ' + total + ' (' + pct + '%)</p>';
    }
    html += '</div>';
    progressEl.innerHTML = html;
  }

  function showError(contentEl, err, ctx) {
    contentEl.innerHTML =
      '<div class="browse-error">' +
        '<p>ページのよみこみにしっぱいしました。</p>' +
        '<p class="browse-error-detail"><small>' + esc(String((err && err.message) || err)) + '</small></p>' +
        '<p class="browse-error-url"><small>URL: ' + esc(ctx && ctx.url || '') + '</small></p>' +
        '<p>' +
          '<a href="#" data-back-home>ホームへもどる</a>' +
        '</p>' +
      '</div>';
    const back = contentEl.querySelector('[data-back-home]');
    if (back) {
      back.addEventListener('click', (e) => { e.preventDefault(); window.App.navigate({}); });
    }
  }

  async function renderExtract(contentEl, ctx, reqId) {
    showProgress(contentEl, 'ページをよみこみちゅう…');

    const grades = await window.App.loadKanjiGrades();
    if (reqId !== currentReqId) return;

    showProgress(contentEl, 'ほんぶんをちゅうしゅつちゅう…');
    const { title, container } = await window.Extractor.extractContent(ctx.url);
    if (reqId !== currentReqId) return;

    window.Storage.addHistory({ url: ctx.url, title });
    currentPageTitle = title;
    currentPageUrl = ctx.url;

    showProgress(contentEl, 'ふりがな辞書をよみこみちゅう…(はじめての時は時間がかかります)');
    await window.Furigana.init();
    if (reqId !== currentReqId) return;

    await window.Furigana.addFuriganaToDOM(container, grades, (done, total) => {
      if (reqId !== currentReqId) return;
      showProgress(contentEl, 'ふりがなをつけています', done, total);
    });
    if (reqId !== currentReqId) return;

    window.Furigana.applyGradeFilter(container, ctx.grade);

    contentEl.innerHTML = '';
    const titleEl = document.createElement('h1');
    titleEl.className = 'browse-title';
    titleEl.textContent = title;
    contentEl.appendChild(titleEl);

    container.classList.add('browse-content');
    contentEl.appendChild(container);

    window.LinkRouter.attachExtractClick(container, (url) => {
      window.App.navigate(buildBrowseNavParams(url));
    });
  }

  async function renderFullcopy(contentEl, ctx, reqId) {
    showProgress(contentEl, 'ふりがな辞書をよみこみちゅう…(はじめての時は時間がかかります)');

    const grades = await window.App.loadKanjiGrades();
    if (reqId !== currentReqId) return;

    await window.Furigana.init();
    if (reqId !== currentReqId) return;

    // iframe + 進捗オーバーレイ を準備
    contentEl.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.className = 'browse-iframe';
    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts');
    contentEl.appendChild(iframe);

    const progressEl = document.createElement('div');
    progressEl.className = 'browse-progress-overlay';
    contentEl.appendChild(progressEl);
    showProgress(progressEl, 'ページを取得中…');

    ensureFullcopyListener();

    const { title } = await window.FullCopy.load(ctx.url, grades, ctx.grade, iframe, (p) => {
      if (reqId !== currentReqId) return;
      if (p.phase === 'fetch') showProgress(progressEl, 'ページを取得中…');
      else if (p.phase === 'parse') showProgress(progressEl, 'ページをかいせきちゅう…');
      else if (p.phase === 'furigana') showProgress(progressEl, 'ふりがなをつけています', p.done, p.total);
      else if (p.phase === 'render') showProgress(progressEl, 'ひょうじしています…');
    });
    if (reqId !== currentReqId) return;

    progressEl.remove();
    window.Storage.addHistory({ url: ctx.url, title });
    currentPageTitle = title;
    currentPageUrl = ctx.url;
  }

  function render(container, ctx) {
    const reqId = ++currentReqId;

    container.innerHTML =
      '<section class="browse">' +
        '<div class="browse-content-area" data-browse-content></div>' +
      '</section>';

    const contentEl = container.querySelector('[data-browse-content]');

    const runner = ctx.mode === 'fullcopy'
      ? renderFullcopy(contentEl, ctx, reqId)
      : renderExtract(contentEl, ctx, reqId);

    runner.catch((err) => {
      if (reqId !== currentReqId) return;
      console.error('Browse failed:', err);
      showError(contentEl, err, ctx);
    });
  }

  return { render, getCurrentTitle, getCurrentUrl };
})();
