// ==============================================================================
// Service Worker: wind-ensemble-attendance
// キャッシュバージョン: v99 (Safari PWAキャッシュ強制破棄バージョン)
// ==============================================================================
const CACHE_NAME = 'app-cache-v99';

// プリキャッシュするコアアセット
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

// 1. インストール時: 待機状態 (waiting) にならず即座にアクティベート
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing version:', CACHE_NAME);
  // 新しいService Workerを即時有効化（waiting状態を回避）
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // ネットワークから直接最新のアセットを取得してプリキャッシュ（ブラウザHTTPキャッシュをバイパス）
      await Promise.all(
        PRECACHE_ASSETS.map((url) =>
          fetch(url, { cache: 'reload' })
            .then((res) => {
              if (res && res.status === 200) {
                return cache.put(url, res);
              }
            })
            .catch((err) => {
              console.warn('[ServiceWorker] Precache warning for:', url, err);
            })
        )
      );
    })
  );
});

// 2. アクティベート時: self.clients.claim() で即時制御 & 古いキャッシュの完全削除
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating version:', CACHE_NAME);
  event.waitUntil(
    (async () => {
      // 制御下の全クライアントページを即座に引き継ぐ
      await self.clients.claim();

      // 現在の CACHE_NAME 以外の古いキャッシュをすべて削除
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );

      // 開いている全ウィンドウクライアントに「最新版適用完了」を通知
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.postMessage({
          type: 'SW_UPDATED',
          version: CACHE_NAME,
        });
      }
    })()
  );
});

// クライアントからの明示的スキップ要求・キャッシュ削除要求に応答
self.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data === 'skipWaiting')) {
    self.skipWaiting();
  }
  if (event.data && (event.data.type === 'CLEAR_CACHE' || event.data.type === 'CLEAR_ALL_CACHES')) {
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => {
      if (event.source) {
        event.source.postMessage({ type: 'CACHE_CLEARED' });
      }
    });
  }
});

// 3. フェッチ時: Network First（ネットワーク優先、オフライン時のみキャッシュフォールバック）
// PWA起動時に古いキャッシュが表示され続けるのを完全に防止し、最新のコードを確実に取得
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // GETリクエスト以外はキャッシュしない
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 非httpスキームは無視
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API、Firebase、外部認可エンドポイント、Vite開発サーバー内部リソース等はキャッシュ対象外
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('worksmobile') ||
    url.pathname === '/health'
  ) {
    return;
  }

  // ページ遷移（HTMLナビゲーション）: 必ずNetwork Firstで最新を取得
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone).catch(() => {});
            });
          }
          return networkResponse;
        } catch (error) {
          console.log('[ServiceWorker] Offline navigation fallback:', request.url);
          const cachedResponse =
            (await caches.match(request)) ||
            (await caches.match('/index.html')) ||
            (await caches.match('/'));
          if (cachedResponse) {
            return cachedResponse;
          }
          throw error;
        }
      })()
    );
    return;
  }

  // その他のリソース（JS, CSS, 画像等）: Network First
  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(request);
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (networkResponse.type === 'basic' || networkResponse.type === 'cors')
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone).catch(() => {});
          });
        }
        return networkResponse;
      } catch (error) {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        throw error;
      }
    })()
  );
});
