'use strict';
/* wishlist.js — render saved fragrances page */

function renderWishlistPage() {
  const root = document.getElementById('wishlist-root');
  const sub = document.getElementById('wishlist-subtitle');
  if (!root || typeof AarifStore === 'undefined') return;
  AarifStore.hydrate?.(true);
  const names = AarifStore.getWishlist();
  if (sub) {
    sub.textContent = names.length
      ? `${names.length} saved fragrance${names.length === 1 ? '' : 's'}`
      : 'No saved fragrances yet';
  }
  if (!names.length) {
    root.innerHTML = `<div class="cart-empty" style="grid-column:1/-1">
      <div class="cart-empty-icon"><i class="fa-regular fa-heart"></i></div>
      <h2>Your wishlist is empty</h2>
      <p>Tap the heart on any perfume to save it here.</p>
      <a href="products.html" class="btn btn-primary cart-empty-btn"><i class="fa-solid fa-bag-shopping"></i> Browse Perfumes</a>
    </div>`;
    return;
  }
  const items = names
    .map((n) => (typeof resolveStoredProductKey === 'function' ? resolveStoredProductKey(n) : null))
    .filter(Boolean);
  root.innerHTML = items.map((p, i) => buildProductCardHTML(p, i)).join('');
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
