'use strict';
/* ============================================================
   product-card.js — Perfume card (supermarket fp-card layout)
   TYPE: Attar (6ml / 12ml) + Perfume (30ml / 50ml) + Car Hanger (6ml / 12ml)
   ============================================================ */

const TYPE_LABELS = { attar: 'Attar', perfume: 'Perfume', car_hanger: 'Car Hanger' };

function normalizeProductType(type) {
  if (type === 'rollon') return 'attar';
  if (type === 'spray') return 'perfume';
  if (type === 'car-hanger' || type === 'carhanger' || type === 'car_hangover' || type === 'car-hangover' || type === 'carhangover') return 'car_hanger';
  return type;
}

function getTypeLabel(type) {
  return TYPE_LABELS[normalizeProductType(type)] || type;
}

const REVIEW_SEEDS = [12, 18, 9, 23, 31, 14, 7, 27, 11, 19, 33, 8, 21, 15, 29];

function getReviewCount(perfume, idx) {
  const seed = (typeof idx === 'number' ? idx : 0) % REVIEW_SEEDS.length;
  return REVIEW_SEEDS[seed];
}

/** Available product types for a perfume */
function getPerfumeTypes(perfume) {
  const types = [];
  if (perfume.isAttar) types.push('attar');
  if (perfume.isPerfume || perfume.perfumeSpray) types.push('perfume');
  if (perfume.isCarHanger || perfume.isCarHangover) types.push('car_hanger');
  if (!types.length) {
    if (perfume.price6ml != null || perfume.price12ml != null) types.push('attar');
    if (perfume.price30ml != null || perfume.price50ml != null) types.push('perfume');
  }
  if (!types.length) types.push('perfume');
  return types;
}

function getSizesForType(perfume, type) {
  const sizes = [];
  const t = normalizeProductType(type);
  if (t === 'attar' || t === 'car_hanger') {
    if (perfume.price6ml != null) sizes.push({ label: '6ml', price: perfume.price6ml });
    if (perfume.price12ml != null) sizes.push({ label: '12ml', price: perfume.price12ml });
  } else {
    if (perfume.price30ml != null) sizes.push({ label: '30ml', price: perfume.price30ml });
    if (perfume.price50ml != null) sizes.push({ label: '50ml', price: perfume.price50ml });
  }
  return sizes;
}

function getDefaultTypeAndSize(perfume, preferredType, preferredSize) {
  const types = getPerfumeTypes(perfume);
  let type = (preferredType && types.includes(normalizeProductType(preferredType)))
    ? normalizeProductType(preferredType)
    : (types.includes('perfume') ? 'perfume' : types[0]);
  if (!preferredType && typeof filterState !== 'undefined' && filterState.productType && types.includes(filterState.productType)) {
    type = filterState.productType;
  }
  const sizes = getSizesForType(perfume, type);
  let sizeObj = preferredSize ? sizes.find(s => s.label === preferredSize) : null;
  if (!sizeObj && sizes.length) sizeObj = sizes[0];
  if (sizeObj) return { type, size: sizeObj.label, price: sizeObj.price, sizes, types };
  return { type, size: '', price: 0, sizes: [], types };
}

const TYPE_HINTS = {
  attar: 'Traditional alcohol-free concentrated fragrance oil',
  perfume: 'Alcohol-based wearable fragrance.',
  car_hanger: 'Car fragrance hanging bottle — 6ml and 12ml.',
};

const TYPE_IMAGES = {
  attar: 'assets/product-types/attar.png?v=1',
  perfume: 'assets/product-types/perfume.png?v=1',
  car_hanger: 'assets/product-types/attar.png?v=1',
};

function getTypeImageUrl(type) {
  const t = normalizeProductType(type);
  return TYPE_IMAGES[t] || TYPE_IMAGES.perfume;
}

function getTypeHint(type) {
  return TYPE_HINTS[normalizeProductType(type)] || '';
}

function buildTypeButtonsHTML(perfume, selectedType) {
  const types = getPerfumeTypes(perfume);
  if (!types.length) return '';
  const sel = selectedType || (types.includes('perfume') ? 'perfume' : types[0]);
  const hint = getTypeHint(sel);
  return `<div class="fp-type-row" role="group" aria-label="TYPE">` +
    types.map(t => {
      const label = getTypeLabel(t);
      return `<button type="button" class="fp-type-btn${t === sel ? ' active' : ''}" data-type="${t}">${label}</button>`;
    }).join('') +
    `</div>` +
    (hint ? `<p class="fp-type-hint">${escStr(hint)}</p>` : '');
}

function buildSizeButtonsHTML(perfume, selectedSize, type) {
  const sizes = getSizesForType(perfume, type || getDefaultTypeAndSize(perfume).type);
  if (!sizes.length) return '';
  const sel = selectedSize || sizes[0].label;
  return `<div class="fp-sizes">` +
    sizes.map(s => `<button type="button" class="fp-size-btn${s.label === sel ? ' active' : ''}"
      data-size="${s.label}" data-price="${s.price}" data-type="${type || ''}">${s.label}</button>`).join('') +
    `</div>`;
}

