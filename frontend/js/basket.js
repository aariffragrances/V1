'use strict';
/* ============================================================
   basket.js — Basket page rendering + WhatsApp order
   ============================================================ */
const WA_NUMBER = '919688498926';

function resolveWaNumber() {
  return (typeof getWhatsAppNumber === 'function') ? getWhatsAppNumber() : WA_NUMBER;
}

function addToCart(name, qty, size, price, type) {
  if (typeof AarifStore === 'undefined') return;
  const fromWishlist = AarifStore.isInWishlist(name);
  AarifStore.addToCartStore(name, qty || 1, size, price, type);
  if (fromWishlist) {
    AarifStore.removeFromWishlist(name);
    if (typeof updateProductCardWishlistState === 'function') updateProductCardWishlistState(name);
  }
  if (typeof updateHeaderBadges === 'function') updateHeaderBadges();
  if (typeof updateProductCardBasketState === 'function') updateProductCardBasketState(name);
  document.dispatchEvent(new CustomEvent('aarif:basket-updated'));
  showToast(fromWishlist ? 'Moved to cart.' : `${name} added to cart.`, 'basket');
}

function removeFromCart(name) {
  if (typeof AarifStore === 'undefined') return;
  AarifStore.removeFromCartStore(name);
  if (typeof updateHeaderBadges === 'function') updateHeaderBadges();
  if (typeof updateProductCardBasketState === 'function') updateProductCardBasketState(name);
  document.dispatchEvent(new CustomEvent('aarif:basket-updated'));
  showToast('Item removed from cart.', 'remove');
}

function setCartQuantity(name, qty) {
  if (typeof AarifStore === 'undefined') return;
  AarifStore.setCartQuantityStore(name, qty);
  if (typeof updateHeaderBadges === 'function') updateHeaderBadges();
  if (typeof updateProductCardBasketState === 'function') updateProductCardBasketState(name);
  document.dispatchEvent(new CustomEvent('aarif:basket-updated'));
}

