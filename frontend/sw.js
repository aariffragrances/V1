/**
 * Aarif Fragrances — Advanced Service Worker
 * High-performance Cache-First image delivery with instant 0ms disk cache,
 * intelligent font caching, offline navigation resilience, and automatic LRU cache management.
 */

const STATIC_CACHE = 'aarif-static-v113';
const IMAGE_CACHE  = 'aarif-images-v3';
const MAX_IMAGE_ENTRIES = 150;

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/products.html',
  '/product.html',
  '/basket.html',
  '/wishlist.html',
  '/about.html',
  '/contact.html',
  '/policies.html',
  '/css/main.css',
  '/js/data-loader.js',
  '/js/product-card.js',
  '/js/product-page.js',
  '/js/home-sections.js',
  '/js/shopping-store.js',
  '/js/modal.js',
  '/js/navigation.js',
  '/js/site-settings.js',
  '/js/filters.js',
  '/js/main.js',
  '/data/bootstrap.json',
];

// Helper: Trim cache to limit size (LRU eviction)
async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const deleteCount = keys.length - maxItems;
      for (let i = 0; i < deleteCount; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch (_) {}
}

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

  // Skip transactional API routes, docs, and admin portal
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/docs') ||
    url.pathname.startsWith('/redoc') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.includes('admin')
  ) {
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
              trimCache(IMAGE_CACHE, MAX_IMAGE_ENTRIES);
            }
          }).catch(() => {});
          return cached;
        }

        // Cache miss: fetch from network and store in cache
        return fetch(req).then((netRes) => {
          if (netRes && (netRes.ok || netRes.type === 'opaque')) {
            cache.put(req, netRes.clone());
            trimCache(IMAGE_CACHE, MAX_IMAGE_ENTRIES);
          }
          return netRes;
        }).catch(() => cached);
      })
    );
    return;
  }

  // 2. Web Fonts & CDNs (Google Fonts, cdnjs): Cache-First for instant typography
  const isFontOrCdn =
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    /\.(woff2|woff|ttf|otf|eot)$/i.test(url.pathname);

  if (isFontOrCdn) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
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

  // 3. Static CSS / JS / JSON: Stale-While-Revalidate
  if (/\.(css|js|json)$/i.test(url.pathname)) {
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

  // 4. HTML Navigation: Network-First with Cache and Offline Fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        return (await caches.match('/index.html')) || (await caches.match('/'));
      })
    );
    return;
  }
});
