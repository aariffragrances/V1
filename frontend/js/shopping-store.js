'use strict';
/* ============================================================
   shopping-store.js  — basket + wishlist for Aarif Fragrances
   Cart: { perfumeName: { qty, size, price } }
   Wishlist: array of perfume names
   ============================================================ */
const STORE_KEY = 'aarif_basket_v1';
const WISHLIST_KEY = 'aarif_wishlist_v1';

const AarifStore = (function () {
  const cart = new Map();
  const wishlist = new Set();
  let _ready = false;
  let _wishReady = false;

  const wishlistMap = new Map();

  function persist() {
    const obj = {};
    cart.forEach((v, k) => { obj[k] = v; });
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ v: 2, cart: obj })); } catch (_) {}
  }

  function persistWishlist() {
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify({
        v: 2,
        items: [...wishlistMap.values()]
      }));
    } catch (_) {}
  }

  function load() {
    if (_ready) return;
    _ready = true;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      const src = data.cart || {};
      Object.entries(src).forEach(([k, v]) => {
        if (k && v && v.qty > 0) {
          if (!v.type) {
            if (v.size === '30ml' || v.size === '50ml') v.type = 'perfume';
            else v.type = 'attar';
          }
          cart.set(k, v);
        }
      });
    } catch (_) {}
  }

  function loadWishlist() {
    if (_wishReady) return;
    _wishReady = true;
    try {
      const raw = localStorage.getItem(WISHLIST_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      (data.items || []).forEach((k) => {
        if (!k) return;
        if (typeof k === 'string') {
          wishlist.add(k);
          wishlistMap.set(k, { name: k, type: '', size: '', price: 0 });
        } else if (k && k.name) {
          wishlist.add(k.name);
          wishlistMap.set(k.name, k);
        }
      });
    } catch (_) {}
  }

  function emit() {
    document.dispatchEvent(new CustomEvent('aarif:basket-updated'));
  }

  function emitWish() {
    document.dispatchEvent(new CustomEvent('aarif:wishlist-updated'));
  }

  return {
    hydrate(force) { if (force || !_ready) load(); if (force || !_wishReady) loadWishlist(); },

    getCartCount() {
      load();
      let t = 0; cart.forEach(v => t += (v.qty || 0)); return t;
    },
    getCartItemCount() { load(); return cart.size; },
    getCartMapObject() { load(); const o = {}; cart.forEach((v,k) => o[k] = v); return o; },

    isInCart(name) { load(); return cart.has(name); },
    getCartQty(name) { load(); return cart.has(name) ? cart.get(name).qty : 0; },
    getCartItem(name) { load(); return cart.get(name) || null; },

    addToCartStore(name, qty, size, price, type) {
      load();
      let resolvedType = type || '';
      if (!resolvedType) {
        if (size === '30ml' || size === '50ml') resolvedType = 'perfume';
        else resolvedType = 'attar';
      }
      const prev = cart.get(name);
      if (prev) {
        cart.set(name, {
          qty: prev.qty + (qty || 1),
          size: size || prev.size,
          price: price || prev.price,
          type: type || prev.type || resolvedType
        });
      } else {
        cart.set(name, {
          qty: qty || 1,
          size: size || '30ml',
          price: price || 0,
          type: resolvedType
        });
      }
      persist();
      return resolveStoredProductKey(name);
    },

    setCartQuantityStore(name, qty) {
      load();
      if (!cart.has(name)) return;
      if (qty <= 0) cart.delete(name);
      else { const prev = cart.get(name); cart.set(name, { ...prev, qty }); }
      persist();
    },

    removeFromCartStore(name) {
      load(); cart.delete(name); persist();
    },

    clearCartStore() { load(); cart.clear(); persist(); },

    /* Wishlist */
    getWishlist() { loadWishlist(); return [...wishlist]; },
    getWishlistItems() { loadWishlist(); return [...wishlistMap.values()]; },
    getWishlistCount() { loadWishlist(); return wishlist.size; },
    isInWishlist(name) { loadWishlist(); return wishlist.has(name); },
    addToWishlist(name, type, size, price) {
      loadWishlist();
      if (!name) return false;
      wishlist.add(name);
      wishlistMap.set(name, {
        name,
        type: type || (size === '30ml' || size === '50ml' ? 'perfume' : 'attar'),
        size: size || '',
        price: price || 0
      });
      persistWishlist();
      emitWish();
      return true;
    },
    removeFromWishlist(name) {
      loadWishlist();
      wishlist.delete(name);
      wishlistMap.delete(name);
      persistWishlist();
      emitWish();
    },
    toggleWishlist(name, type, size, price) {
      loadWishlist();
      if (!name) return false;
      if (wishlist.has(name)) {
        wishlist.delete(name);
        wishlistMap.delete(name);
      } else {
        wishlist.add(name);
        wishlistMap.set(name, {
          name,
          type: type || (size === '30ml' || size === '50ml' ? 'perfume' : 'attar'),
          size: size || '',
          price: price || 0
        });
      }
      persistWishlist();
      emitWish();
      return wishlist.has(name);
    },

    emitBasket: emit,
    emitWishlist: emitWish,
    reloadFromStorage() { _ready = false; _wishReady = false; load(); loadWishlist(); emit(); emitWish(); }
  };
})();

window.addEventListener('storage', e => {
  if (e.key === STORE_KEY || e.key === WISHLIST_KEY) AarifStore.reloadFromStorage();
});