function buildProductCardBottomHTML(name, inBasket, basketQty) {
  if (!inBasket) {
    return `
      <div class="fp-bottom">
        <button type="button" class="fp-add-btn" aria-label="Add ${escStr(name)} to cart">
          <i class="fa-solid fa-cart-shopping" aria-hidden="true"></i> Add
        </button>
      </div>`;
  }
  return `
    <div class="fp-bottom fp-bottom--has-item">
      <button type="button" class="fp-add-btn fp-add-btn--in-cart"
        aria-label="${escStr(name)} — ${basketQty} in cart">
        <i class="fa-solid fa-cart-shopping" aria-hidden="true"></i> ${basketQty}
      </button>
      <button type="button" class="fp-remove-btn" aria-label="Remove ${escStr(name)}">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    </div>`;
}

const DEFAULT_PRODUCT_IMAGE = 'assets/bottle-blue.png?v=1';

function getProductImageUrl(perfume) {
  if (!perfume) return DEFAULT_PRODUCT_IMAGE;
  const raw = perfume.primaryImageUrl || perfume.imageUrl || perfume.image_url || perfume.image || DEFAULT_PRODUCT_IMAGE;
  return typeof getOptimizedImageUrl === 'function' ? getOptimizedImageUrl(raw, 400) : raw;
}

function buildProductCardHTML(perfume, idx, initialType, initialSize, isWishlist) {
  const key = perfume.perfumeName || perfume.productName || '';
  const inBasket = typeof AarifStore !== 'undefined' && AarifStore.isInCart(key);
  const basketQty = inBasket ? AarifStore.getCartQty(key) : 0;
  const reviews = getReviewCount(perfume, idx);
  const typeName = perfume.fragranceTypeName || perfume.categoryName || '';
  const perfumeId = perfume.perfumeId || perfume.productId || '';
  const def = getDefaultTypeAndSize(perfume, initialType, initialSize);
  const typeBtns = buildTypeButtonsHTML(perfume, def.type);
  const sizeBtns = buildSizeButtonsHTML(perfume, def.size, def.type);
  const name = perfume.displayName || perfume.perfumeName || perfume.productName || '';
  const desc = perfume.description || '';
  const priceTxt = def.price ? `<span class="fp-currency">₹</span>${def.price}` : '';
  const imgUrl = getProductImageUrl(perfume);
  const activeTypeLabel = getTypeLabel(def.type);

  const imgInner = `<img src="${escStr(imgUrl)}" alt="${escStr(name)}" loading="lazy" decoding="async"
    onerror="this.onerror=null;this.src='${DEFAULT_PRODUCT_IMAGE}'">`;

  return `
<article class="fp-card" data-product-name="${escStr(key)}"
  data-type="${escStr(def.type)}" data-size="${escStr(def.size)}" data-price="${def.price}" tabindex="0">
  <div class="fp-image-area">
    <button type="button" class="fp-wish-btn${(typeof AarifStore !== 'undefined' && AarifStore.isInWishlist(key)) ? ' is-active' : ''}"
      data-wish="${escStr(key)}" aria-label="Save to wishlist" title="Wishlist">
      <i class="fa-${(typeof AarifStore !== 'undefined' && AarifStore.isInWishlist(key)) ? 'solid' : 'regular'} fa-heart"></i>
    </button>
    ${isWishlist ? `<div class="fp-wish-type-badge">${escStr(activeTypeLabel)}</div>` : ''}
    <div class="fp-image-frame">${imgInner}</div>
  </div>
  <div class="fp-content">
    <div class="fp-category">${escStr(typeName)}</div>
    <h3 class="fp-title">${escStr(name)}</h3>
    ${desc ? `<p class="fp-desc">${escStr(desc)}</p>` : ''}
    <div class="fp-rating" aria-label="5 stars, ${reviews} reviews">
      <span class="fp-stars">
        <i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i>
        <i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i>
        <i class="fa-solid fa-star"></i>
      </span>
      <span class="fp-review">(${reviews})</span>
    </div>
    <div class="fp-type-label">TYPE</div>
    ${typeBtns}
    <div class="fp-type-label">SIZE</div>
    <div class="fp-size-price-row">
      ${sizeBtns}
      <div class="fp-price">${priceTxt}</div>
    </div>
    <div class="fp-body-spacer" aria-hidden="true"></div>
    ${buildProductCardBottomHTML(name, inBasket, basketQty)}
  </div>
</article>`;
}

function updateProductCardBasketState(name, container) {
  const scope = container || document;
  const cards = scope.querySelectorAll
    ? scope.querySelectorAll(`.fp-card[data-product-name="${CSS.escape(name)}"]`)
    : [];
  if (!cards.length) {
    document.querySelectorAll(`.fp-card[data-product-name="${CSS.escape(name)}"]`)
      .forEach(c => _refreshCardBottom(c));
    return;
  }
  cards.forEach(c => _refreshCardBottom(c));
}

