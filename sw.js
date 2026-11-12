/* 离线缓存：仅在 http(s) 下注册生效；file:// 打开时浏览器会忽略。 */
var CACHE = 'ru-grammar-cards-v1';

var ASSETS = [
  './', './index.html', './styles.css', './app.js',
  './manifest.webmanifest', './favicon.svg',
  './data/book.js', './data/lessons.js'
];

for (var i = 1; i <= 24; i++) {
  ASSETS.push('./data/u' + (i < 10 ? '0' + i : i) + '.js');
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(ASSETS);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (resp) {
        var copy = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return resp;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
