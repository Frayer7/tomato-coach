// ── 版本号：每次更新代码时递增此数字 ──────────────────────────
const VERSION = 11;
// ─────────────────────────────────────────────────────────────

const CACHE_NAME = `tomato-coach-v${VERSION}`;
const STATIC_ASSETS = ['./index.html', './style.css', './app.js', './manifest.json', './sw.js'];

// install：预缓存静态资源，立即激活（skipWaiting）
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// activate：清理旧版本缓存，接管所有页面，然后通知页面有新版本
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => {
        clients.forEach((client) =>
          client.postMessage({ type: 'SW_UPDATED', version: VERSION })
        );
      })
  );
});

// fetch：Stale-While-Revalidate
// 同源 GET 请求：立即返回缓存（保证速度），同时后台发网络请求更新缓存（保证时效）
// 非同源请求（LLM API 等）直接走网络，不做任何拦截
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        // 无论有无缓存，都在后台发起网络请求更新缓存
        const networkFetch = fetch(event.request)
          .then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => null); // 离线时网络失败不影响返回缓存

        // 有缓存直接返回（快），没有缓存等网络响应
        return cached || networkFetch;
      })
    )
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow('./');
    })
  );
});