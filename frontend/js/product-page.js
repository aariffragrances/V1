'use strict';
/* product-page.js — dedicated PDP with similar scents */

function getProductIdFromUrl() {
  const p = new URLSearchParams(window.location.search);
  return (p.get('id') || p.get('perfume') || '').trim();
}

function renderProductPage(perfume) {
  const root = document.getElementById('product-page-root');
  if (!root || !perfume) return;

  const types = typeof getPerfumeTypes === 'function' ? getPerfumeTypes(perfume) : ['perfume'];
  let activeType = types.includes('perfume') ? 'perfume' : types[0];
  if (typeof filterState !== 'undefined' && filterState.productType && types.includes(filterState.productType)) {
    activeType = filterState.productType;
  }
  let sizes = typeof getSizesForType === 'function' ? getSizesForType(perfume, activeType) : [];
  let def = sizes[0] || { label: '', price: 0 };
  const name = perfume.displayName || perfume.perfumeName || '';
  const key = perfume.perfumeName || perfume.productName || name;
  const perfumeId = perfume.perfumeId || perfume.productId || '';
  const desc = perfume.description || 'Premium fragrance from Aarif Fragrances — crafted for lasting elegance.';
  const img = typeof getProductImageUrl === 'function' ? getProductImageUrl(perfume) : 'assets/bottle-blue.png?v=1';
  const wished = typeof AarifStore !== 'undefined' && AarifStore.isInWishlist(key);

  const crumb = document.getElementById('pp-crumb-name');
  if (crumb) crumb.textContent = name;
  document.title = `${name} — Aarif Fragrances`;

  const badges = [];
  if (perfume.isAttar) badges.push('<span class="pd-badge pd-badge--outline">Attar</span>');
  if (perfume.isPerfume || perfume.perfumeSpray) badges.push('<span class="pd-badge pd-badge--outline">Perfume</span>');
  if (perfume.isCarHanger || perfume.isCarHangover) badges.push('<span class="pd-badge pd-badge--outline">Car Hanger</span>');
  if (perfume.isFeatured) badges.push('<span class="pd-badge pd-badge--solid">FEATURED</span>');
  if (perfume.isBestSeller) badges.push('<span class="pd-badge pd-badge--solid">BEST SELLER</span>');

  const typeImg = typeof getTypeImageUrl === 'function' ? getTypeImageUrl(activeType) : 'assets/product-types/perfume.png?v=1';

  root.innerHTML = `
    <div class="pp-layout product-modal--luxury">
      <div class="pp-media pd-media">
        <div class="pp-media-frame pd-media-frame">
          <img src="${escPp(img)}" alt="${escPp(name)}" onerror="this.onerror=null;this.src='assets/bottle-blue.png?v=1'">
        </div>
      </div>
      <div class="pp-info pd-info">
        <div class="pd-badges">${badges.join('')}</div>
        <h1 class="pd-title">${escPp(name)}</h1>
        <div class="pd-rule" aria-hidden="true"></div>
        <p class="pd-desc">${escPp(desc)}</p>

        <div class="pd-select-row">
          <div class="pd-select-main">
            <div class="pd-block">
              <div class="pd-label">TYPE</div>
              <div class="pd-type-row" id="pp-types">
                ${types.map(t => `<button type="button" class="pd-type-btn${t === activeType ? ' active' : ''}" data-type="${t}">${typeof getTypeLabel === 'function' ? getTypeLabel(t) : t}</button>`).join('')}
              </div>
              <p class="pd-type-hint" id="pp-type-hint">${escPp(typeof getTypeHint === 'function' ? getTypeHint(activeType) : '')}</p>
            </div>

            <div class="pd-block">
              <div class="pd-label">SELECT SIZE</div>
              <div class="pd-size-row" id="pp-sizes">
                ${sizes.map((s, i) => `
                  <button type="button" class="pd-size-btn${i === 0 ? ' active' : ''}" data-size="${s.label}" data-price="${s.price}">
                    <span class="pd-size-label">${s.label}</span>
                    <span class="pd-size-price">₹${s.price}</span>
                  </button>`).join('') || '<span class="pd-empty">No sizes available</span>'}
              </div>
            </div>

            <div class="pd-price-row">
              <span class="pd-price" id="pp-price">${def.price ? `₹${def.price}` : ''}</span>
              <span class="pd-price-note" id="pp-price-note">${def.label ? `for ${def.label}` : ''}</span>
            </div>
          </div>
          <div class="pd-type-visual" aria-hidden="true">
            <img id="pp-type-img" src="${escPp(typeImg)}" alt="" onerror="this.style.visibility='hidden'">
          </div>
        </div>

        <div class="pd-actions pp-actions">
          <div class="pd-qty" id="pp-qty">
            <button type="button" class="pd-qty-btn" data-qty="-1" aria-label="Decrease">−</button>
            <span class="pd-qty-val" id="pp-qty-val">1</span>
            <button type="button" class="pd-qty-btn" data-qty="1" aria-label="Increase">+</button>
          </div>
          <button type="button" class="pd-add-btn" id="pp-add-btn"
            data-name="${escPp(key)}" data-size="${escPp(def.label)}" data-price="${def.price}">
            <i class="fa-solid fa-bag-shopping"></i> ADD TO CART
          </button>
          <button type="button" class="pp-wish-btn${wished ? ' is-active' : ''}" id="pp-wish-btn" data-name="${escPp(key)}" aria-label="Wishlist">
            <i class="fa-${wished ? 'solid' : 'regular'} fa-heart"></i>
          </button>
        </div>

        <div class="pd-meta">
          <div class="pd-meta-row">
            <span class="pd-meta-label">Product ID:</span>
            <span class="pd-meta-value">${escPp(perfumeId || '—')}</span>
          </div>
          <div class="pd-meta-row">
            <span class="pd-meta-label">Category:</span>
            <a class="pd-meta-cat" href="products.html?type=${encodeURIComponent(perfume.fragranceTypeId || '')}">${escPp(perfume.fragranceTypeName || 'Fragrance')}</a>
          </div>
        </div>
      </div>
    </div>`;

  let qty = 1;
  let currentType = activeType;
  let currentSize = def.label;
  let currentPrice = def.price;

  function setTypeImage(type) {
    const imgEl = root.querySelector('#pp-type-img');
    if (!imgEl || typeof getTypeImageUrl !== 'function') return;
    imgEl.style.visibility = '';
    imgEl.src = getTypeImageUrl(type);
  }

  function paintSizes(type) {
    const list = typeof getSizesForType === 'function' ? getSizesForType(perfume, type) : [];
    const wrap = root.querySelector('#pp-sizes');
    if (!wrap) return;
    if (!list.length) {
      wrap.innerHTML = '<span class="pd-empty">No sizes available</span>';
      return;
    }
    wrap.innerHTML = list.map((s, i) => `
      <button type="button" class="pd-size-btn${i === 0 ? ' active' : ''}" data-size="${s.label}" data-price="${s.price}">
        <span class="pd-size-label">${s.label}</span>
        <span class="pd-size-price">₹${s.price}</span>
      </button>`).join('');
    currentSize = list[0].label;
    currentPrice = list[0].price;
    const priceEl = root.querySelector('#pp-price');
    const noteEl = root.querySelector('#pp-price-note');
    if (priceEl) priceEl.textContent = currentPrice ? `₹${currentPrice}` : '';
    if (noteEl) noteEl.textContent = currentSize ? `for ${currentSize}` : '';
    const addBtn = root.querySelector('#pp-add-btn');
    if (addBtn) { addBtn.dataset.size = currentSize; addBtn.dataset.price = currentPrice; }
    wrap.querySelectorAll('.pd-size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('.pd-size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSize = btn.dataset.size;
        currentPrice = Number(btn.dataset.price) || 0;
        if (priceEl) priceEl.textContent = currentPrice ? `₹${currentPrice}` : '';
        if (noteEl) noteEl.textContent = currentSize ? `for ${currentSize}` : '';
        if (addBtn) { addBtn.dataset.size = currentSize; addBtn.dataset.price = currentPrice; }
      });
    });
  }

  root.querySelectorAll('#pp-types .pd-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('#pp-types .pd-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = btn.dataset.type;
      const hint = root.querySelector('#pp-type-hint');
      if (hint && typeof getTypeHint === 'function') hint.textContent = getTypeHint(currentType);
      setTypeImage(currentType);
      paintSizes(currentType);
    });
  });

  root.querySelectorAll('.pd-qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      qty = Math.max(1, Math.min(99, qty + (Number(btn.dataset.qty) || 0)));
      const val = root.querySelector('#pp-qty-val');
      if (val) val.textContent = String(qty);
    });
  });

  root.querySelector('#pp-add-btn')?.addEventListener('click', () => {
    if (typeof addToCart === 'function') addToCart(key, qty, currentSize, currentPrice);
  });

  root.querySelector('#pp-wish-btn')?.addEventListener('click', () => {
    if (typeof AarifStore === 'undefined') return;
    AarifStore.toggleWishlist(key);
    const on = AarifStore.isInWishlist(key);
    const b = root.querySelector('#pp-wish-btn');
    if (b) {
      b.classList.toggle('is-active', on);
      b.innerHTML = `<i class="fa-${on ? 'solid' : 'regular'} fa-heart"></i>`;
    }
    if (typeof updateWishlistBadge === 'function') updateWishlistBadge();
  });

  paintSizes(currentType);
  renderSimilarScents(perfume);
}

