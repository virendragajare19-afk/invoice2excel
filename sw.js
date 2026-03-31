/* ============================================================
   Invoice2Excel Pro — Service Worker v1.0
   Provides: App Shell Caching + Offline Fallback
   ============================================================ */

const CACHE_NAME = 'inv2excel-v2.0';  // bumped: Supabase + Dashboard
const OFFLINE_URL = '/';

// Files to cache for offline use (app shell)
const APP_SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/invoice-generator.html',
  '/generator.css',
  '/generator-step1.js',
  '/generator-step2.js',
  '/generator-step3.js',
  '/templates.js',
  '/supabase.js',
  '/auth-callback.html',
  '/dashboard.html',
];

// External CDN resources to cache
const CDN_RESOURCES = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css',
];

/* ============================================================
   INSTALL EVENT — Cache App Shell
   ============================================================ */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell...');
      // Cache app shell files (ignore failures for individual files)
      return cache.addAll(APP_SHELL).catch(err => {
        console.warn('[SW] Some files could not be cached:', err);
      });
    }).then(() => {
      console.log('[SW] App shell cached');
      return self.skipWaiting();
    })
  );
});

/* ============================================================
   ACTIVATE EVENT — Clean old caches
   ============================================================ */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activated');
      return self.clients.claim();
    })
  );
});

/* ============================================================
   FETCH EVENT — Network First with Cache Fallback
   ============================================================ */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and browser-specific URLs
  if (!url.protocol.startsWith('http')) return;

  // Strategy: Network First for HTML, Cache First for assets
  if (event.request.mode === 'navigate') {
    // Navigation requests — network first, cache fallback
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the fresh response
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Offline: serve from cache
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            return caches.match(OFFLINE_URL);
          });
        })
    );
    return;
  }

  // CDN resources — cache first, network fallback
  if (url.hostname !== self.location.hostname) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        }).catch(() => {
          // Return empty response for failed CDN resources
          return new Response('', { status: 503, statusText: 'Offline' });
        });
      })
    );
    return;
  }

  // Local assets — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        return new Response('Resource not available offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      });
    })
  );
});

/* ============================================================
   BACKGROUND SYNC (future-ready)
   ============================================================ */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-conversions') {
    console.log('[SW] Background sync: conversions');
  }
});

/* ============================================================
   PUSH NOTIFICATIONS (future-ready)
   ============================================================ */
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Invoice2Excel Pro';
  const options = {
    body: data.body || 'Your invoice is ready to export!',
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-96.svg',
    tag: 'invoice-ready',
    renotify: true,
    data: data.url || '/',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});

console.log('[SW] Service Worker script loaded');