/* ── Toast ─────────────────────────────────────────────────── */
function showToast(msg, type) {
  let wrap = document.getElementById('aarif-toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'aarif-toast-wrap';
    wrap.setAttribute('aria-live', 'polite');
    document.body.appendChild(wrap);
  }
  const isRemove = type === 'remove';
  const t = document.createElement('div');
  t.className = `aarif-toast aarif-toast--${type || 'info'}${isRemove ? ' aarif-toast--remove' : ' aarif-toast--success'}`;
  t.innerHTML = `
    <span class="aarif-toast__icon" aria-hidden="true"><i class="fa-solid ${isRemove ? 'fa-trash-can' : 'fa-check'}"></i></span>
    <span class="aarif-toast__msg">${escBt(msg)}</span>
    <button type="button" class="aarif-toast__close" aria-label="Dismiss">×</button>`;
  wrap.appendChild(t);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => t.classList.add('aarif-toast--visible'));
  });
  const dismiss = () => {
    t.classList.remove('aarif-toast--visible');
    setTimeout(() => t.remove(), 280);
  };
  const timer = setTimeout(dismiss, 3000);
  t.querySelector('.aarif-toast__close').addEventListener('click', () => {
    clearTimeout(timer);
    dismiss();
  });
}
function escBt(s){ return String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ── Basket page ────────────────────────────────────────────── */
function formatProductTypeLabel(type) {
  if (!type) return '';
  const t = String(type).toLowerCase().replace(/[-_]/g, '');
  if (t === 'carhanger' || t === 'carhangover') return 'Car Hanger';
  if (t === 'perfume' || t === 'spray') return 'Perfume';
  if (t === 'attar' || t === 'rollon') return 'Attar';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getCartLineItems() {
  if (typeof AarifStore === 'undefined') return [];
  const map = AarifStore.getCartMapObject();
  return Object.entries(map).map(([name, info]) => {
    let p = (typeof resolveStoredProductKey === 'function') ? resolveStoredProductKey(name) : null;
    if (!p) {
      p = {
        perfumeName: name,
        displayName: name,
        categoryName: 'Fragrance',
        fragranceTypeName: 'Fragrance',
        perfumeId: '',
        primaryImageUrl: 'assets/bottle-blue.png?v=1',
      };
    }
    const size = info.size || '';
    let type = info.type || '';
    if (!type) {
      if (size === '30ml' || size === '50ml') {
        type = 'perfume';
      } else {
        type = 'attar';
      }
    }
    return {
      product: p,
      qty: info.qty || 1,
      size: size,
      price: info.price || (p.minPrice || 0),
      type: type
    };
  }).filter(Boolean);
}

function buildWhatsAppUrl(lines, orderRef) {
  const total = lines.reduce((s,l) => s + l.qty, 0);
  const totalPrice = lines.reduce((s,l) => s + (l.price ? Number(l.price) * l.qty : 0), 0);
  const ref = orderRef || generateOrderRef();
  let msg = `Hello Aarif Fragrances,\n\nOrder Ref: ${ref}\n\nI'd like to order the following ${total} item${total===1?'':'s'}:\n\n`;
  msg += lines.map(l => {
    const t = formatProductTypeLabel(l.type);
    const typePrefix = t ? `${t} ` : '';
    return `• ${l.product.displayName || l.product.perfumeName} — ${typePrefix}${l.size || '30ml'} × ${l.qty}${l.price ? ' (₹' + l.price + ')' : ''}`;
  }).join('\n');
  if (totalPrice > 0) {
    msg += `\n\nEstimated Total: ₹${totalPrice.toLocaleString('en-IN')}`;
  }
  msg += '\n\nKindly confirm availability and delivery. Thank you!';
  return {
    url: `https://wa.me/${resolveWaNumber()}?text=${encodeURIComponent(msg)}`,
    message: msg,
    orderRef: ref,
    totalPrice: totalPrice,
  };
}

function generateOrderRef() {
  const n = Math.floor(1000 + Math.random() * 9000);
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const s = letters[Math.floor(Math.random()*letters.length)] + letters[Math.floor(Math.random()*letters.length)];
  return `AF-${n}${s}`;
}

async function submitOrderToServer(lines, orderRef, message) {
  try {
    await fetch('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_ref: orderRef,
        whatsapp_message: message,
        items: lines.map(l => ({
          perfume_id: l.product.perfumeId || l.product.productId || null,
          perfume_name: l.product.displayName || l.product.perfumeName || '',
          size: l.size || null,
          qty: l.qty || 1,
          price: l.price || null,
        })),
      }),
    });
  } catch (_) { /* still open WhatsApp */ }
}

