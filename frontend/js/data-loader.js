'use strict';
/* ============================================================
   data-loader.js  — High-performance SWR Cache + API Catalog
   Instant 0ms LocalStorage hydration with background revalidation
   ============================================================ */

const STORAGE_KEY_META    = 'aarif_meta_cache_v2';
const STORAGE_KEY_CATALOG = 'aarif_cat_cache_v2';

const ALL_PERFUMES = [];
const PERFUME_BY_NAME = new Map();
const PERFUME_BY_ID   = new Map();
let   FRAGRANCE_TYPES  = [];
let   PROMOTION_BANNERS = [];
let   SITE_SETTINGS    = {};

let _dataReady = false;
let _metaReady = false;
let _dataPromise = null;
let _metaPromise = null;
let _isRevalidating = false;

/* ── Normalise one perfume object from API ──────────────────── */
function normaliseApiPerfume(p) {
  return {
    perfumeId:         p.perfumeId,
    fragranceTypeId:   p.fragranceTypeId,
    fragranceTypeName: p.fragranceTypeName || '',
    perfumeName:       p.perfumeName,
    displayName:       p.displayName || p.perfumeName,
    brand:             p.brand || '',
    description:       p.description || '',
    price6ml:          p.price6ml  != null ? Number(p.price6ml)  : null,
    price12ml:         p.price12ml != null ? Number(p.price12ml) : null,
    price30ml:         p.price30ml != null ? Number(p.price30ml) : null,
    price50ml:         p.price50ml != null ? Number(p.price50ml) : null,
    isAttar:           !!p.isAttar,
    isPerfume:         !!(p.isPerfume ?? p.perfumeSpray),
    isCarHanger:       !!(p.isCarHanger ?? p.isCarHangover),
    isFeatured:        !!p.isFeatured,
    isBestSeller:      !!p.isBestSeller,
    isNewArrival:      !!p.isNewArrival,
    primaryImageUrl:   p.primaryImageUrl || '',
    // helpers used by product-card.js
    productName:       p.perfumeName,   // alias so shared card code works
    categoryName:      p.fragranceTypeName || '',
    subCategoryName:   '',
  };
}

/* ── Build in-memory lookup maps ────────────────────────────── */
function rebuildLookups() {
  PERFUME_BY_NAME.clear();
  PERFUME_BY_ID.clear();
  ALL_PERFUMES.forEach(p => {
    PERFUME_BY_NAME.set(p.perfumeName, p);
    PERFUME_BY_NAME.set(p.perfumeName.toUpperCase(), p);
    PERFUME_BY_ID.set(p.perfumeId, p);
    PERFUME_BY_ID.set(String(p.perfumeId), p);
  });
}

/* ── Apply metadata (fragrance types, banners, settings) ────── */
function applyMetadata(data, persist = true) {
  if (!data) return;
  FRAGRANCE_TYPES   = data.fragranceTypes  || [];
  PROMOTION_BANNERS = data.promotionBanners || [];
  SITE_SETTINGS     = data.siteSettings    || {};

  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY_META, JSON.stringify({
        fragranceTypes:   FRAGRANCE_TYPES,
        promotionBanners: PROMOTION_BANNERS,
        siteSettings:     SITE_SETTINGS,
      }));
    } catch (_) {}
  }

  if (typeof applySiteSettings === 'function') applySiteSettings(SITE_SETTINGS);
  _metaReady = true;
  document.dispatchEvent(new CustomEvent('aarif:metadata-ready'));
}

/* ── Apply full product list ─────────────────────────────────── */
function applyCatalog(perfumes, persist = true) {
  if (!Array.isArray(perfumes)) return;
  ALL_PERFUMES.length = 0;
  perfumes.forEach(p => ALL_PERFUMES.push(normaliseApiPerfume(p)));
  rebuildLookups();

  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY_CATALOG, JSON.stringify(perfumes));
    } catch (_) {}
  }

  _dataReady = true;
  document.dispatchEvent(new CustomEvent('aarif:catalog-ready'));
}

/* ── Synchronous Instant Hydration from LocalStorage ─────────── */
function hydrateFromStorage() {
  try {
    const rawMeta = localStorage.getItem(STORAGE_KEY_META);
    if (rawMeta) {
      const parsed = JSON.parse(rawMeta);
      if (parsed && Array.isArray(parsed.fragranceTypes) && parsed.fragranceTypes.length > 0) {
        applyMetadata(parsed, false);
      }
    }

    const rawCat = localStorage.getItem(STORAGE_KEY_CATALOG);
    if (rawCat) {
      const parsed = JSON.parse(rawCat);
      if (Array.isArray(parsed) && parsed.length > 0) {
        applyCatalog(parsed, false);
      }
    }
  } catch (err) {
    console.warn('LocalStorage hydration failed:', err);
  }
}

// Hydrate immediately upon script parse for 0ms initial render
hydrateFromStorage();

/* ── Public: get promotion banners (used by home-sections.js) ── */
function getPromotionBanners() { return PROMOTION_BANNERS; }

/* ── Fetch helpers (API with seamless Netlify static fallback) ── */
async function fetchBootstrap() {
  try {
    const res = await fetch('/api/v1/catalog/bootstrap');
    if (res.ok) return await res.json();
  } catch (_) {}
  const fallback = await fetch('data/bootstrap.json');
  if (!fallback.ok) throw new Error('Catalog data unavailable');
  return fallback.json();
}

async function fetchMetadata() {
  try {
    const res = await fetch('/api/v1/catalog/metadata');
    if (res.ok) return await res.json();
  } catch (_) {}
  const fallback = await fetch('data/metadata.json');
  if (!fallback.ok) throw new Error('Metadata unavailable');
  return fallback.json();
}

