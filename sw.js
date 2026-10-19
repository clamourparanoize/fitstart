// Service Worker: hält die App offline verfügbar.
// Bei jeder neuen Version VERSION erhöhen, damit Handys die neuen Dateien laden.
const VERSION = 'fitstart-v2';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './js/main.js',
  './js/nav.js',
  './js/ui.js',
  './js/store.js',
  './js/feedback.js',
  './js/exercises.js',
  './js/plans.js',
  './js/stats.js',
  './js/gamification.js',
  './js/session.js',
  './js/charts.js',
  './js/views/common.js',
  './js/views/home.js',
  './js/views/plans.js',
  './js/views/editor.js',
  './js/views/library.js',
  './js/views/progress.js',
  './js/views/achievements.js',
  './js/views/settings.js',
  './js/views/player.js',
  './js/views/summary.js',
  './js/views/log.js',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' umgeht den HTTP-Cache, damit wirklich die neuen Dateien geladen werden
  event.waitUntil(caches.open(VERSION)
    .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      if (res.ok) caches.open(VERSION).then((cache) => cache.put(req, copy));
      return res;
    }).catch(() => caches.match('./index.html'))),
  );
});
