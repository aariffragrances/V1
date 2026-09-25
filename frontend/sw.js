/**
 * Aarif Fragrances — Production Service Worker
 * High-performance Cache-First image delivery with instant 0ms disk cache for Cloudinary and local assets.
 */

const STATIC_CACHE = 'aarif-static-v3';
const IMAGE_CACHE  = 'aarif-images-v2';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/products.html',
  '/basket.html',
  '/wishlist.html',
  '/css/main.css',
  '/js/data-loader.js',
  '/js/product-card.js',
  '/js/home-sections.js',
  '/js/shopping-store.js',
  '/js/modal.js',
  '/js/navigation.js',
  '/js/site-settings.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS.map((url) => new Request(url, { cache: 'reload' }))).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== IMAGE_CACHE) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip transactional API routes
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/docs') || url.pathname.startsWith('/redoc')) {
    return;
  }

  // 1. Cloudinary and local images: Cache-First with Background Stale-While-Revalidate
  const isCloudinary = url.hostname.includes('cloudinary.com');
  const isLocalImage = url.pathname.includes('/assets/') || /\.(png|jpg|jpeg|webp|svg|ico)$/i.test(url.pathname);

  if (isCloudinary || isLocalImage) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) {
          // Serve immediately from cache, update in background
          fetch(req).then((netRes) => {
            if (netRes && (netRes.ok || netRes.type === 'opaque')) {
              cache.put(req, netRes);
            }
          }).catch(() => {});
          return cached;
        }

        // Cache miss: fetch from network and store in cache
        return fetch(req).then((netRes) => {
          if (netRes && (netRes.ok || netRes.type === 'opaque')) {
            cache.put(req, netRes.clone());
          }
          return netRes;
        }).catch(() => cached);
      })
    );
    return;
  }

  // 2. Static CSS / JS / Fonts: Stale-While-Revalidate
  if (/\.(css|js|woff2|woff|ttf)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const fetchPromise = fetch(req).then((netRes) => {
          if (netRes && netRes.ok) {
            cache.put(req, netRes.clone());
          }
          return netRes;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }
});