async function fetchPerfumesBulk() {
  try {
    const res = await fetch('/api/v1/catalog/perfumes-bulk');
    if (res.ok) return await res.json();
  } catch (_) {}
  const fallback = await fetch('data/perfumes.json');
  if (!fallback.ok) throw new Error('Perfumes data unavailable');
  return fallback.json();
}

/* ── whenMetadataReady ───────────────────────────────────────── */
function whenMetadataReady() {
  if (_metaReady) return Promise.resolve();
  if (!_metaPromise) {
    _metaPromise = fetchMetadata()
      .then(applyMetadata)
      .catch(err => { _metaPromise = null; throw err; });
  }
  return _metaPromise;
}

/* ── whenCatalogReady ────────────────────────────────────────── */
function whenCatalogReady() {
  if (_dataReady) return Promise.resolve();
  if (!_dataPromise) {
    // Fast single-request bootstrap gets both metadata and catalog concurrently
    _dataPromise = fetchBootstrap()
      .then(data => {
        applyMetadata(data);
        applyCatalog(data.perfumes || []);
      })
      .catch(err => {
        console.warn('Bootstrap fetch failed, trying parallel split fetch:', err);
        return Promise.all([
          fetchMetadata().then(applyMetadata),
          fetchPerfumesBulk().then(d => applyCatalog(d.perfumes || []))
        ]).catch(e => { _dataPromise = null; throw e; });
      });
  }
  return _dataPromise;
}

/* ── Background Stale-While-Revalidate (SWR) ─────────────────── */
function revalidateInBackground() {
  if (_isRevalidating) return;
  _isRevalidating = true;

  // Small delay so initial DOM paint happens without any CPU competition
  setTimeout(() => {
    fetchBootstrap()
      .then(data => {
        let metaChanged = false;
        let catChanged = false;

        if (data && Array.isArray(data.fragranceTypes) && data.fragranceTypes.length > 0) {
          const freshMetaStr = JSON.stringify({
            fragranceTypes:   data.fragranceTypes,
            promotionBanners: data.promotionBanners || [],
            siteSettings:     data.siteSettings    || {},
          });
          if (localStorage.getItem(STORAGE_KEY_META) !== freshMetaStr) {
            applyMetadata(data, true);
            metaChanged = true;
          }
        }

        if (data && Array.isArray(data.perfumes) && data.perfumes.length > 0) {
          const freshCatStr = JSON.stringify(data.perfumes);
          if (localStorage.getItem(STORAGE_KEY_CATALOG) !== freshCatStr) {
            applyCatalog(data.perfumes, true);
            catChanged = true;
          }
        }

        if (metaChanged || catChanged) {
          document.dispatchEvent(new CustomEvent('aarif:data-revalidated', {
            detail: { metaChanged, catChanged }
          }));
        }
      })
      .catch(err => {
        // Silently keep cached data if network error
        console.debug('Background revalidation skipped:', err);
      })
      .finally(() => {
        _isRevalidating = false;
      });
  }, 100);
}

// Auto-trigger background revalidation if data was restored from cache
if (_dataReady && _metaReady) {
  revalidateInBackground();
}

/* ── Product flag getters ─────────────────────────────────────── */
function getFeaturedProducts(n)   { return ALL_PERFUMES.filter(p => p.isFeatured).slice(0, n || 50); }
function getBestSellerProducts(n) { return ALL_PERFUMES.filter(p => p.isBestSeller).slice(0, n || 50); }
function getNewArrivalProducts(n) { return ALL_PERFUMES.filter(p => p.isNewArrival).slice(0, n || 50); }

/* ── Resolve product by name (used by basket.js) ──────────────── */
function resolveStoredProductKey(key) {
  if (!key) return null;
  return PERFUME_BY_NAME.get(String(key)) || PERFUME_BY_NAME.get(String(key).toUpperCase()) || PERFUME_BY_ID.get(String(key)) || null;
}

/* ── Cart products (basket page) ─────────────────────────────── */
async function fetchCartProducts(names) {
  try {
    const joined = names.join(',');
    const res = await fetch('/api/v1/catalog/cart-perfumes?names=' + encodeURIComponent(joined));
    if (res.ok) {
      const data = await res.json();
      return (data.perfumes || []).map(normaliseApiPerfume);
    }
  } catch (_) {}
  const wanted = new Set((names || []).map(n => String(n).trim().toUpperCase()));
  return ALL_PERFUMES.filter(p => wanted.has(p.perfumeName.toUpperCase()));
}

function mergeProductsIntoCatalog(products) {
  (products || []).forEach(raw => {
    const p = normaliseApiPerfume(raw);
    if (!PERFUME_BY_NAME.has(p.perfumeName)) {
      ALL_PERFUMES.push(p);
      PERFUME_BY_NAME.set(p.perfumeName, p);
      PERFUME_BY_ID.set(p.perfumeId, p);
    }
  });
}

/* ── Category stats shims (shared filter code expects these) ─── */
function getCategoryStats() { return FRAGRANCE_TYPES.map(t => ({ ProductCategoryID: t.type_id, CategoryName: t.type_name, Product_Count: t.product_count || 0 })); }
function getSubcategoryStats() { return []; }
function getSubcategoriesForCategory() { return []; }
function getTotalProductCount() { return ALL_PERFUMES.length || FRAGRANCE_TYPES.reduce((s,t) => s + (t.product_count||0), 0); }
function normalizeCategoryName(str) { if (!str) return ''; return str.charAt(0).toUpperCase() + str.slice(1); }
