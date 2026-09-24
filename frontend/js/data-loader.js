'use strict';
/* ============================================================
   data-loader.js  — API fetch + in-memory catalog
   ============================================================ */

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
function applyMetadata(data) {
  FRAGRANCE_TYPES   = data.fragranceTypes  || [];
  PROMOTION_BANNERS = data.promotionBanners || [];
  SITE_SETTINGS     = data.siteSettings    || {};

  if (typeof applySiteSettings === 'function') applySiteSettings(SITE_SETTINGS);
  _metaReady = true;
  document.dispatchEvent(new CustomEvent('aarif:metadata-ready'));
}

/* ── Apply full product list ─────────────────────────────────── */
function applyCatalog(perfumes) {
  ALL_PERFUMES.length = 0;
  (perfumes || []).forEach(p => ALL_PERFUMES.push(normaliseApiPerfume(p)));
  rebuildLookups();
  _dataReady = true;
  document.dispatchEvent(new CustomEvent('aarif:catalog-ready'));
}

/* ── Public: get promotion banners (used by home-sections.js) ── */
function getPromotionBanners() { return PROMOTION_BANNERS; }

/* ── Fetch helpers ───────────────────────────────────────────── */
async function fetchBootstrap() {
  const res = await fetch('/api/v1/catalog/bootstrap');
  if (!res.ok) throw new Error('bootstrap ' + res.status);
  return res.json();
}

async function fetchMetadata() {
  const res = await fetch('/api/v1/catalog/metadata');
  if (!res.ok) throw new Error('metadata ' + res.status);
  return res.json();
}

async function fetchPerfumesBulk() {
  const res = await fetch('/api/v1/catalog/perfumes-bulk');
  if (!res.ok) throw new Error('perfumes-bulk ' + res.status);
  return res.json();
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
    _dataPromise = whenMetadataReady()
      .then(() => fetchPerfumesBulk())
      .then(data => applyCatalog(data.perfumes || []))
      .catch(err => {
        console.warn('Split load failed, trying bootstrap', err);
        return fetchBootstrap().then(data => {
          applyMetadata(data);
          applyCatalog(data.perfumes || []);
        }).catch(e => { _dataPromise = null; throw e; });
      });
  }
  return _dataPromise;
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
  const joined = names.join(',');
  const res = await fetch('/api/v1/catalog/cart-perfumes?names=' + encodeURIComponent(joined));
  if (!res.ok) return [];
  const data = await res.json();
  return (data.perfumes || []).map(normaliseApiPerfume);
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
