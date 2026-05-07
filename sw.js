// Service Worker: アプリシェル + 辞書のキャッシュ
// バージョン更新時は CACHE_NAME のサフィックスを上げる
const CACHE_NAME = 'furigana-browser-v3';

// 必須シェル: 失敗したら install を中断する
// 注: manifest.webmanifest と icons/ は Chrome の PWA レイヤーが直接管理するため
//     SW で介在しない（cacheしない・fetchも介在しない）。SWに挟むと Chrome の
//     installability check が壊れて DevTools の Manifest panel から icons が消える
//     既知の症状を起こす。
const ESSENTIAL_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/storage.js',
  './js/furigana.js',
  './js/extractor.js',
  './js/fullcopy.js',
  './js/linkrouter.js',
  './js/app.js',
  './js/home.js',
  './js/search.js',
  './js/browse.js',
  './js/browserchrome.js',
  './data/kanji-grades.json',
];

// dict 12ファイル(~17MB): 個別キャッシュ・失敗許容（一部欠損でも install を続行）
const DICT_FILES = [
  './dict/base.dat.gz',
  './dict/cc.dat.gz',
  './dict/check.dat.gz',
  './dict/tid.dat.gz',
  './dict/tid_map.dat.gz',
  './dict/tid_pos.dat.gz',
  './dict/unk.dat.gz',
  './dict/unk_char.dat.gz',
  './dict/unk_compat.dat.gz',
  './dict/unk_invoke.dat.gz',
  './dict/unk_map.dat.gz',
  './dict/unk_pos.dat.gz',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(ESSENTIAL_SHELL);
      // 辞書は個別 add で失敗許容
      await Promise.allSettled(DICT_FILES.map((f) => cache.add(f)));
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // GET 以外は介在しない
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 自オリジン以外（CDN/プロキシ/外部サイト）は介在しない
  if (url.origin !== self.location.origin) return;

  // PWA install assets（manifest / icons）は Chrome の PWA レイヤーに任せて介在しない
  if (url.pathname.endsWith('/manifest.webmanifest')) return;
  if (url.pathname.startsWith('/icons/')) return;

  // SPA: ナビゲーションは index.html にフォールバック
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch (_) {
          const cache = await caches.open(CACHE_NAME);
          const fallback = await cache.match('./index.html');
          return fallback || Response.error();
        }
      })()
    );
    return;
  }

  // その他の自オリジン GET: cache-first
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        // 成功したら静かに保存
        if (res && res.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      } catch (err) {
        return Response.error();
      }
    })()
  );
});
