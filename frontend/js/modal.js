'use strict';
/* Product detail modal — black & gold luxury layout */

function initModal() {
  const overlay = document.getElementById('product-modal-overlay');
  if (!overlay) return;
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeProductModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeProductModal();
  });
}

function openProductModal(perfume, initialType, initialSize) {
  const overlay = document.getElementById('product-modal-overlay');
  const modal = document.getElementById('product-modal');
  if (!overlay || !modal || !perfume) return;

  const types = typeof getPerfumeTypes === 'function' ? getPerfumeTypes(perfume) : ['perfume'];
  const normInit = initialType ? (typeof normalizeProductType === 'function' ? normalizeProductType(initialType) : initialType) : null;
  const activeType = (normInit && types.includes(normInit))
    ? normInit
    : (types.includes('perfume') ? 'perfume' : types[0]);
  const sizes = typeof getSizesForType === 'function'
    ? getSizesForType(perfume, activeType)
    : [];
  const def = (initialSize && sizes.find(s => s.label === initialSize)) || sizes[0] || { label: '', price: 0 };
  const name = perfume.displayName || perfume.perfumeName || '';
  const desc = perfume.description || 'Premium fragrance from Aarif Fragrances — crafted for lasting elegance.';

  const badges = [];
  if (perfume.isAttar) badges.push('<span class="pd-badge pd-badge--outline">Attar</span>');
  if (perfume.isPerfume || perfume.perfumeSpray) badges.push('<span class="pd-badge pd-badge--outline">Perfume</span>');
  if (perfume.isCarHanger || perfume.isCarHangover) badges.push('<span class="pd-badge pd-badge--outline">Car Hanger</span>');
  if (perfume.isFeatured) badges.push('<span class="pd-badge pd-badge--solid">FEATURED</span>');
  if (perfume.isBestSeller) badges.push('<span class="pd-badge pd-badge--solid">BEST SELLER</span>');

  const typeBtns = types.map((t) => {
    const label = typeof getTypeLabel === 'function' ? getTypeLabel(t) : t;
    return `<button type="button" class="pd-type-btn${t === activeType ? ' active' : ''}" data-type="${t}">${label}</button>`;
  }).join('');

  const sizeBtns = sizes.map((s, i) => `
    <button type="button" class="pd-size-btn${s.label === def.label ? ' active' : ''}"
      data-size="${s.label}" data-price="${s.price}">
      <span class="pd-size-label">${s.label}</span>
      <span class="pd-size-price">₹${s.price}</span>
    </button>`).join('');

  const typeImg = typeof getTypeImageUrl === 'function' ? getTypeImageUrl(activeType) : 'assets/product-types/perfume.png?v=2';

  modal.className = 'product-modal product-modal--luxury';
  modal.innerHTML = `
    <button type="button" class="modal-close pd-close" id="modal-close-btn" aria-label="Close">&times;</button>
    <div class="pd-layout">
      <div class="pd-media">
        <div class="pd-media-frame">
          ${`<img src="${m((typeof getProductImageUrl === 'function' ? getProductImageUrl(perfume) : (perfume.primaryImageUrl || 'assets/bottle-blue.png?v=1')))}" alt="${m(name)}" onerror="this.onerror=null;this.src='assets/bottle-blue.png?v=1'">`}
        </div>
      </div>
      <div class="pd-info">
        <div class="pd-badges">${badges.join('')}</div>
        <h2 class="pd-title">${m(name)}</h2>
        <div class="pd-rule" aria-hidden="true"></div>
        <p class="pd-desc">${m(desc)}</p>

        <div class="pd-select-row">
          <div class="pd-select-main">
            ${types.length ? `
            <div class="pd-block">
              <div class="pd-label">TYPE</div>
              <div class="pd-type-row" id="pd-types">${typeBtns}</div>
              <p class="pd-type-hint" id="pd-type-hint">${m(typeof getTypeHint === 'function' ? getTypeHint(activeType) : '')}</p>
            </div>` : ''}

            <div class="pd-block">
              <div class="pd-label">SELECT SIZE</div>
              <div class="pd-size-row" id="pd-sizes">${sizeBtns || '<span class="pd-empty">No sizes available</span>'}</div>
            </div>

            <div class="pd-price-row">
              <span class="pd-price" id="pd-price">${def.price ? `₹${def.price}` : ''}</span>
              <span class="pd-price-note" id="pd-price-note">${def.label ? `for ${def.label}` : ''}</span>
            </div>
          </div>
          <div class="pd-type-visual" aria-hidden="true">
            <img id="pd-type-img" class="pd-type-img pd_type_img" src="${m(typeImg)}" alt="${m(typeof getTypeLabel === 'function' ? getTypeLabel(activeType) : activeType)}" onerror="this.onerror=null;this.src='assets/product-types/car-hanger.png';">
          </div>
        </div>

        <div class="pd-actions">
          <div class="pd-qty" id="pd-qty">
            <button type="button" class="pd-qty-btn" data-qty="-1" aria-label="Decrease">−</button>
            <span class="pd-qty-val" id="pd-qty-val">1</span>
            <button type="button" class="pd-qty-btn" data-qty="1" aria-label="Increase">+</button>
          </div>
          <button type="button" id="modal-add-btn" class="pd-add-btn"
            data-name="${m(perfume.perfumeName || perfume.productName || name)}"
            data-size="${def.label}" data-price="${def.price}">
            <i class="fa-solid fa-bag-shopping"></i> ADD TO CART
          </button>
          <button type="button" class="pp-wish-btn${(typeof AarifStore !== 'undefined' && AarifStore.isInWishlist(perfume.perfumeName || name)) ? ' is-active' : ''}" id="modal-wish-btn" data-name="${m(perfume.perfumeName || name)}" aria-label="Wishlist">
            <i class="fa-${(typeof AarifStore !== 'undefined' && AarifStore.isInWishlist(perfume.perfumeName || name)) ? 'solid' : 'regular'} fa-heart"></i>
          </button>
        </div>
      </div>
    </div>`;

  let currentType = activeType;
  let qty = 1;

  function setTypeImage(type) {
    const imgEl = modal.querySelector('#pd-type-img') || modal.querySelector('#pd_type_img') || modal.querySelector('.pd_type_img');
    if (!imgEl || typeof getTypeImageUrl !== 'function') return;
    imgEl.style.visibility = 'visible';
    imgEl.style.display = 'block';
    const nextSrc = getTypeImageUrl(type);
    imgEl.src = nextSrc;
    imgEl.alt = typeof getTypeLabel === 'function' ? getTypeLabel(type) : type;
  }

  function paintSizes(type) {
    const list = typeof getSizesForType === 'function' ? getSizesForType(perfume, type) : [];
    const wrap = modal.querySelector('#pd-sizes');
    if (!wrap) return;
    if (!list.length) {
      wrap.innerHTML = '<span class="pd-empty">No sizes available</span>';
      return;
    }
    wrap.innerHTML = list.map((s, i) => `
      <button type="button" class="pd-size-btn${i === 0 ? ' active' : ''}"
        data-size="${s.label}" data-price="${s.price}">
        <span class="pd-size-label">${s.label}</span>
        <span class="pd-size-price">₹${s.price}</span>
      </button>`).join('');
    bindSizeClicks();
    selectSize(list[0].label, list[0].price);
  }

  function selectSize(size, price) {
    const addBtn = modal.querySelector('#modal-add-btn');
    if (addBtn) {
      addBtn.dataset.size = size;
      addBtn.dataset.price = price;
    }
    const priceEl = modal.querySelector('#pd-price');
    const noteEl = modal.querySelector('#pd-price-note');
    if (priceEl) priceEl.textContent = price ? `₹${price}` : '';
    if (noteEl) noteEl.textContent = size ? `for ${size}` : '';
  }

  function bindSizeClicks() {
    modal.querySelectorAll('#pd-sizes .pd-size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('#pd-sizes .pd-size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectSize(btn.dataset.size, btn.dataset.price);
      });
    });
  }

  modal.querySelectorAll('#pd-types .pd-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('#pd-types .pd-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = btn.dataset.type;
      const hintEl = modal.querySelector('#pd-type-hint');
      if (hintEl && typeof getTypeHint === 'function') hintEl.textContent = getTypeHint(currentType);
      setTypeImage(currentType);
      paintSizes(currentType);
    });
  });

  modal.querySelectorAll('.pd-qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const delta = Number(btn.dataset.qty) || 0;
      qty = Math.max(1, Math.min(99, qty + delta));
      const val = modal.querySelector('#pd-qty-val');
      if (val) val.textContent = String(qty);
    });
  });

  bindSizeClicks();

  modal.querySelector('#modal-add-btn')?.addEventListener('click', () => {
    const btn = modal.querySelector('#modal-add-btn');
    const pname = btn.dataset.name;
    const size = btn.dataset.size;
    const price = Number(btn.dataset.price) || 0;
    if (typeof addToCart === 'function') addToCart(pname, qty, size, price, currentType);
    closeProductModal();
  });

  modal.querySelector('#modal-wish-btn')?.addEventListener('click', () => {
    const btn = modal.querySelector('#modal-wish-btn');
    const wname = btn?.dataset.name;
    const size = btn?.dataset.size || def.label;
    const price = Number(btn?.dataset.price) || def.price;
    if (!wname || typeof AarifStore === 'undefined') return;
    const on = AarifStore.toggleWishlist(wname, currentType, size, price);
    btn.classList.toggle('is-active', on);
    btn.innerHTML = `<i class="fa-${on ? 'solid' : 'regular'} fa-heart"></i>`;
    if (typeof updateWishlistBadge === 'function') updateWishlistBadge();
  });

  modal.querySelector('#modal-close-btn')?.addEventListener('click', closeProductModal);

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeProductModal() {
  const overlay = document.getElementById('product-modal-overlay');
  overlay?.classList.remove('open');
  document.body.style.overflow = '';
}

function m(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
