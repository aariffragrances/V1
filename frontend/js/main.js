'use strict';
/* ============================================================
   main.js — Page boot & orchestration
   ============================================================ */

function updateHeaderBadges() {
  const badge = document.getElementById('basket-count');
  if (badge) {
    const count = typeof AarifStore !== 'undefined' ? AarifStore.getCartCount() : 0;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
  updateWishlistBadge();
}

function updateWishlistBadge() {
  const badge = document.getElementById('wishlist-count');
  if (!badge) return;
  const count = typeof AarifStore !== 'undefined' ? AarifStore.getWishlistCount() : 0;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

function initScrollAnimations() {
  const els = document.querySelectorAll('.fade-in-section');
  if (!els.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.08 });
  els.forEach(el => obs.observe(el));
}

function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  window.addEventListener('scroll', () => btn.classList.toggle('visible', window.scrollY > 400), { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function initSectionScrollLinks() {
  document.querySelectorAll('.browse-nav-link--section').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href') || '';
      if (!href.startsWith('#')) return;
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ── Home page boot ─────────────────────────────────────────── */
function bootHome() {
  if (typeof initHeroSlider    === 'function') initHeroSlider();
  if (typeof renderTestimonials === 'function') renderTestimonials();
  if (typeof renderFooterTypes  === 'function') renderFooterTypes();

  // Load metadata first (fast — no products)
  whenMetadataReady().then(() => {
    if (typeof refreshHeroSlider === 'function') refreshHeroSlider();
    if (typeof renderTypeCards   === 'function') renderTypeCards(FRAGRANCE_TYPES);
    if (typeof renderFooterTypes === 'function') renderFooterTypes();
    if (typeof renderTeaserStats === 'function') renderTeaserStats();
  }).catch(() => {
    // Fallback: render type cards from static text
    if (typeof renderTypeCards === 'function') renderTypeCards([]);
  });

  // Then load products for feature strips
  whenCatalogReady().then(() => {
    if (typeof renderHomeProductStrips === 'function') renderHomeProductStrips();
    if (typeof renderTeaserStats       === 'function') renderTeaserStats();
  }).catch(() => {});
}

/* ── Products page boot ──────────────────────────────────────── */
function bootProducts() {
  if (typeof renderSkeletonGrid === 'function') renderSkeletonGrid(12);
  whenCatalogReady().then(() => {
    if (typeof initProductsPage === 'function') initProductsPage();
  }).catch(() => {});
}

/* ── Basket page boot ────────────────────────────────────────── */
function bootBasket() {
  if (typeof AarifStore !== 'undefined') AarifStore.hydrate(true);
  if (typeof renderBasketPageEarly === 'function') renderBasketPageEarly();
  whenMetadataReady().then(() => {
    if (typeof renderFooterTypes === 'function') renderFooterTypes();
  }).catch(() => {});
  whenCatalogReady().then(() => {
    if (typeof initBasketPage === 'function') initBasketPage();
    if (typeof renderFooterTypes === 'function') renderFooterTypes();
  }).catch(() => {
    if (typeof initBasketPage === 'function') initBasketPage();
  });
}

/* ── DOMContentLoaded ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Common init
  if (typeof initNavigation     === 'function') initNavigation();
  if (typeof initSearch         === 'function') initSearch();
  if (typeof initModal          === 'function') initModal();
  initScrollAnimations();
  initBackToTop();
  initSectionScrollLinks();
  updateHeaderBadges();

  document.addEventListener('aarif:basket-updated', updateHeaderBadges);
  document.addEventListener('aarif:wishlist-updated', updateWishlistBadge);

  const page = document.body.dataset.page;
  if      (page === 'home')     bootHome();
  else if (page === 'products') bootProducts();
  else if (page === 'basket')   bootBasket();
  else if (page === 'product')  { /* product-page.js boots itself */ }
  else if (page === 'wishlist') { /* wishlist page script boots itself */ }
  else if (page === 'login' || page === 'signup' || page === 'account') {
    if (typeof initCustomerHeaderAuth === 'function') initCustomerHeaderAuth();
  } else {
    // Other pages — load metadata for footer
    whenMetadataReady().then(() => {
      if (typeof renderFooterTypes === 'function') renderFooterTypes();
    }).catch(() => {});
  }
});