function renderSimilarScents(perfume) {
  const section = document.getElementById('pp-similar-section');
  const grid = document.getElementById('pp-similar-grid');
  if (!section || !grid || typeof ALL_PERFUMES === 'undefined') return;
  const typeId = perfume.fragranceTypeId;
  const id = perfume.perfumeId || perfume.productId;
  const similar = ALL_PERFUMES
    .filter(p => p.fragranceTypeId === typeId && (p.perfumeId || p.productId) !== id)
    .slice(0, 4);
  if (!similar.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  grid.innerHTML = similar.map((p, i) =>
    typeof buildProductCardHTML === 'function' ? buildProductCardHTML(p, i) : ''
  ).join('');
  if (typeof bindProductCards === 'function') bindProductCards(grid);
}

function escPp(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function bootProductPage() {
  const id = getProductIdFromUrl();
  const root = document.getElementById('product-page-root');
  if (!id) {
    if (root) root.innerHTML = `<div class="pp-empty"><h2>Product not found</h2><p><a href="products.html" class="btn btn-primary">Browse Perfumes</a></p></div>`;
    return;
  }
  whenCatalogReady().then(() => {
    let perfume = PERFUME_BY_ID.get(id) || PERFUME_BY_ID.get(String(id).toUpperCase()) || (typeof resolveStoredProductKey === 'function' ? resolveStoredProductKey(id) : null);
    if (!perfume && typeof fetch === 'function') {
      return fetch(`/api/v1/perfumes/${encodeURIComponent(id)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          const p = data && (data.perfume || data);
          if (p && typeof normaliseApiPerfume === 'function') {
            perfume = normaliseApiPerfume(p);
            if (typeof mergeProductsIntoCatalog === 'function') mergeProductsIntoCatalog([perfume]);
          } else perfume = p;
          if (perfume) renderProductPage(perfume);
          else if (root) root.innerHTML = `<div class="pp-empty"><h2>Product not found</h2><p><a href="products.html" class="btn btn-primary">Browse Perfumes</a></p></div>`;
        });
    }
    if (perfume) renderProductPage(perfume);
    else if (root) root.innerHTML = `<div class="pp-empty"><h2>Product not found</h2><p><a href="products.html" class="btn btn-primary">Browse Perfumes</a></p></div>`;
  }).catch(() => {
    if (root) root.innerHTML = `<div class="pp-empty"><h2>Could not load product</h2><p><a href="products.html" class="btn btn-primary">Browse Perfumes</a></p></div>`;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page === 'product') bootProductPage();
});
