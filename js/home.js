// HOME state: 検索バー + おきにいり + りれき
window.HomeView = (function () {
  'use strict';

  const esc = (s) => window.App.escapeHtml(s);

  function renderList(items, emptyMsg, listType) {
    if (!items || items.length === 0) {
      return '<p class="empty">' + esc(emptyMsg) + '</p>';
    }
    const lis = items.map((it) => {
      const title = it.title || it.url;
      return (
        '<li class="entry">' +
          '<a href="#" class="entry-link" data-url="' + esc(it.url) + '">' +
            '<span class="entry-title">' + esc(title) + '</span>' +
            '<span class="entry-url">' + esc(it.url) + '</span>' +
          '</a>' +
          '<button type="button" class="entry-delete" ' +
            'data-delete-url="' + esc(it.url) + '" ' +
            'data-list-type="' + esc(listType) + '" ' +
            'title="けす" aria-label="けす">×</button>' +
        '</li>'
      );
    });
    return '<ul class="entry-list">' + lis.join('') + '</ul>';
  }

  function bindSearchForm(container) {
    const form = container.querySelector('[data-search-form]');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input[name="q"]');
      const q = (input && input.value || '').trim();
      if (!q) return;
      window.App.navigate({ q });
    });

    // 検索履歴サジェスト
    const input = form.querySelector('.search-input');
    const sugList = form.querySelector('[data-search-suggestions]');
    if (!input || !sugList) return;

    function renderSuggestions(filter) {
      const all = window.Storage.getSearchHistory ? window.Storage.getSearchHistory() : [];
      const f = (filter || '').toLowerCase();
      const matches = f
        ? all.filter((q) => q.toLowerCase().includes(f))
        : all;
      if (matches.length === 0) {
        sugList.hidden = true;
        sugList.innerHTML = '';
        return;
      }
      sugList.innerHTML = matches.slice(0, 10).map((q) =>
        '<li class="search-sug">' +
          '<button type="button" class="search-sug-pick" data-q="' + esc(q) + '">' + esc(q) + '</button>' +
          '<button type="button" class="search-sug-del" data-q="' + esc(q) + '" aria-label="けす">×</button>' +
        '</li>'
      ).join('');
      sugList.hidden = false;
    }

    input.addEventListener('focus', () => renderSuggestions(input.value));
    input.addEventListener('input', () => renderSuggestions(input.value));
    input.addEventListener('blur', () => {
      // クリック完了を待ってから隠す
      setTimeout(() => { sugList.hidden = true; }, 150);
    });

    // mousedownでpreventDefaultしておくとblurが発火せず候補クリックが安定する
    sugList.addEventListener('mousedown', (e) => { e.preventDefault(); });
    sugList.addEventListener('click', (e) => {
      const pick = e.target.closest('.search-sug-pick');
      if (pick) {
        e.preventDefault();
        const q = pick.getAttribute('data-q');
        if (q) window.App.navigate({ q });
        return;
      }
      const del = e.target.closest('.search-sug-del');
      if (del) {
        e.preventDefault();
        e.stopPropagation();
        const q = del.getAttribute('data-q');
        if (q) window.Storage.removeSearchHistory(q);
        renderSuggestions(input.value);
        input.focus();
        return;
      }
    });
  }

  function bindEntryClicks(container) {
    // bindSearchForm と同様、innerHTML で再生成される要素 (.home) に attach する
    // ことで再描画のたびに古いlistenerが消滅し、重複登録を防ぐ
    // （#app に直接 attach すると render の度にリスナーが累積し、confirm が多重発火する）
    const root = container.querySelector('.home');
    if (!root) return;
    root.addEventListener('click', (e) => {
      // 削除ボタンを優先
      const delBtn = e.target.closest('.entry-delete');
      if (delBtn) {
        e.preventDefault();
        e.stopPropagation();
        const url = delBtn.getAttribute('data-delete-url');
        const type = delBtn.getAttribute('data-list-type');
        if (!url || !type) return;
        const msg = (type === 'fav') ? 'おきにいりからはずしますか？' : 'りれきから消しますか？';
        if (!window.confirm(msg)) return;
        if (type === 'fav') window.Storage.removeFavorite(url);
        else window.Storage.removeHistory(url);
        window.App.render();
        return;
      }
      // 通常のエントリクリック
      const a = e.target.closest('.entry-link');
      if (!a) return;
      e.preventDefault();
      const url = a.getAttribute('data-url');
      if (url) window.App.navigate({ u: url });
    });
  }

  function render(container /* , ctx */) {
    const favorites = window.Storage.getFavorites();
    const history = window.Storage.getHistory();

    container.innerHTML =
      '<section class="home">' +
        '<h1 class="home-title">ふりがなブラウザ</h1>' +
        '<form class="search-form" data-search-form>' +
          '<div class="search-input-wrap">' +
            '<input type="search" name="q" class="search-input" ' +
              'placeholder="しらべたいことばをいれてね" ' +
              'autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" required />' +
            '<ul class="search-suggestions" data-search-suggestions hidden></ul>' +
          '</div>' +
          '<button type="submit" class="search-submit">けんさく</button>' +
        '</form>' +
        '<section class="home-section">' +
          '<h2 class="home-section-title">おきにいり</h2>' +
          renderList(favorites, 'まだおきにいりはありません', 'fav') +
        '</section>' +
        '<section class="home-section">' +
          '<h2 class="home-section-title">りれき</h2>' +
          renderList(history, 'まだりれきはありません', 'hist') +
        '</section>' +
      '</section>';

    bindSearchForm(container);
    bindEntryClicks(container);

    // 入力欄にフォーカス（モバイルではキーボードが出るのでautofocusは付けない）
    const input = container.querySelector('.search-input');
    if (input && !('ontouchstart' in window)) {
      input.focus();
    }
  }

  return { render };
})();
