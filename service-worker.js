const CACHE_NAME = 'nutritrack-v4';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/design-system.css',
  './css/components.css',
  './css/pages.css',
  './js/storage.js',
  './js/api.js',
  './js/charts.js',
  './js/dashboard.js',
  './js/food-log.js',
  './js/exercise-log.js',
  './js/meal-planner.js',
  './js/history.js',
  './js/nutrients.js',
  './js/firebase-config.js',
  './js/app.js',
  './js/firebase-sync.js',
  './images/icon-192.png',
  './images/icon-512.png'
];

// Install Event - Pre-cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Cache-First for static assets, Network-First for API requests
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Skip Firebase and Gemini API network requests (do not cache them)
  if (
    event.request.method !== 'GET' ||
    requestUrl.origin.includes('googleapis.com') ||
    requestUrl.origin.includes('firebaseapp.com') ||
    requestUrl.origin.includes('identitytoolkit') ||
    requestUrl.origin.includes('firebase')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Handle local assets and fonts
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached asset, fetch in background to update cache (stale-while-revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {/* ignore background update failures */});

        return cachedResponse;
      }

      // Fetch from network and cache
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Fallback for document navigation if offline
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
