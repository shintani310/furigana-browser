// ブラウザヘッダー: 戻る/進む/ホーム/アドレスバー/再読込/モード/学年
window.BrowserChrome = (function () {
  'use strict';

  const esc = (s) => window.App.escapeHtml(s);

  function isUrl(s) {
    return /^https?:\/\//i.test(s);
  }

  function getAddressValue(ctx) {
    if (ctx.state === 'browse') return ctx.url;
    if (ctx.state === 'search') return ctx.query;
    return '';
  }

  function buildGradeOptions(currentGrade) {
    let html = '';
    for (let g = 1; g <= 6; g++) {
      const sel = (g === currentGrade) ? ' selected' : '';
      html += '<option value="' + g + '"' + sel + '>' + g + 'ねん</option>';
    }
    return html;
  }

  function render(container, ctx) {
    const addressValue = getAddressValue(ctx);
    const grade = ctx.grade || window.Storage.getGrade();
    const isBrowse = ctx.state === 'browse';
    const mode = ctx.mode || window.Storage.getMode();
    const modeIcon = (mode === 'fullcopy') ? '🖼' : '📖';
    const modeLabel = (mode === 'fullcopy') ? 'そのまま' : 'よみやすく';
    const isFav = isBrowse ? window.Storage.isFavorite(ctx.url) : false;
    const favIcon = isFav ? '★' : '☆';
    const favLabel = isFav ? 'おきにいりからはずす' : 'おきにいりにいれる';

    container.innerHTML =
      '<div class="chrome-bar">' +
        '<button type="button" class="chrome-btn" data-back title="もどる" aria-label="もどる">←</button>' +
        '<button type="button" class="chrome-btn" data-forward title="すすむ" aria-label="すすむ">→</button>' +
        '<button type="button" class="chrome-btn" data-home title="ホーム" aria-label="ホーム">⌂</button>' +
        '<form class="chrome-address-form" data-address-form>' +
          '<input type="text" class="chrome-address" data-address ' +
            'value="' + esc(addressValue) + '" ' +
            'placeholder="けんさく または URL" ' +
            'autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" />' +
        '</form>' +
        '<button type="button" class="chrome-btn" data-reload title="さいよみこみ" aria-label="さいよみこみ">↻</button>' +
        (isBrowse
          ? '<button type="button" class="chrome-btn chrome-mode" data-mode ' +
              'data-current-mode="' + esc(mode) + '" ' +
              'title="ひょうじモードきりかえ" aria-label="ひょうじモードきりかえ">' +
              modeIcon + ' ' + esc(modeLabel) +
            '</button>' +
            '<button type="button" class="chrome-btn chrome-fav' + (isFav ? ' active' : '') + '" data-fav ' +
              'title="' + esc(favLabel) + '" aria-label="' + esc(favLabel) + '">' +
              favIcon +
            '</button>'
          : '') +
        '<select class="chrome-grade" data-grade aria-label="がくねん">' +
          buildGradeOptions(grade) +
        '</select>' +
      '</div>';

    bindHandlers(container, ctx);
  }

  function bindHandlers(container, ctx) {
    const back = container.querySelector('[data-back]');
    if (back) back.addEventListener('click', () => history.go(-1));

    const forward = container.querySelector('[data-forward]');
    if (forward) forward.addEventListener('click', () => history.go(1));

    const home = container.querySelector('[data-home]');
    if (home) home.addEventListener('click', () => window.App.navigate({}));

    const reload = container.querySelector('[data-reload]');
    if (reload) reload.addEventListener('click', () => window.App.render());

    const addressForm = container.querySelector('[data-address-form]');
    if (addressForm) {
      addressForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = addressForm.querySelector('[data-address]');
        const v = (input && input.value || '').trim();
        if (!v) return;
        if (isUrl(v)) {
          window.App.navigate({ u: v });
        } else {
          window.App.navigate({ q: v });
        }
      });
    }
    const addressInput = container.querySelector('[data-address]');
    if (addressInput) {
      addressInput.addEventListener('focus', () => {
        try { addressInput.select(); } catch (_) { /* noop */ }
      });
    }

    const modeBtn = container.querySelector('[data-mode]');
    if (modeBtn && ctx.state === 'browse') {
      modeBtn.addEventListener('click', () => {
        const current = modeBtn.getAttribute('data-current-mode');
        const next = (current === 'fullcopy') ? 'extract' : 'fullcopy';
        window.Storage.setMode(next);
        // replaceState で履歴を増やさず mode を書き換え
        const params = { u: ctx.url, mode: next };
        if (ctx.grade) params.grade = ctx.grade;
        window.App.navigate(params, true);
      });
    }

    const favBtn = container.querySelector('[data-fav]');
    if (favBtn && ctx.state === 'browse') {
      favBtn.addEventListener('click', () => {
        const url = ctx.url;
        const wasFav = window.Storage.isFavorite(url);
        if (wasFav) {
          window.Storage.removeFavorite(url);
        } else {
          // タイトルが取得済みならそれを使用、未取得ならURLをタイトル代用に
          const title = (window.BrowseView && window.BrowseView.getCurrentUrl &&
                         window.BrowseView.getCurrentUrl() === url &&
                         window.BrowseView.getCurrentTitle())
                        ? window.BrowseView.getCurrentTitle()
                        : url;
          window.Storage.addFavorite({ url, title });
        }
        // 表示更新
        const nowFav = !wasFav;
        favBtn.textContent = nowFav ? '★' : '☆';
        favBtn.classList.toggle('active', nowFav);
        const label = nowFav ? 'おきにいりからはずす' : 'おきにいりにいれる';
        favBtn.setAttribute('title', label);
        favBtn.setAttribute('aria-label', label);
      });
    }

    const gradeSelect = container.querySelector('[data-grade]');
    if (gradeSelect) {
      gradeSelect.addEventListener('change', () => {
        const g = parseInt(gradeSelect.value, 10);
        if (!(g >= 1 && g <= 6)) return;
        window.Storage.setGrade(g);
        if (ctx.state === 'browse') {
          const params = { u: ctx.url, grade: g };
          if (ctx.mode) params.mode = ctx.mode;
          window.App.navigate(params, true);
        } else if (ctx.state === 'search') {
          window.App.navigate({ q: ctx.query, grade: g }, true);
        } else {
          window.App.render();
        }
      });
    }
  }

  return { render };
})();
