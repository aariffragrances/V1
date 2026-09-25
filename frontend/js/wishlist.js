'use strict';
/* wishlist.js — render saved fragrances page */

function renderWishlistPage() {
  const root = document.getElementById('wishlist-root');
  const sub = document.getElementById('wishlist-subtitle');
  if (!root || typeof AarifStore === 'undefined') return;
  AarifStore.hydrate?.(true);
  const rawList = typeof AarifStore.getWishlistItems === 'function'
    ? AarifStore.getWishlistItems()
    : AarifStore.getWishlist().map(n => ({ name: n }));
  if (sub) {
    sub.textContent = rawList.length
      ? `${rawList.length} saved fragrance${rawList.length === 1 ? '' : 's'}`
      : 'No saved fragrances yet';
  }
  if (!rawList.length) {
    root.innerHTML = `<div class="cart-empty" style="grid-column:1/-1">
      <div class="cart-empty-icon"><i class="fa-regular fa-heart"></i></div>
      <h2>Your wishlist is empty</h2>
      <p>Tap the heart on any perfume to save it here.</p>
      <a href="products.html" class="btn btn-primary cart-empty-btn"><i class="fa-solid fa-bag-shopping"></i> Browse Perfumes</a>
    </div>`;
    return;
  }
  const items = rawList
    .map((it) => {
      const name = typeof it === 'string' ? it : it.name;
      const p = (typeof resolveStoredProductKey === 'function' ? resolveStoredProductKey(name) : null);
      if (!p) return null;
      return {
        perfume: p,
        type: typeof it === 'object' ? it.type : '',
        size: typeof it === 'object' ? it.size : '',
      };
    })
    .filter(Boolean);
  root.innerHTML = items.map((it, i) => buildProductCardHTML(it.perfume, i, it.type, it.size, true)).join('');
  if (typeof bindProductCards === 'function') bindProductCards(root);
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page !== 'wishlist') return;
  const boot = typeof whenCatalogReady === 'function'
    ? whenCatalogReady().then(renderWishlistPage).catch(renderWishlistPage)
    : Promise.resolve().then(renderWishlistPage);
  void boot;
});

document.addEventListener('aarif:wishlist-updated', () => {
  if (document.body.dataset.page === 'wishlist') renderWishlistPage();
});