function updateProductCardWishlistState(name, container) {
  const scope = container || document;
  const cards = (scope.querySelectorAll
    ? scope.querySelectorAll(`.fp-card[data-product-name="${CSS.escape(name)}"]`)
    : []) || [];
  const list = cards.length
    ? cards
    : document.querySelectorAll(`.fp-card[data-product-name="${CSS.escape(name)}"]`);
  const on = typeof AarifStore !== 'undefined' && AarifStore.isInWishlist(name);
  list.forEach((card) => {
    const btn = card.querySelector('.fp-wish-btn');
    if (!btn) return;
    btn.classList.toggle('is-active', on);
    btn.innerHTML = `<i class="fa-${on ? 'solid' : 'regular'} fa-heart"></i>`;
  });
}

function _refreshCardBottom(card) {
  const name = card.dataset.productName;
  const inBasket = typeof AarifStore !== 'undefined' && AarifStore.isInCart(name);
  const qty = inBasket ? AarifStore.getCartQty(name) : 0;
  const oldBottom = card.querySelector('.fp-bottom');
  const html = buildProductCardBottomHTML(name, inBasket, qty);
  if (oldBottom) oldBottom.outerHTML = html.trim();
}

function _applyTypeOnCard(card, perfume, type) {
  const sizes = getSizesForType(perfume, type);
  const first = sizes[0] || { label: '', price: 0 };
  card.dataset.type = type;
  card.dataset.size = first.label;
  card.dataset.price = first.price;

  card.querySelectorAll('.fp-type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === type);
  });

  const wishTag = card.querySelector('.fp-wish-type-badge');
  if (wishTag) wishTag.textContent = getTypeLabel(type);

  const hintEl = card.querySelector('.fp-type-hint');
  const hint = getTypeHint(type);
  if (hintEl) {
    hintEl.textContent = hint;
  } else if (hint) {
    const typeRow = card.querySelector('.fp-type-row');
    if (typeRow) {
      typeRow.insertAdjacentHTML('afterend', `<p class="fp-type-hint">${escStr(hint)}</p>`);
    }
  }

  const sizeWrap = card.querySelector('.fp-sizes');
  if (sizeWrap) {
    sizeWrap.outerHTML = buildSizeButtonsHTML(perfume, first.label, type).trim();
  }

  const priceEl = card.querySelector('.fp-price');
  if (priceEl) {
    priceEl.innerHTML = first.price
      ? `<span class="fp-currency">₹</span>${first.price}`
      : '';
  }
}

function bindProductCards(container) {
  if (!container || container.dataset.fpBound) return;
  container.dataset.fpBound = '1';

  container.addEventListener('click', e => {
    const card = e.target.closest('.fp-card');
    if (!card || !container.contains(card)) return;
    const name = card.dataset.productName;
    if (!name) return;

    const perfume = typeof resolveStoredProductKey === 'function'
      ? resolveStoredProductKey(name)
      : (typeof PERFUME_BY_NAME !== 'undefined' ? PERFUME_BY_NAME.get(name) : null);

    const typeBtn = e.target.closest('.fp-type-btn');
    if (typeBtn) {
      e.stopPropagation();
      if (perfume) _applyTypeOnCard(card, perfume, typeBtn.dataset.type);
      return;
    }

    const wishBtn = e.target.closest('.fp-wish-btn');
    if (wishBtn) {
      e.stopPropagation();
      const wname = wishBtn.dataset.wish || name;
      const type = card.dataset.type || '';
      const size = card.dataset.size || '';
      const price = Number(card.dataset.price) || 0;
      if (typeof AarifStore !== 'undefined') {
        const on = AarifStore.toggleWishlist(wname, type, size, price);
        wishBtn.classList.toggle('is-active', on);
        wishBtn.innerHTML = `<i class="fa-${on ? 'solid' : 'regular'} fa-heart"></i>`;
        if (typeof updateWishlistBadge === 'function') updateWishlistBadge();
      }
      return;
    }

    const sizeBtn = e.target.closest('.fp-size-btn');
    if (sizeBtn) {
      e.stopPropagation();
      card.querySelectorAll('.fp-size-btn').forEach(b => b.classList.remove('active'));
      sizeBtn.classList.add('active');
      card.dataset.size = sizeBtn.dataset.size;
      card.dataset.price = sizeBtn.dataset.price;
      if (sizeBtn.dataset.type) card.dataset.type = sizeBtn.dataset.type;
      const priceEl = card.querySelector('.fp-price');
      if (priceEl) priceEl.innerHTML = `<span class="fp-currency">₹</span>${sizeBtn.dataset.price}`;
      return;
    }

    if (e.target.closest('.fp-remove-btn')) {
      e.stopPropagation();
      if (typeof removeFromCart === 'function') removeFromCart(name);
      return;
    }

    if (e.target.closest('.fp-add-btn')) {
      e.stopPropagation();
      const size = card.dataset.size || '';
      const price = Number(card.dataset.price) || 0;
      const type = card.dataset.type || '';
      if (typeof addToCart === 'function') addToCart(name, 1, size, price, type);
      return;
    }

    if (typeof openProductModal === 'function' && perfume) {
      openProductModal(perfume);
    }
  });
}

function escStr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