function renderBasketPage() {
  const root = document.getElementById('basket-page-root');
  if (!root) return;
  if (typeof AarifStore !== 'undefined') AarifStore.hydrate(true);
  const lines = getCartLineItems();

  if (!lines.length) {
    root.innerHTML = `<div class="cart-empty-panel">
      <div class="cart-empty">
        <div class="cart-empty-icon" aria-hidden="true"><i class="fa-solid fa-cart-shopping"></i></div>
        <h2>Your cart is empty</h2>
        <p>Browse our perfumes and add items to your cart, then order via WhatsApp.</p>
        <a href="products.html" class="btn btn-primary cart-empty-btn"><i class="fa-solid fa-bag-shopping"></i> Browse Perfumes</a>
      </div>
    </div>`;
    return;
  }

  const lineCount = lines.length;
  const totalQty  = lines.reduce((s,l) => s + l.qty, 0);
  const orderPack = buildWhatsAppUrl(lines);
  const waUrl     = orderPack.url;
  const waPreview = orderPack.message;
  const orderRef  = orderPack.orderRef;
  const totalPrice = orderPack.totalPrice;

  root.innerHTML = `
    <div class="cart-layout">
      <div class="cart-main">
        <div class="cart-top">
          <div class="cart-top-left">
            <div class="cart-title-row">
              <h1 class="cart-page-title">My Cart</h1>
              <span class="cart-count-badge">${lineCount} product${lineCount === 1 ? '' : 's'}</span>
            </div>
            <p class="cart-lead">${lineCount} product${lineCount === 1 ? '' : 's'} selected. Send your list on WhatsApp and we will confirm your order quickly.</p>
          </div>
          <button type="button" class="cart-clear-btn" id="basket-clear-btn">
            <i class="fa-regular fa-trash-can"></i> Clear cart
          </button>
        </div>

        <div class="cart-list-panel" id="cart-lines">
          ${lines.map(l => {
            const name = l.product.perfumeName || l.product.productName || '';
            const display = l.product.displayName || name;
            const cat = l.product.fragranceTypeName || l.product.categoryName || '';
            const id = l.product.perfumeId || l.product.productId || '';
            const typeLabel = formatProductTypeLabel(l.type);
            const img = typeof getProductImageUrl === 'function' ? getProductImageUrl(l.product) : (l.product.primaryImageUrl || 'assets/bottle-blue.png?v=1');
            return `
            <article class="cart-line" data-name="${escBt(name)}">
              <div class="cart-line-image">
                <img src="${escBt(img)}" alt="${escBt(display)}"
                     onerror="this.onerror=null;this.src='assets/bottle-blue.png?v=1'">
              </div>
              <div class="cart-line-details">
                <div class="cart-line-category">${escBt(cat)}</div>
                <h2 class="cart-line-name">${escBt(display)}</h2>
                <div class="cart-line-meta">
                  ${id ? `<span class="cart-sku-badge">${escBt(id)}</span>` : ''}
                  ${typeLabel ? `<span class="cart-type-chip">${escBt(typeLabel)}</span>` : ''}
                  ${l.size ? `<span class="cart-size-chip">${escBt(l.size)}</span>` : ''}
                  ${l.price ? `<span class="cart-price-chip">₹${l.price}</span>` : ''}
                </div>
                <div class="cart-line-avail"><i class="fa-solid fa-circle-check"></i> Available &mdash; enquire for details</div>
              </div>
              <div class="cart-line-actions">
                <div class="qty-control">
                  <button type="button" class="qty-btn qty-minus" aria-label="Decrease">&minus;</button>
                  <span class="qty-value">${l.qty}</span>
                  <button type="button" class="qty-btn qty-plus" aria-label="Increase">+</button>
                </div>
                <button type="button" class="cart-line-remove" aria-label="Remove ${escBt(display)}">
                  <i class="fa-regular fa-trash-can"></i>
                </button>
              </div>
            </article>`;
          }).join('')}
        </div>
      </div>

      <aside class="order-summary" aria-label="Your Basket">
        <h2 class="order-summary-title">Your Basket</h2>
        <div class="order-summary-rows">
          <div class="order-summary-row">
            <span>Products</span>
            <span>${lineCount} product${lineCount === 1 ? '' : 's'}</span>
          </div>
          <div class="order-summary-row">
            <span>Total units</span>
            <span>${totalQty}</span>
          </div>
          ${totalPrice > 0 ? `
          <div class="order-summary-row order-summary-row--emphasis">
            <span>Estimated Total</span>
            <span style="font-size:18px;color:var(--gold,#c5a059)">₹${totalPrice.toLocaleString('en-IN')}</span>
          </div>` : `
          <div class="order-summary-row order-summary-row--emphasis">
            <span>Order summary</span>
            <span>${totalQty} item${totalQty === 1 ? '' : 's'} ready to send</span>
          </div>`}
        </div>

        <div class="order-wa-block">
          <h3 class="order-message-preview-heading">Your WhatsApp message</h3>
          <p class="order-wa-hint">Order Ref: <strong id="order-ref-label">${escBt(orderRef)}</strong> &mdash; confirm availability on WhatsApp.</p>
          <div class="order-message-preview" id="order-preview">${escBt(waPreview)}</div>
        </div>

        <a href="${escBt(waUrl)}" class="btn btn-primary btn-checkout" id="wa-order-btn" target="_blank" rel="noopener"
           data-order-ref="${escBt(orderRef)}">
          <i class="fa-brands fa-whatsapp"></i> Order on WhatsApp
        </a>
        <a href="products.html" class="order-continue-link">&larr; Continue shopping</a>
      </aside>
    </div>`;

  document.getElementById('wa-order-btn')?.addEventListener('click', () => {
    submitOrderToServer(lines, orderRef, waPreview);
    setTimeout(() => {
      AarifStore.clearCartStore();
      if (typeof updateHeaderBadges === 'function') updateHeaderBadges();
      const root = document.getElementById('basket-page-root');
      if (root) {
        root.innerHTML = `<div class="cart-empty-panel">
          <div class="cart-empty">
            <div class="cart-empty-icon" style="color:var(--gold,#c5a059);font-size:50px;margin-bottom:15px"><i class="fa-solid fa-circle-check"></i></div>
            <h2>Order Sent via WhatsApp!</h2>
            <p>Your order ref is <strong>${escBt(orderRef)}</strong>.</p>
            <p style="color:#a0a0a0;font-size:14px;margin-top:6px;">WhatsApp has been opened with your order summary. We will confirm your order and delivery details shortly.</p>
            <div style="display:flex;gap:12px;justify-content:center;margin-top:24px;flex-wrap:wrap">
              <a href="products.html" class="btn btn-primary"><i class="fa-solid fa-bag-shopping"></i> Continue Shopping</a>
              <a href="index.html" class="btn btn-outline"><i class="fa-solid fa-house"></i> Home</a>
            </div>
          </div>
        </div>`;
      }
    }, 500);
  });

  document.getElementById('basket-clear-btn')?.addEventListener('click', () => {
    if (confirm('Clear all items from your cart?')) {
      AarifStore.clearCartStore();
      renderBasketPage();
      if (typeof updateHeaderBadges === 'function') updateHeaderBadges();
    }
  });
  document.querySelectorAll('.cart-line').forEach(row => {
    const n = row.dataset.name;
    row.querySelector('.qty-minus')?.addEventListener('click', () => {
      const l = getCartLineItems().find(x => (x.product.perfumeName || x.product.productName) === n);
      if (!l) return;
      if (l.qty <= 1) removeFromCart(n); else setCartQuantity(n, l.qty - 1);
    });
    row.querySelector('.qty-plus')?.addEventListener('click', () => {
      const l = getCartLineItems().find(x => (x.product.perfumeName || x.product.productName) === n);
      if (l) setCartQuantity(n, l.qty + 1);
    });
    row.querySelector('.cart-line-remove')?.addEventListener('click', () => removeFromCart(n));
  });
}

let _basketListenerAdded = false;

function renderBasketPageEarly() {
  if (typeof AarifStore !== 'undefined') AarifStore.hydrate(true);
  renderBasketPage();
}

async function initBasketPage() {
  if (typeof AarifStore !== 'undefined') AarifStore.hydrate(true);
  const names = Object.keys(AarifStore.getCartMapObject());
  if (names.length && typeof fetchCartProducts === 'function') {
    try {
      const products = await fetchCartProducts(names);
      if (typeof mergeProductsIntoCatalog === 'function') mergeProductsIntoCatalog(products);
    } catch (_) {}
  }
  renderBasketPage();
  if (!_basketListenerAdded) {
    document.addEventListener('aarif:basket-updated', renderBasketPage);
    _basketListenerAdded = true;
  }
}

if (document.body?.dataset?.page === 'basket') {
  renderBasketPageEarly();
}
