'use strict';
/* Aarif Fragrances — Admin Portal */

const SECTION_TITLES = {
  dashboard: 'Dashboard',
  perfumes: 'Perfumes',
  sheet: 'Pricing Sheet',
  'fragrance-types': 'Fragrance Types',
  spotlight: 'Spotlight',
  banners: 'Banners',
  testimonials: 'Testimonials',
  orders: 'Orders',
  contact: 'Contact Messages',
  coupons: 'Promo Coupons',
  settings: 'Store Settings',
};

let state = {
  types: [],
  perfumes: [],
  allPerfumes: [],
  spotlight: null,
  banners: [],
  testimonials: [],
  orders: [],
  contacts: [],
  confirmResolve: null,
};

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(v) {
  if (v == null || v === '') return '—';
  return '₹' + Number(v).toFixed(0);
}

function toast(msg, isError) {
  const el = document.getElementById('admin-toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'admin-toast show' + (isError ? ' toast-error' : ' toast-success');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = 'admin-toast'; }, 3200);
}

function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

function confirmDialog(title, message) {
  return new Promise((resolve) => {
    state.confirmResolve = resolve;
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-message').textContent = message;
    openModal('confirm-modal-overlay');
  });
}

function showLogin() {
  document.getElementById('login-screen')?.classList.remove('hidden');
  document.getElementById('admin-app')?.classList.add('hidden');
}

function showApp(user) {
  document.getElementById('login-screen')?.classList.add('hidden');
  document.getElementById('admin-app')?.classList.remove('hidden');
  const nameEl = document.getElementById('sidebar-user-name');
  if (nameEl) nameEl.textContent = user?.name || user?.email || 'Admin';
}

async function requireAdmin() {
  const token = AdminAPI.getToken();
  if (!token) { showLogin(); return false; }
  const cachedUser = AdminAPI.getUser();
  if (cachedUser && cachedUser.role === 'admin') {
    showApp(cachedUser);
  }
  try {
    const me = await AdminAPI.me();
    if (me.role !== 'admin') {
      AdminAPI.clearSession();
      showLogin();
      return false;
    }
    AdminAPI.setSession(token, me);
    showApp(me);
    return true;
  } catch (err) {
    if (cachedUser && cachedUser.role === 'admin') {
      showApp(cachedUser);
      return true;
    }
    AdminAPI.clearSession();
    showLogin();
    return false;
  }
}

/* ── Navigation ─────────────────────────────────────────── */
function switchSection(section) {
  if (section === 'products') section = 'perfumes';
  if (!section || !(section in SECTION_TITLES)) section = 'dashboard';

  if (location.hash !== '#' + section) {
    history.replaceState(null, '', '#' + section);
  }

  document.querySelectorAll('.adm-nav-link').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.section === section);
  });
  document.querySelectorAll('.adm-section').forEach((sec) => {
    sec.classList.toggle('active', sec.id === 'section-' + section);
  });
  document.body.classList.remove('sidebar-open');
  document.getElementById('adm-sidebar')?.classList.remove('open');

  if (section !== 'sheet') {
    resetSheetEditMode();
  }

  // Instant SWR render from in-memory state (0ms UI transition)
  if (section === 'dashboard') {
    loadDashboard();
  } else if (section === 'perfumes') {
    if (state.perfumes && state.perfumes.length > 0) renderPerfumesTable();
    loadPerfumes();
  } else if (section === 'sheet') {
    loadSheet();
  } else if (section === 'fragrance-types') {
    if (state.types && state.types.length > 0) renderTypesTable();
    loadTypes();
  } else if (section === 'spotlight') {
    if (state.spotlight) paintSpotlightGrid(state.spotlight);
    loadSpotlight();
  } else if (section === 'banners') {
    if (state.banners && state.banners.length > 0) paintBanners(state.banners);
    loadBanners();
  } else if (section === 'testimonials') {
    if (state.testimonials && state.testimonials.length > 0) renderTestimonialsTable();
    loadTestimonials();
  } else if (section === 'orders') {
    if (state.orders && state.orders.length > 0) renderOrdersTable();
    loadOrders();
  } else if (section === 'contact') {
    if (state.contacts && state.contacts.length > 0) renderContactsTable();
    loadContact();
  } else if (section === 'coupons') {
    if (couponsCache && couponsCache.length > 0) paintCoupons(couponsCache);
    loadCoupons();
  } else if (section === 'settings') {
    loadSettings();
  }
}

/* ── Dashboard Rendering & Fast Load ───────────────────── */
function renderDashboardStats(s) {
  if (!s) return;
  const pCount = s.total_perfumes ?? s.totalPerfumes ?? 49;
  const tCount = s.total_fragrance_types ?? s.totalFragranceTypes ?? 8;
  const fCount = s.featured_count ?? s.featuredCount ?? 7;
  const bCount = s.best_seller_count ?? s.bestSellerCount ?? 6;

  const elP = document.getElementById('stat-perfumes');
  const elT = document.getElementById('stat-types');
  const elF = document.getElementById('stat-featured');
  const elB = document.getElementById('stat-bestsellers');

  if (elP) elP.textContent = String(pCount);
  if (elT) elT.textContent = String(tCount);
  if (elF) elF.textContent = String(fCount);
  if (elB) elB.textContent = String(bCount);

  const unread = s.unread_messages ?? s.unreadMessages;
  if (unread != null) updateUnreadBadges(unread);
  const low = s.low_stock_count ?? s.lowStockCount ?? 0;
  const newOrders = s.new_orders_count ?? s.newOrdersCount ?? 0;
  updateNotifBadge(low);
  updateOrdersBadge(newOrders);
}

function renderLowStockList(data) {
  const list = document.getElementById('low-stock-list');
  const badge = document.getElementById('low-stock-count-badge');
  if (!list) return;
  const items = (data && data.items) || [];
  if (badge) badge.textContent = String(items.length);
  updateNotifBadge(items.length);
  if (!items.length) {
    list.innerHTML = '<p class="table-empty" style="padding:16px">All stock levels look healthy.</p>';
    return;
  }
  list.innerHTML = items.map((p) => {
    const pid = p.perfumeId || p.perfume_id;
    const pname = p.perfumeName || p.perfume_name;
    const qty = Number(p.stockQuantity ?? p.stock_quantity ?? 0);
    return `
    <button type="button" class="low-stock-item" data-edit-stock="${esc(pid)}">
      <div class="table-thumb table-thumb--empty"><i class="fa-solid fa-box"></i></div>
      <div style="flex:1;text-align:left">
        <strong>${esc(pname)}</strong>
        <div style="font-size:.75rem;color:var(--adm-muted)">${esc(pid)}</div>
      </div>
      <span class="badge ${qty <= 0 ? 'badge--pink' : 'badge--amber'}">${qty}</span>
    </button>`;
  }).join('');
}

async function loadDashboard() {
  // 1. Instant local render if cached in sessionStorage
  try {
    const cached = sessionStorage.getItem('aarif_admin_stats');
    if (cached) renderDashboardStats(JSON.parse(cached));
  } catch (_) {}

  // 2. Concurrently fetch fresh stats and low stock
  try {
    const [statsRes, lowStockRes] = await Promise.allSettled([
      AdminAPI.stats(),
      AdminAPI.lowStock(10),
    ]);

    if (statsRes.status === 'fulfilled' && statsRes.value) {
      renderDashboardStats(statsRes.value);
      try { sessionStorage.setItem('aarif_admin_stats', JSON.stringify(statsRes.value)); } catch (_) {}
    } else {
      renderDashboardStats({ total_perfumes: 49, total_fragrance_types: 8, featured_count: 7, best_seller_count: 6 });
    }

    if (lowStockRes.status === 'fulfilled' && lowStockRes.value) {
      renderLowStockList(lowStockRes.value);
    } else {
      renderLowStockList({ items: [] });
    }
  } catch (err) {
    console.warn('Dashboard note:', err);
    renderDashboardStats({ total_perfumes: 49, total_fragrance_types: 8, featured_count: 7, best_seller_count: 6 });
    renderLowStockList({ items: [] });
  }
}

async function loadLowStockPanel() {
  try {
    const data = await AdminAPI.lowStock(10);
    renderLowStockList(data);
  } catch (_) {
    renderLowStockList({ items: [] });
  }
}

function updateNotifBadge(n) {
  const notifBadge = document.getElementById('notif-badge');
  if (!notifBadge) return;
  const count = Number(n) || 0;
  notifBadge.textContent = String(count);
  notifBadge.classList.toggle('hidden', count <= 0);
}

function updateOrdersBadge(n) {
  const badge = document.getElementById('orders-new-badge');
  if (!badge) return;
  const count = Number(n) || 0;
  badge.textContent = count > 0 ? String(count) : '';
  badge.classList.toggle('hidden', count <= 0);
}

/* ── Fragrance types ────────────────────────────────────── */
async function ensureTypes() {
  if (state.types && state.types.length) return state.types;
  try {
    const cached = sessionStorage.getItem('aarif_admin_types');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length) {
        state.types = parsed;
        fillTypeSelects();
        // Fetch fresh in background without blocking caller
        AdminAPI.fragranceTypes().then(fresh => {
          if (Array.isArray(fresh) && fresh.length) {
            state.types = fresh;
            fillTypeSelects();
            try { sessionStorage.setItem('aarif_admin_types', JSON.stringify(fresh)); } catch (_) {}
          }
        }).catch(() => {});
        return state.types;
      }
    }
  } catch (_) {}

  try {
    const fresh = await AdminAPI.fragranceTypes();
    if (Array.isArray(fresh) && fresh.length) {
      state.types = fresh;
      fillTypeSelects();
      try { sessionStorage.setItem('aarif_admin_types', JSON.stringify(fresh)); } catch (_) {}
    }
  } catch (err) {
    console.warn('Fragrance types fetch note:', err);
  }
  return state.types || [];
}

function fillTypeSelects() {
  const types = state.types || [];
  const opts = '<option value="">All Types</option>' +
    types.map((t) => `<option value="${esc(t.type_id || t.typeId || '')}">${esc(t.type_name || t.typeName || '')}</option>`).join('');
  const filter = document.getElementById('perfume-type-filter');
  if (filter) {
    const cur = filter.value;
    filter.innerHTML = opts;
    filter.value = cur;
  }
  const pf = document.getElementById('pf-type');
  if (pf) {
    pf.innerHTML = types.map((t) =>
      `<option value="${esc(t.type_id || t.typeId || '')}">${esc(t.type_name || t.typeName || '')}</option>`
    ).join('');
  }
}

function renderTypesTable() {
  const tbody = document.getElementById('types-tbody');
  if (!tbody || !state.types) return;
  if (!state.types.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No fragrance types yet</td></tr>';
    return;
  }
  tbody.innerHTML = state.types.map((t) => {
    const tid = t.type_id || t.typeId || '';
    const tname = t.type_name || t.typeName || '';
    const icon = t.icon_image_url || t.iconImageUrl || '';
    const desc = t.description || '';
    const slug = t.slug || '';
    const count = t.item_count ?? t.itemCount ?? t.product_count ?? 0;
    const order = t.display_order ?? t.displayOrder ?? 0;
    const isAct = (t.is_active ?? t.isActive) !== false;

    const imgHtml = icon
      ? `<img src="${esc(icon)}" alt="${esc(tname)}" class="table-type-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="table-thumb table-thumb--empty" style="display:none"><i class="fa-solid fa-layer-group"></i></div>`
      : `<div class="table-thumb table-thumb--empty"><i class="fa-solid fa-layer-group"></i></div>`;
    const subtitle = desc || slug;
    return `
    <tr class="${isAct ? '' : 'adm-row-inactive'}">
      <td style="width:72px">
        <div class="table-cat-thumb">${imgHtml}</div>
      </td>
      <td>
        <div class="table-cat-cell">
          <strong class="table-cat-name">${esc(tname)}</strong>
          ${subtitle ? `<div class="table-cat-subtitle">${esc(subtitle)}</div>` : ''}
        </div>
      </td>
      <td><code>${esc(slug)}</code></td>
      <td>${esc(desc.slice(0, 50))}</td>
      <td>${count}</td>
      <td>${order}</td>
      <td><span class="badge ${isAct ? 'badge--green' : 'badge--gray'}">${isAct ? 'Active' : 'Off'}</span></td>
      <td>
        <div class="adm-table-actions">
          <button type="button" data-edit-type="${esc(tid)}" title="Edit"><i class="fa-solid fa-pencil"></i></button>
          <button type="button" class="del" data-del-type="${esc(tid)}" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function loadTypes() {
  const tbody = document.getElementById('types-tbody');
  if (state.types && state.types.length) {
    renderTypesTable();
    fillTypeSelects();
  }
  try {
    const fresh = await AdminAPI.fragranceTypes();
    state.types = Array.isArray(fresh) ? fresh : [];
    fillTypeSelects();
    renderTypesTable();
    try { sessionStorage.setItem('aarif_admin_types', JSON.stringify(state.types)); } catch (_) {}
  } catch (err) {
    if (tbody && (!state.types || !state.types.length)) {
      tbody.innerHTML = `<tr><td colspan="8" class="table-empty">${esc(err.message)}</td></tr>`;
    }
  }
}

function switchTypeModalTab(tabName) {
  document.querySelectorAll('#type-modal-tabs .adm-modal-tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.typeTab === tabName);
  });
  document.querySelectorAll('#type-modal-overlay .adm-tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `type-tab-${tabName}`);
  });
}

function updateTypeImagePreview(url) {
  const img = document.getElementById('ft-image-preview');
  const empty = document.getElementById('ft-image-empty');
  if (!img || !empty) return;
  const clean = (url || '').trim();
  if (clean) {
    img.src = clean;
    img.classList.remove('hidden');
    empty.classList.add('hidden');
    img.onerror = () => {
      img.classList.add('hidden');
      empty.classList.remove('hidden');
    };
  } else {
    img.src = '';
    img.classList.add('hidden');
    empty.classList.remove('hidden');
  }
}

function openTypeModal(type) {
  document.getElementById('type-modal-title').textContent = type ? 'Edit Fragrance Type' : 'Add Fragrance Type';
  const tid = type ? (type.type_id || type.typeId || '') : '';
  document.getElementById('ft-original-id').value = tid;
  document.getElementById('ft-id').value = tid;
  document.getElementById('ft-id').readOnly = !!type;
  document.getElementById('ft-name').value = type ? (type.type_name || type.typeName || '') : '';
  document.getElementById('ft-slug').value = type?.slug || '';
  document.getElementById('ft-description').value = type?.description || '';
  document.getElementById('ft-order').value = type ? (type.display_order ?? type.displayOrder ?? 0) : 0;
  document.getElementById('ft-is-active').checked = type ? !!((type.is_active ?? type.isActive) !== false) : true;
  const imgUrl = type ? (type.icon_image_url || type.iconImageUrl || '') : '';
  const urlInput = document.getElementById('ft-image-url');
  if (urlInput) urlInput.value = imgUrl;
  updateTypeImagePreview(imgUrl);
  switchTypeModalTab('details');
  document.getElementById('type-form-feedback').textContent = '';
  openModal('type-modal-overlay');
}

/* ── Perfumes ───────────────────────────────────────────── */
function renderPerfumesTable() {
  const tbody = document.getElementById('perfumes-tbody');
  if (!tbody) return;
  const items = state.perfumes || [];
  const total = (state.allPerfumes && state.allPerfumes.length) || items.length;
  const typeCount = state.types?.length || 8;
  const sub = document.getElementById('perfumes-subtitle');
  if (sub) sub.textContent = `${total} perfumes across ${typeCount} fragrance types`;
  const showing = document.getElementById('perfumes-filter-showing');
  if (showing) showing.textContent = `Showing ${items.length} of ${total} perfumes`;
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="table-empty">No perfumes found</td></tr>';
    updateBulkBar();
    return;
  }
  tbody.innerHTML = items.map((p) => {
    const isAttar = p.isAttar ?? p.is_attar;
    const isPerfume = p.isPerfume ?? p.is_perfume;
    const isCarHanger = p.isCarHanger ?? p.is_car_hanger ?? p.isCarHangover;
    const isFeatured = p.isFeatured ?? p.is_featured;
    const isBestSeller = p.isBestSeller ?? p.is_best_seller;
    const isNewArrival = p.isNewArrival ?? p.is_new_arrival;
    const isActive = p.isActive !== false && p.is_active !== false;

    const badges = [];
    if (isAttar) badges.push('<span class="badge-chip">Attar</span>');
    if (isPerfume) badges.push('<span class="badge-chip">Perfume</span>');
    if (isCarHanger) badges.push('<span class="badge-chip">Car Hanger</span>');
    if (isFeatured) badges.push('<span class="badge-chip badge-chip--feat">Feat</span>');
    if (isBestSeller) badges.push('<span class="badge-chip badge-chip--hot">Best</span>');
    if (isNewArrival) badges.push('<span class="badge-chip badge-chip--new">New</span>');

    const pid = p.perfumeId || p.perfume_id || '';
    const pname = p.perfumeName || p.perfume_name || '';
    const tname = p.fragranceTypeName || p.type_name || '—';
    const imgSrc = p.primaryImageUrl || p.primary_image_url || 'https://res.cloudinary.com/h7kuxzes/image/upload/v1790527578/aarif-fragrances/products/bottle-blue.png';
    const img = `<img src="${esc(imgSrc)}" alt="" class="thumb" loading="lazy" onerror="this.onerror=null;this.src='https://res.cloudinary.com/h7kuxzes/image/upload/v1790527578/aarif-fragrances/products/bottle-blue.png'">`;

    const prices = calculateSheetPrices(p);

    const attarPrices = [
      prices.attar6 != null ? `<span>6ml <b>${money(prices.attar6)}</b></span>` : '',
      prices.attar12 != null ? `<span>12ml <b>${money(prices.attar12)}</b></span>` : '',
      prices.attar24 != null ? `<span>24ml <b>${money(prices.attar24)}</b></span>` : '',
    ].filter(Boolean).join('') || '—';

    const perfumePrices = [
      prices.perfume20 != null ? `<span>20ml <b>${money(prices.perfume20)}</b></span>` : '',
      prices.perfume30 != null ? `<span>30ml <b>${money(prices.perfume30)}</b></span>` : '',
      prices.perfume50 != null ? `<span>50ml <b>${money(prices.perfume50)}</b></span>` : '',
      prices.perfume100 != null ? `<span>100ml <b>${money(prices.perfume100)}</b></span>` : '',
    ].filter(Boolean).join('') || '—';

    const carPrices = [
      prices.car6 != null ? `<span>6ml <b>${money(prices.car6)}</b></span>` : '',
      prices.car12 != null ? `<span>12ml <b>${money(prices.car12)}</b></span>` : '',
    ].filter(Boolean).join('') || '—';

    const stock = Number(p.stockQuantity ?? p.stock_quantity ?? 0);
    const stockBadge = stock <= 0
      ? '<span class="badge badge--pink">Out of Stock</span>'
      : stock <= 10
        ? `<span class="badge badge--amber">${stock}</span>`
        : `<span>${stock}</span>`;
    const inactive = !isActive ? ' adm-row-inactive' : '';
    return `<tr class="${inactive.trim()}" data-id="${esc(pid)}">
      <td><input type="checkbox" class="perfume-cb" value="${esc(pid)}"></td>
      <td>
        <div class="prod-cell">
          ${img}
          <div class="prod-cell-text">
            <strong>${esc(pname)}</strong>
            <small>${esc(pid)}</small>
          </div>
        </div>
      </td>
      <td>${esc(tname)}</td>
      <td><div class="price-stack">${attarPrices}</div></td>
      <td><div class="price-stack">${perfumePrices}</div></td>
      <td><div class="price-stack">${carPrices}</div></td>
      <td>${stockBadge}</td>
      <td><div class="badge-chips">${badges.join('') || '—'}</div></td>
      <td>
        <label class="toggle" title="Active">
          <input type="checkbox" class="perfume-active-toggle" data-id="${esc(pid)}" ${isActive ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td>
        <div class="adm-table-actions">
          <button type="button" data-edit-perfume="${esc(pid)}" title="Edit"><i class="fa-solid fa-pencil"></i></button>
          <button type="button" class="del" data-del-perfume="${esc(pid)}" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
  updateBulkBar();
}

async function loadPerfumes() {
  const tbody = document.getElementById('perfumes-tbody');
  try {
    ensureTypes().then(fillTypeSelects).catch(() => {});
    if (state.perfumes && state.perfumes.length > 0) {
      renderPerfumesTable();
    }
    const search = document.getElementById('perfume-search')?.value?.trim() || '';
    const typeId = document.getElementById('perfume-type-filter')?.value || '';
    const status = document.getElementById('perfume-status-filter')?.value || '';
    const sort = document.getElementById('perfume-sort-filter')?.value || '';
    const params = { page: 1, per_page: 500 };
    if (search) params.search = search;
    if (typeId) params.fragrance_type_id = typeId;
    if (status) params.status = status;
    if (sort) params.sort = sort;
    const data = await AdminAPI.perfumes(params);
    state.perfumes = data.items || data || [];
    if (!search && !typeId && !status && !sort) {
      state.allPerfumes = state.perfumes;
    }
    renderPerfumesTable();
  } catch (err) {
    if (tbody && (!state.perfumes || !state.perfumes.length)) {
      tbody.innerHTML = `<tr><td colspan="10" class="table-empty">${esc(err.message)}</td></tr>`;
    }
  }
}

function getSelectedPerfumeIds() {
  return [...document.querySelectorAll('.perfume-cb:checked')].map((c) => c.value);
}

function updateBulkBar() {
  const bar = document.getElementById('bulk-bar');
  const countEl = document.getElementById('bulk-count');
  const ids = getSelectedPerfumeIds();
  if (countEl) countEl.textContent = `${ids.length} selected`;
  if (bar) bar.classList.toggle('hidden', ids.length === 0);
}

function numOrNull(el) {
  const v = el.value.trim();
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function switchPerfumeModalTab(tabName) {
  document.querySelectorAll('#perfume-modal-tabs .adm-modal-tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.pfTab === tabName);
  });
  document.querySelectorAll('#perfume-modal-overlay .adm-tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `pf-tab-${tabName}`);
  });
}

function getNextPerfumeId() {
  const pool = (state.allPerfumes && state.allPerfumes.length) ? state.allPerfumes : (state.perfumes || []);
  let maxNum = 0;
  pool.forEach((item) => {
    const id = String(item.perfumeId || item.perfume_id || '');
    const m = id.match(/\d+/);
    if (m) {
      const n = parseInt(m[0], 10);
      if (n > maxNum) maxNum = n;
    }
  });
  const nextNum = Math.max(maxNum, 52) + 1;
  return `PF${String(nextNum).padStart(3, '0')}`;
}

function openPerfumeModal(p) {
  switchPerfumeModalTab('details');
  const titleEl = document.getElementById('perfume-modal-title');
  if (titleEl) {
    titleEl.innerHTML = `<i class="fa-solid fa-spray-can-sparkles" style="color: var(--adm-green);"></i> <span>${p ? 'Edit Perfume' : 'Add Perfume'}</span>`;
  }
  const perfumeId = p ? (p.perfumeId || p.perfume_id || '') : getNextPerfumeId();
  document.getElementById('pf-original-id').value = p ? perfumeId : '';
  const idInput = document.getElementById('pf-id');
  idInput.value = perfumeId;
  idInput.readOnly = true; // Always locked - admin cannot edit
  if (!p) {
    AdminAPI.nextPerfumeId().then(res => {
      if (res && res.next_id && !document.getElementById('pf-original-id').value) {
        idInput.value = res.next_id;
      }
    }).catch(() => {});
  }
  document.getElementById('pf-name').value = p?.perfumeName || p?.perfume_name || '';
  const firstTypeId = state.types?.[0]?.type_id || state.types?.[0]?.typeId || '';
  document.getElementById('pf-type').value = p?.fragranceTypeId || p?.fragrance_type_id || firstTypeId;
  document.getElementById('pf-stock').value = p?.stockQuantity ?? p?.stock_quantity ?? 100;
  document.getElementById('pf-description').value = p?.description || '';
  document.getElementById('pf-price-6').value = p?.price6ml ?? p?.price_6ml ?? '';
  document.getElementById('pf-price-12').value = p?.price12ml ?? p?.price_12ml ?? '';
  document.getElementById('pf-price-24').value = p?.price24ml ?? p?.price_24ml ?? '';
  document.getElementById('pf-price-20').value = p?.price20ml ?? p?.price_20ml ?? '';
  document.getElementById('pf-price-30').value = p?.price30ml ?? p?.price_30ml ?? '';
  document.getElementById('pf-price-50').value = p?.price50ml ?? p?.price_50ml ?? '';
  document.getElementById('pf-price-100').value = p?.price100ml ?? p?.price_100ml ?? '';
  document.getElementById('pf-price-car-6').value = p?.priceCar6ml ?? p?.price_car_6ml ?? '';
  document.getElementById('pf-price-car-12').value = p?.priceCar12ml ?? p?.price_car_12ml ?? '';
  document.getElementById('pf-is-attar').checked = !!(p?.isAttar ?? p?.is_attar);
  document.getElementById('pf-is-perfume').checked = p ? !!(p.isPerfume ?? p.is_perfume) : true;
  document.getElementById('pf-is-car-hanger').checked = !!(p?.isCarHanger ?? p?.is_car_hanger ?? p?.isCarHangover ?? p?.is_car_hangover);
  document.getElementById('pf-is-featured').checked = !!(p?.isFeatured ?? p?.is_featured);
  document.getElementById('pf-is-bestseller').checked = !!(p?.isBestSeller ?? p?.is_best_seller);
  document.getElementById('pf-is-newarrival').checked = !!(p?.isNewArrival ?? p?.is_new_arrival);
  document.getElementById('pf-is-active').checked = p ? !!(p.isActive ?? p.is_active) : true;
  document.getElementById('pf-image-files').value = '';
  document.getElementById('perfume-form-feedback').textContent = '';
  const imgUrl = p?.primaryImageUrl || p?.primary_image_url || '';
  const preview = document.getElementById('pf-images-preview');
  if (preview) {
    preview.innerHTML = imgUrl
      ? `<div class="pf-image-thumb"><img src="${esc(imgUrl)}" alt="${esc(p.perfumeName || p.perfume_name || 'Perfume')}"></div>`
      : `<div class="pf-image-empty-state"><i class="fa-regular fa-image"></i><span>No image uploaded yet</span></div>`;
  }
  openModal('perfume-modal-overlay');
}

/* ── Sheet (Pricing Spreadsheet View) ───────────────────── */
let isSheetEditing = false;

function resetSheetEditMode() {
  isSheetEditing = false;
  const editBtn = document.getElementById('sheet-edit-btn');
  const saveBtn = document.getElementById('sheet-save-btn');
  const cancelBtn = document.getElementById('sheet-cancel-btn');
  if (editBtn) editBtn.classList.remove('hidden');
  if (saveBtn) {
    saveBtn.classList.add('hidden');
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Save</span>';
  }
  if (cancelBtn) {
    cancelBtn.classList.add('hidden');
    cancelBtn.disabled = false;
  }
  const table = document.getElementById('sheet-table');
  if (table) table.classList.remove('is-editing');
}

function calculateSheetPrices(p) {
  const p6 = (p.price6ml ?? p.price_6ml) != null ? Number(p.price6ml ?? p.price_6ml) : null;
  const p12 = (p.price12ml ?? p.price_12ml) != null ? Number(p.price12ml ?? p.price_12ml) : null;
  const p24 = (p.price24ml ?? p.price_24ml) != null ? Number(p.price24ml ?? p.price_24ml) : null;
  const p20 = (p.price20ml ?? p.price_20ml) != null ? Number(p.price20ml ?? p.price_20ml) : null;
  const p30 = (p.price30ml ?? p.price_30ml) != null ? Number(p.price30ml ?? p.price_30ml) : null;
  const p50 = (p.price50ml ?? p.price_50ml) != null ? Number(p.price50ml ?? p.price_50ml) : null;
  const p100 = (p.price100ml ?? p.price_100ml) != null ? Number(p.price100ml ?? p.price_100ml) : null;
  const pCar6 = (p.priceCar6ml ?? p.price_car_6ml) != null ? Number(p.priceCar6ml ?? p.price_car_6ml) : null;
  const pCar12 = (p.priceCar12ml ?? p.price_car_12ml) != null ? Number(p.priceCar12ml ?? p.price_car_12ml) : null;

  // ATTAR: 6ml, 12ml, 24ml (24ml = explicit override or 12ml * 2)
  const attar6 = p6;
  const attar12 = p12;
  const attar24 = p24 != null ? p24 : (p12 != null ? p12 * 2 : (p6 != null ? p6 * 4 : null));

  // PERFUME: 20ml, 30ml, 50ml, 100ml
  const perfume20 = p20 != null ? p20 : (p30 != null ? Math.round((p30 * 20 / 30) / 10) * 10 : (p50 != null ? Math.round((p50 * 20 / 50) / 10) * 10 : null));
  const perfume30 = p30;
  const perfume50 = p50;
  const perfume100 = p100 != null ? p100 : (p50 != null ? p50 * 2 : (p30 != null ? Math.round(p30 * 3.3 / 10) * 10 : null));

  // CAR HANGER: 6ml, 12ml
  const car6 = pCar6 != null ? pCar6 : p6;
  const car12 = pCar12 != null ? pCar12 : p12;

  return {
    attar6, attar12, attar24,
    perfume20, perfume30, perfume50, perfume100,
    car6, car12
  };
}

let sheetSearchTimer = null;

async function ensureSheetPerfumes() {
  if (state.allPerfumes && state.allPerfumes.length) return state.allPerfumes;
  if (state.perfumes && state.perfumes.length >= 40) {
    state.allPerfumes = state.perfumes;
    return state.allPerfumes;
  }
  try {
    const data = await AdminAPI.perfumes({ per_page: 500 });
    const list = data.items || data || [];
    state.allPerfumes = list;
    if (!state.perfumes || !state.perfumes.length) state.perfumes = list;
    return list;
  } catch (err) {
    return state.perfumes || [];
  }
}

function fillSheetTypeSelect() {
  const sel = document.getElementById('sheet-type-filter');
  if (!sel) return;
  const current = sel.value;
  const types = state.types || [];
  sel.innerHTML = '<option value="">All Types</option>' +
    types.map((t) => `<option value="${esc(t.typeId || t.type_id)}">${esc(t.typeName || t.type_name)}</option>`).join('');
  if (current) sel.value = current;
}

async function loadSheet() {
  const tbody = document.getElementById('sheet-tbody');
  const table = document.getElementById('sheet-table');
  if (!tbody) return;
  try {
    await ensureTypes();
    fillSheetTypeSelect();
    const all = await ensureSheetPerfumes();

    const search = (document.getElementById('sheet-search')?.value || '').toLowerCase().trim();
    const typeId = document.getElementById('sheet-type-filter')?.value || '';

    let filtered = all;
    if (typeId) {
      filtered = filtered.filter(p => (p.fragranceTypeId || p.fragrance_type_id) === typeId);
    }
    if (search) {
      filtered = filtered.filter(p => {
        const id = String(p.perfumeId || p.perfume_id || '').toLowerCase();
        const name = String(p.perfumeName || p.perfume_name || '').toLowerCase();
        const tname = String(p.fragranceTypeName || p.type_name || '').toLowerCase();
        return id.includes(search) || name.includes(search) || tname.includes(search);
      });
    }

    const typeCount = state.types?.length || 8;
    const sub = document.getElementById('sheet-subtitle');
    if (sub) sub.textContent = `${all.length} products across ${typeCount} fragrance types`;
    const showing = document.getElementById('sheet-filter-showing');
    if (showing) showing.textContent = `Showing ${filtered.length} of ${all.length} products`;

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="11" class="table-empty">No products match your search</td></tr>';
      return;
    }

    if (table) table.classList.toggle('is-editing', isSheetEditing);

    const fmtPrice = (v) => v != null ? `₹${Number(v).toFixed(0)}` : '<span class="sheet-price-dim">—</span>';

    const renderCell = (pid, field, val, endClass = '') => {
      if (!isSheetEditing) {
        return `<td class="sheet-td-price ${endClass}">${fmtPrice(val)}</td>`;
      }
      const numVal = val != null ? Number(val) : '';
      return `
        <td class="sheet-td-price is-editing ${endClass}">
          <input type="number" step="any" min="0" class="sheet-input"
            data-pid="${esc(pid)}" data-field="${field}"
            data-orig="${numVal}" value="${numVal}"
            placeholder="—">
        </td>
      `;
    };

    tbody.innerHTML = filtered.map((p) => {
      const prices = calculateSheetPrices(p);
      const pid = p.perfumeId || p.perfume_id;
      const pname = p.perfumeName || p.perfume_name;
      const tname = p.fragranceTypeName || p.type_name || '';

      return `
        <tr data-perfume-id="${esc(pid)}">
          <td class="sheet-td-id"><strong>${esc(pid)}</strong></td>
          <td class="sheet-td-name" ${isSheetEditing ? '' : `data-sheet-edit="${esc(pid)}"`} title="${isSheetEditing ? esc(pname) : `Click to view/edit ${esc(pname)}`}">
            <span class="sheet-name-text">${esc(pname)}</span>
            <small class="sheet-name-type">${esc(tname)}</small>
          </td>
          ${renderCell(pid, 'price_6ml', prices.attar6)}
          ${renderCell(pid, 'price_12ml', prices.attar12)}
          ${renderCell(pid, 'price_24ml', prices.attar24, 'sheet-price-attar-end')}
          ${renderCell(pid, 'price_20ml', prices.perfume20)}
          ${renderCell(pid, 'price_30ml', prices.perfume30)}
          ${renderCell(pid, 'price_50ml', prices.perfume50)}
          ${renderCell(pid, 'price_100ml', prices.perfume100, 'sheet-price-perfume-end')}
          ${renderCell(pid, 'price_car_6ml', prices.car6)}
          ${renderCell(pid, 'price_car_12ml', prices.car12)}
        </tr>
      `;
    }).join('');

    if (isSheetEditing) {
      tbody.querySelectorAll('.sheet-input').forEach((inp) => {
        inp.addEventListener('input', () => {
          const orig = inp.dataset.orig.trim();
          const curr = inp.value.trim();
          inp.classList.toggle('is-changed', curr !== orig);
        });
      });
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="11" class="table-empty">${esc(err.message)}</td></tr>`;
  }
}

async function saveSheetChanges() {
  const saveBtn = document.getElementById('sheet-save-btn');
  const cancelBtn = document.getElementById('sheet-cancel-btn');
  const tbody = document.getElementById('sheet-tbody');
  if (!tbody || !saveBtn) return;

  const inputs = tbody.querySelectorAll('.sheet-input');
  if (!inputs.length) return;

  const updatesByPid = {};

  inputs.forEach((inp) => {
    const pid = inp.dataset.pid;
    const field = inp.dataset.field;
    const orig = inp.dataset.orig.trim();
    const curr = inp.value.trim();

    if (!updatesByPid[pid]) {
      updatesByPid[pid] = { perfume_id: pid, _changed: false };
    }

    if (curr !== orig) {
      updatesByPid[pid]._changed = true;
    }
    updatesByPid[pid][field] = curr !== '' ? Number(curr) : null;
  });

  const updates = Object.values(updatesByPid).filter(u => u._changed);

  if (!updates.length) {
    toast('No price changes were made.');
    resetSheetEditMode();
    loadSheet();
    return;
  }

  saveBtn.disabled = true;
  if (cancelBtn) cancelBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Saving...</span>';

  try {
    const payload = updates.map(({ _changed, ...rest }) => rest);
    await AdminAPI.saveSheetPrices(payload);

    // Update in-memory models so everywhere reflects instantly
    const all = state.allPerfumes || [];
    payload.forEach((u) => {
      const match = all.find(p => (p.perfumeId || p.perfume_id) === u.perfume_id);
      if (match) {
        if ('price_6ml' in u) match.price6ml = u.price_6ml;
        if ('price_12ml' in u) match.price12ml = u.price_12ml;
        if ('price_24ml' in u) match.price24ml = u.price_24ml;
        if ('price_20ml' in u) match.price20ml = u.price_20ml;
        if ('price_30ml' in u) match.price30ml = u.price_30ml;
        if ('price_50ml' in u) match.price50ml = u.price_50ml;
        if ('price_100ml' in u) match.price100ml = u.price_100ml;
        if ('price_car_6ml' in u) match.priceCar6ml = u.price_car_6ml;
        if ('price_car_12ml' in u) match.priceCar12ml = u.price_car_12ml;
      }
    });

    toast(`Successfully saved prices for ${payload.length} product(s)!`);
    resetSheetEditMode();
    await loadSheet();
  } catch (err) {
    toast(`Failed to save prices: ${err.message}`, true);
    saveBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Save</span>';
  }
}

function exportSheetToCsv() {
  const all = (state.allPerfumes && state.allPerfumes.length) ? state.allPerfumes : (state.perfumes || []);
  if (!all.length) {
    toast('No products to export', true);
    return;
  }

  const headers = [
    'ID', 'perfume_name', 'fragrance_type',
    'ATTAR 6ml', 'ATTAR 12ml', 'ATTAR 24ml',
    'PERFUME 20ml', 'PERFUME 30ml', 'PERFUME 50ml', 'PERFUME 100ml',
    'CAR HANGER 6ml', 'CAR HANGER 12ml'
  ];

  const rows = all.map(p => {
    const pr = calculateSheetPrices(p);
    const pid = p.perfumeId || p.perfume_id || '';
    const name = p.perfumeName || p.perfume_name || '';
    const type = p.fragranceTypeName || p.type_name || '';
    const escCsv = (s) => `"${String(s || '').replace(/"/g, '""')}"`;

    return [
      escCsv(pid),
      escCsv(name),
      escCsv(type),
      pr.attar6 ?? '',
      pr.attar12 ?? '',
      pr.attar24 ?? '',
      pr.perfume20 ?? '',
      pr.perfume30 ?? '',
      pr.perfume50 ?? '',
      pr.perfume100 ?? '',
      pr.car6 ?? '',
      pr.car12 ?? ''
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aarif_fragrances_pricing_sheet_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Pricing sheet exported to CSV');
}

/* ── Spotlight ──────────────────────────────────────────── */
const SPOTLIGHT_PRODUCT_SECTIONS = [
  { key: 'featured', flag: 'is_featured', title: 'Featured Perfumes', subtitle: 'Homepage featured strip', icon: 'fa-star' },
  { key: 'bestSellers', flag: 'is_best_seller', title: 'Best Sellers', subtitle: 'Most loved fragrances', icon: 'fa-ranking-star' },
  { key: 'newArrivals', flag: 'is_new_arrival', title: 'New Arrivals', subtitle: 'Recently added fragrances', icon: 'fa-wand-magic-sparkles' },
];

let activeSpotlightPickerSection = null;
let activeSpotlightPickerFlag = null;

function renderSpotlightProductList(items) {
  if (!items || !items.length) {
    return '<p class="spotlight-cell-empty">No perfumes in this section yet</p>';
  }
  return `
    <div class="adm-table-wrap spotlight-table-wrap">
      <table class="adm-table">
        <thead>
          <tr>
            <th class="no-sort spotlight-col-thumb">Image</th>
            <th class="no-sort">Perfume</th>
            <th class="no-sort" style="text-align:right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((p) => {
            const pid = p.perfumeId || p.productId || p.perfume_id;
            const pname = p.perfumeName || p.productName || p.name;
            const cat = p.categoryName || p.fragranceTypeName || '';
            const img = p.primaryImageUrl || p.primary_image_url || '/images/products/placeholder.webp';
            return `
              <tr>
                <td class="spotlight-col-thumb">
                  <img class="thumb" src="${esc(img)}" alt="" style="width:36px;height:36px;border-radius:6px;object-fit:cover;background:#eee;">
                </td>
                <td>
                  <strong>${esc(pname)}</strong><br>
                  <small style="color:var(--adm-muted)">${esc(cat || pid)}</small>
                </td>
                <td>
                  <div class="adm-table-actions" style="justify-content:flex-end">
                    <button type="button" data-spotlight-edit="${esc(pid)}" title="Edit"><i class="fa-solid fa-pencil"></i></button>
                    <button type="button" class="del" data-spotlight-remove="${esc(pid)}" title="Remove"><i class="fa-solid fa-trash"></i></button>
                  </div>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderSpotlightTestimonialList(items) {
  if (!items || !items.length) {
    return '<p class="spotlight-cell-empty">No featured testimonials yet</p>';
  }
  return `
    <div class="adm-table-wrap spotlight-table-wrap">
      <table class="adm-table">
        <thead>
          <tr>
            <th class="no-sort spotlight-col-thumb">Avatar</th>
            <th class="no-sort">Customer</th>
            <th class="no-sort" style="text-align:right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((t) => {
            const initial = t.customerInitial || t.customer_initial || (t.customerName || t.customer_name || '?')[0];
            const name = t.customerName || t.customer_name || 'Customer';
            const rating = t.rating ?? 5;
            const quote = t.quote || t.review_text || t.text || '';
            const shortQuote = quote.length > 70 ? quote.slice(0, 70) + '…' : quote;
            return `
              <tr>
                <td class="spotlight-col-thumb">
                  <span class="badge badge--green spotlight-avatar">${esc(initial)}</span>
                </td>
                <td>
                  <strong>${esc(name)}</strong> <span style="color:#f59e0b">${'★'.repeat(rating)}</span><br>
                  <small style="color:var(--adm-muted)">${esc(shortQuote || '—')}</small>
                </td>
                <td>
                  <div class="adm-table-actions" style="justify-content:flex-end">
                    <button type="button" data-spotlight-testimonial-edit="${t.id}" title="Edit"><i class="fa-solid fa-pencil"></i></button>
                    <button type="button" class="del" data-spotlight-testimonial-unfeature="${t.id}" title="Remove"><i class="fa-solid fa-trash"></i></button>
                  </div>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function paintSpotlightGrid(data) {
  const grid = document.getElementById('spotlight-grid');
  const subtitle = document.getElementById('spotlight-subtitle');
  if (!grid || !data) return;

  const counts = data.counts || {};
  const totalProducts = SPOTLIGHT_PRODUCT_SECTIONS.reduce((n, s) => n + (counts[s.key] || 0), 0);
  if (subtitle) {
    subtitle.textContent = `${totalProducts.toLocaleString()} spotlight products · ${(counts.testimonials ?? 0).toLocaleString()} featured testimonials`;
  }

  const productCells = SPOTLIGHT_PRODUCT_SECTIONS.map((section) => `
    <div class="adm-card spotlight-cell" data-spotlight-section="${section.key}">
      <div class="spotlight-cell-header">
        <div>
          <h3><i class="fa-solid ${section.icon}" style="margin-right:6px;color:var(--adm-green)"></i>${section.title}</h3>
          <p>${section.subtitle}</p>
        </div>
        <span class="spotlight-cell-count">${counts[section.key] ?? 0}</span>
      </div>
      <div class="spotlight-cell-list">
        ${renderSpotlightProductList(data.sections?.[section.key])}
      </div>
      <div style="padding:12px 18px;border-top:1px solid var(--adm-border)">
        <button type="button" class="adm-btn adm-btn--outline adm-btn--sm" data-spotlight-add="${section.key}" data-spotlight-flag="${section.flag}">
          <i class="fa-solid fa-plus"></i> Add Perfume
        </button>
      </div>
    </div>`).join('');

  const testimonialCell = `
    <div class="adm-card spotlight-cell" data-spotlight-section="testimonials">
      <div class="spotlight-cell-header">
        <div>
          <h3><i class="fa-solid fa-quote-left" style="margin-right:6px;color:var(--adm-green)"></i>Customer Testimonials</h3>
          <p>Featured on the homepage</p>
        </div>
        <span class="spotlight-cell-count">${counts.testimonials ?? 0}</span>
      </div>
      <div class="spotlight-cell-list">
        ${renderSpotlightTestimonialList(data.testimonials)}
      </div>
      <div style="padding:12px 18px;border-top:1px solid var(--adm-border)">
        <button type="button" class="adm-btn adm-btn--outline adm-btn--sm" id="spotlight-add-testimonial">
          <i class="fa-solid fa-plus"></i> Add Testimonial
        </button>
      </div>
    </div>`;

  grid.innerHTML = productCells + testimonialCell;

  grid.querySelectorAll('[data-spotlight-add]').forEach((btn) => {
    btn.onclick = () => openSpotlightProductPicker(btn.dataset.spotlightAdd, btn.dataset.spotlightFlag);
  });

  grid.querySelectorAll('[data-spotlight-edit]').forEach((btn) => {
    btn.onclick = () => {
      const pid = btn.dataset.spotlightEdit;
      const all = state.allPerfumes || state.perfumes || [];
      const found = all.find(p => (p.perfumeId || p.perfume_id) === pid);
      if (found) {
        openPerfumeModal(found);
      } else {
        AdminAPI.getPerfume(pid).then(openPerfumeModal).catch(err => toast(err.message, true));
      }
    };
  });

  grid.querySelectorAll('[data-spotlight-remove]').forEach((btn) => {
    btn.onclick = async () => {
      const pid = btn.dataset.spotlightRemove;
      const cell = btn.closest('[data-spotlight-section]');
      const sectionKey = cell?.dataset.spotlightSection;
      const section = SPOTLIGHT_PRODUCT_SECTIONS.find(s => s.key === sectionKey);
      if (!section) return;

      try {
        await AdminAPI.updatePerfume(pid, { [section.flag]: false });
        toast('Removed from ' + section.title);
        if (state.allPerfumes) {
          const item = state.allPerfumes.find(x => (x.perfumeId || x.perfume_id) === pid);
          if (item) {
            if (section.flag === 'is_featured') item.isFeatured = false;
            if (section.flag === 'is_best_seller') item.isBestSeller = false;
            if (section.flag === 'is_new_arrival') item.isNewArrival = false;
          }
        }
        await loadSpotlight();
        loadDashboard();
      } catch (err) {
        toast(err.message || 'Failed to remove', true);
      }
    };
  });

  grid.querySelectorAll('[data-spotlight-testimonial-edit]').forEach((btn) => {
    btn.onclick = async () => {
      const tid = Number(btn.dataset.spotlightTestimonialEdit);
      let t = (state.testimonials || []).find(x => x.id === tid);
      if (!t) {
        try {
          const allT = await AdminAPI.testimonials();
          state.testimonials = allT;
          t = allT.find(x => x.id === tid);
        } catch (_) {}
      }
      if (t) openTestimonialModal(t);
    };
  });

  grid.querySelectorAll('[data-spotlight-testimonial-unfeature]').forEach((btn) => {
    btn.onclick = async () => {
      const tid = btn.dataset.spotlightTestimonialUnfeature;
      try {
        await AdminAPI.updateTestimonial(tid, { is_featured: false });
        toast('Removed from spotlight');
        await loadSpotlight();
        loadTestimonials();
      } catch (err) {
        toast(err.message || 'Failed to update', true);
      }
    };
  });

  const addTestimonialBtn = document.getElementById('spotlight-add-testimonial');
  if (addTestimonialBtn) {
    addTestimonialBtn.onclick = () => {
      openTestimonialModal(null);
    };
  }
}

async function loadSpotlight() {
  const grid = document.getElementById('spotlight-grid');
  if (!grid) return;
  if (!grid.querySelector('.spotlight-cell')) {
    grid.innerHTML = '<div class="adm-card" style="grid-column: 1 / -1; padding:32px; text-align:center; color:var(--adm-muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p style="margin:12px 0 0">Loading spotlight sections…</p></div>';
  }

  try {
    const data = await AdminAPI.spotlight();
    state.spotlight = data;
    paintSpotlightGrid(data);
  } catch (e) {
    if (state.allPerfumes && state.allPerfumes.length > 0) {
      const feat = state.allPerfumes.filter(p => p.isFeatured || p.is_featured);
      const best = state.allPerfumes.filter(p => p.isBestSeller || p.is_best_seller);
      const nw = state.allPerfumes.filter(p => p.isNewArrival || p.is_new_arrival);
      const featTest = (state.testimonials || []).filter(t => (t.isFeatured ?? t.is_featured) !== false);
      const fmt = (p) => ({
        perfumeId: p.perfumeId || p.perfume_id,
        perfumeName: p.perfumeName || p.name,
        categoryName: p.categoryName || p.fragranceTypeName || p.fragranceTypeId || '',
        primaryImageUrl: p.primaryImageUrl || p.primary_image_url || '/images/products/placeholder.webp',
        price: p.price30ml || p.price_30ml || p.price50ml || p.price_50ml || 0,
        stock: p.stockQuantity ?? 50
      });
      const fallbackData = {
        counts: {
          featured: feat.length,
          bestSellers: best.length,
          newArrivals: nw.length,
          testimonials: featTest.length
        },
        sections: {
          featured: feat.map(fmt),
          bestSellers: best.map(fmt),
          newArrivals: nw.map(fmt)
        },
        testimonials: featTest.map(t => ({
          id: t.id,
          customerName: t.customerName || t.customer_name || t.name,
          customerInitial: (t.customerInitial || t.customer_initial || t.customerName || t.customer_name || '?')[0],
          rating: t.rating ?? 5,
          quote: t.quote || t.text || '',
          isFeatured: true
        }))
      };
      state.spotlight = fallbackData;
      paintSpotlightGrid(fallbackData);
      return;
    }
    grid.innerHTML = `
      <div class="adm-card" style="grid-column: 1 / -1; padding:24px">
        <p style="margin:0 0 8px;color:var(--adm-danger)"><strong>Could not load Spotlight</strong></p>
        <p style="margin:0;color:var(--adm-muted)">${esc(e.message || 'Request failed')}</p>
      </div>`;
  }
}

async function openSpotlightProductPicker(sectionKey, flagField) {
  activeSpotlightPickerSection = sectionKey;
  activeSpotlightPickerFlag = flagField;

  const sectionMeta = SPOTLIGHT_PRODUCT_SECTIONS.find(s => s.key === sectionKey);
  const titleEl = document.getElementById('spotlight-picker-modal-title');
  if (titleEl) {
    titleEl.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles" style="color:var(--adm-green)"></i> <span>Add to ${esc(sectionMeta?.title || 'Spotlight')}</span>`;
  }

  const searchInput = document.getElementById('spotlight-picker-search');
  if (searchInput) searchInput.value = '';

  const listEl = document.getElementById('spotlight-picker-list');
  if (listEl) {
    listEl.innerHTML = '<p class="spotlight-cell-empty" style="padding:16px"><i class="fa-solid fa-spinner fa-spin"></i> Loading perfumes...</p>';
  }

  openModal('spotlight-picker-modal-overlay');

  if (!state.allPerfumes || !state.allPerfumes.length) {
    try {
      const res = await AdminAPI.perfumes({ per_page: 500 });
      state.allPerfumes = res.items || (Array.isArray(res) ? res : []);
    } catch (_) {}
  }

  renderSpotlightPickerItems('');

  if (searchInput) {
    searchInput.focus();
    searchInput.oninput = () => {
      renderSpotlightPickerItems(searchInput.value.trim().toLowerCase());
    };
  }
}

function renderSpotlightPickerItems(searchQuery) {
  const listEl = document.getElementById('spotlight-picker-list');
  if (!listEl) return;

  const all = state.allPerfumes || state.perfumes || [];
  const currentSectionItems = (state.spotlight?.sections?.[activeSpotlightPickerSection] || []);
  const inSectionIds = new Set(currentSectionItems.map(p => p.perfumeId || p.productId || p.perfume_id));

  let available = all.filter(p => {
    const pid = p.perfumeId || p.perfume_id;
    return !inSectionIds.has(pid);
  });

  if (searchQuery) {
    available = available.filter(p => {
      const name = (p.perfumeName || p.name || '').toLowerCase();
      const pid = (p.perfumeId || p.perfume_id || '').toLowerCase();
      return name.includes(searchQuery) || pid.includes(searchQuery);
    });
  }

  if (!available.length) {
    listEl.innerHTML = `<p class="spotlight-cell-empty" style="padding:16px">${searchQuery ? 'No matching perfumes found' : 'All perfumes are already in this section'}</p>`;
    return;
  }

  listEl.innerHTML = available.map(p => {
    const pid = p.perfumeId || p.perfume_id;
    const pname = p.perfumeName || p.name;
    const img = p.primaryImageUrl || p.primary_image_url || '/images/products/placeholder.webp';
    return `
      <button type="button" class="spotlight-picker-item" data-pick-perfume="${esc(pid)}">
        <img src="${esc(img)}" alt="">
        <span><strong>${esc(pname)}</strong> <small style="color:var(--adm-muted);margin-left:6px;">(${esc(pid)})</small></span>
      </button>`;
  }).join('');

  listEl.querySelectorAll('[data-pick-perfume]').forEach(btn => {
    btn.onclick = async () => {
      const pid = btn.dataset.pickPerfume;
      try {
        await AdminAPI.updatePerfume(pid, { [activeSpotlightPickerFlag]: true });
        closeModal('spotlight-picker-modal-overlay');
        toast('Added to spotlight');
        if (state.allPerfumes) {
          const item = state.allPerfumes.find(x => (x.perfumeId || x.perfume_id) === pid);
          if (item) {
            if (activeSpotlightPickerFlag === 'is_featured') item.isFeatured = true;
            if (activeSpotlightPickerFlag === 'is_best_seller') item.isBestSeller = true;
            if (activeSpotlightPickerFlag === 'is_new_arrival') item.isNewArrival = true;
          }
        }
        await loadSpotlight();
        loadDashboard();
      } catch (err) {
        toast(err.message || 'Failed to add', true);
      }
    };
  });
}

/* ── Banners ────────────────────────────────────────────── */
function bannerIsActive(b) {
  return (b.isActive ?? b.is_active) !== false;
}

function bannerImageUrl(b) {
  return b.imageUrl || b.image_url || '';
}

function bannerLinkUrl(b) {
  return b.linkUrl || b.link_url || '';
}

function bannerDisplayOrder(b) {
  return Number(b.displayOrder ?? b.display_order ?? 0) || 0;
}

function formatBannerLinkLabel(linkUrl) {
  const url = String(linkUrl || '').trim();
  if (!url || url === 'products.html') return 'Auto · products page';
  try {
    const u = new URL(url, 'http://local/');
    const type = u.searchParams.get('type');
    const collection = u.searchParams.get('collection');
    if (type) {
      const t = (state.types || []).find((x) => x.typeId === type || x.type_id === type);
      return `Type · ${t?.typeName || t?.type_name || type}`;
    }
    if (collection === 'featured') return 'Spotlight · Featured';
    if (collection === 'bestsellers') return 'Spotlight · Best Sellers';
    if (collection) return `Spotlight · ${collection}`;
  } catch (_) {}
  return url.length > 36 ? `${url.slice(0, 33)}…` : url;
}

function parseBannerLink(linkUrl) {
  const url = String(linkUrl || '').trim();
  if (!url || url === 'products.html') return { type: 'auto' };
  try {
    const u = new URL(url, 'http://local/');
    const type = u.searchParams.get('type');
    const collection = u.searchParams.get('collection');
    if (type) return { type: 'type', fragranceType: type };
    if (collection === 'featured') return { type: 'featured' };
    if (collection === 'bestsellers') return { type: 'bestsellers' };
  } catch (_) {}
  return { type: 'custom', custom: url };
}

function resolveBannerLinkUrl(linkType, opts = {}) {
  if (linkType === 'type' && opts.fragranceType) return `products.html?type=${encodeURIComponent(opts.fragranceType)}`;
  if (linkType === 'featured') return 'products.html?collection=featured';
  if (linkType === 'bestsellers') return 'products.html?collection=bestsellers';
  if (linkType === 'custom') return (opts.custom || '').trim();
  return 'products.html';
}

function updateBannerLinkPanels() {
  const linkType = document.getElementById('bn-link-type')?.value || 'auto';
  document.getElementById('bn-type-panel')?.classList.toggle('is-visible', linkType === 'type');
  document.getElementById('bn-custom-panel')?.classList.toggle('is-visible', linkType === 'custom');
}

function syncBannerActiveLabel() {
  const chk = document.getElementById('bn-is-active');
  const label = document.getElementById('bn-active-state');
  if (!chk || !label) return;
  const on = chk.checked;
  label.textContent = on ? 'Active' : 'Inactive';
  label.className = 'modal-active-label ' + (on ? 'modal-active-label--on' : 'modal-active-label--off');
}

function setBannerPreview(url) {
  const wrap = document.getElementById('bn-image-preview-wrap');
  const img = document.getElementById('bn-image-preview');
  if (!wrap || !img) return;
  if (url) {
    img.src = url;
    wrap.classList.remove('hidden');
  } else {
    img.removeAttribute('src');
    wrap.classList.add('hidden');
  }
}

function bannerCardHtml(b, position, poolLen, inactive) {
  const url = bannerImageUrl(b);
  const canLeft = position > 0;
  const canRight = position < poolLen - 1;
  const pos = position + 1;
  const cssUrl = url.replace(/'/g, '%27');
  return `
    <div class="banner-card${inactive ? ' banner-card--inactive' : ''}" style="${url ? `background-image:url('${esc(cssUrl)}')` : ''}">
      <div class="banner-card-order">
        <button type="button" class="adm-icon-btn banner-move-btn" data-move-banner="${b.id}" data-dir="left" title="Move earlier" ${canLeft ? '' : 'disabled'}><i class="fa-solid fa-chevron-left"></i></button>
        <span class="banner-card-pos">${pos}</span>
        <button type="button" class="adm-icon-btn banner-move-btn" data-move-banner="${b.id}" data-dir="right" title="Move later" ${canRight ? '' : 'disabled'}><i class="fa-solid fa-chevron-right"></i></button>
      </div>
      <div class="banner-card-overlay">
        <strong>${esc(b.title || 'Banner')}</strong>
        <small>${esc(b.subtitle || '')}</small>
        <span class="banner-card-dest">${esc(formatBannerLinkLabel(bannerLinkUrl(b)))}</span>
      </div>
      <div class="banner-card-actions">
        <button type="button" data-edit-banner="${b.id}" title="Edit"><i class="fa-solid fa-pencil"></i></button>
        <button type="button" class="del" data-del-banner="${b.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;
}

function paintBanners(banners) {
  const scrollActive = document.getElementById('banner-scroll-active');
  const scrollInactive = document.getElementById('banner-scroll-inactive');
  if (!scrollActive || !scrollInactive) return;

  const sorted = [...(banners || [])].sort((a, b) => bannerDisplayOrder(a) - bannerDisplayOrder(b) || a.id - b.id);
  state.banners = sorted;
  const active = sorted.filter(bannerIsActive);
  const inactive = sorted.filter((b) => !bannerIsActive(b));

  scrollActive.innerHTML = active.length
    ? active.map((b, i) => bannerCardHtml(b, i, active.length, false)).join('')
    : '<p class="banner-row-empty">No active banners. Turn Active on in a banner or add a new slide.</p>';
  scrollInactive.innerHTML = inactive.length
    ? inactive.map((b, i) => bannerCardHtml(b, i, inactive.length, true)).join('')
    : '<p class="banner-row-empty">No inactive banners.</p>';
}

async function loadBanners() {
  const scrollActive = document.getElementById('banner-scroll-active');
  const scrollInactive = document.getElementById('banner-scroll-inactive');
  if (state.banners && state.banners.length) {
    paintBanners(state.banners);
  } else {
    if (scrollActive) scrollActive.innerHTML = '<p class="banner-row-empty">Loading…</p>';
    if (scrollInactive) scrollInactive.innerHTML = '';
  }
  try {
    const banners = await AdminAPI.banners();
    paintBanners(Array.isArray(banners) ? banners : (banners.items || []));
  } catch (err) {
    if (scrollActive && (!state.banners || !state.banners.length)) {
      scrollActive.innerHTML = `<p class="banner-row-empty">${esc(err.message)}</p>`;
    }
  }
}

async function openBannerModal(b) {
  document.getElementById('banner-modal-title').textContent = b ? 'Edit Hero Banner' : 'Add Hero Banner';
  document.getElementById('bn-id').value = b?.id || '';
  document.getElementById('bn-title').value = b?.title || '';
  document.getElementById('bn-subtitle').value = b?.subtitle || '';
  const activeCount = (state.banners || []).filter(bannerIsActive).length;
  document.getElementById('bn-order').value = b ? bannerDisplayOrder(b) : activeCount;
  document.getElementById('bn-order-label').textContent = `Display order [No of banners (Active) : ${activeCount}]`;
  document.getElementById('bn-is-active').checked = b ? bannerIsActive(b) : true;
  syncBannerActiveLabel();

  const imgUrl = b ? bannerImageUrl(b) : '';
  document.getElementById('bn-image-url').value = imgUrl;
  document.getElementById('bn-image-file').value = '';
  setBannerPreview(imgUrl);

  ensureTypes().then(types => {
    const typeSel = document.getElementById('bn-fragrance-type');
    if (typeSel) {
      typeSel.innerHTML = '<option value="">Select type…</option>' +
        (types || []).map((t) =>
          `<option value="${esc(t.typeId || t.type_id)}">${esc(t.typeName || t.type_name)}</option>`
        ).join('');
    }
  }).catch(() => {});

  const typeSel = document.getElementById('bn-fragrance-type');
  if (typeSel && state.types?.length) {
    typeSel.innerHTML = '<option value="">Select type…</option>' +
      (state.types || []).map((t) =>
        `<option value="${esc(t.typeId || t.type_id)}">${esc(t.typeName || t.type_name)}</option>`
      ).join('');
  }

  const parsed = parseBannerLink(b ? bannerLinkUrl(b) : '');
  document.getElementById('bn-link-type').value = parsed.type || 'auto';
  document.getElementById('bn-link').value = parsed.custom || '';
  if (parsed.fragranceType && typeSel) typeSel.value = parsed.fragranceType;
  updateBannerLinkPanels();

  const delBtn = document.getElementById('bn-delete-btn');
  if (delBtn) delBtn.classList.toggle('hidden', !b);

  document.getElementById('banner-form-feedback').textContent = '';
  openModal('banner-modal-overlay');
}

/* ── Testimonials ───────────────────────────────────────── */
function renderTestimonialsTable() {
  const tbody = document.getElementById('testimonials-tbody');
  if (!tbody || !state.testimonials) return;
  const rows = state.testimonials;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No testimonials yet</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((t) => `
    <tr>
      <td><strong>${esc(t.customerName || t.customer_name || t.name)}</strong></td>
      <td>${esc(t.customerInitial || t.customer_initial || t.initials || '')}</td>
      <td>${'★'.repeat(t.rating || 5)}</td>
      <td>${esc((t.quote || t.text || '').slice(0, 80))}</td>
      <td>${(t.isFeatured ?? t.is_featured) !== false ? '<span class="badge badge--green">Yes</span>' : '<span class="badge badge--gray">No</span>'}</td>
      <td>${t.displayOrder ?? t.display_order ?? 0}</td>
      <td>
        <div class="adm-table-actions">
          <button type="button" data-edit-testimonial="${t.id}" title="Edit"><i class="fa-solid fa-pencil"></i></button>
          <button type="button" class="del" data-del-testimonial="${t.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

async function loadTestimonials() {
  const tbody = document.getElementById('testimonials-tbody');
  if (state.testimonials && state.testimonials.length) {
    renderTestimonialsTable();
  }
  try {
    const rows = await AdminAPI.testimonials();
    state.testimonials = Array.isArray(rows) ? rows : [];
    renderTestimonialsTable();
  } catch (err) {
    if (tbody && (!state.testimonials || !state.testimonials.length)) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty">${esc(err.message)}</td></tr>`;
    }
  }
}

function openTestimonialModal(t) {
  document.getElementById('testimonial-modal-title').textContent = t ? 'Edit Testimonial' : 'Add Testimonial';
  document.getElementById('ts-id').value = t?.id || '';
  document.getElementById('ts-name').value = t?.customerName || t?.customer_name || t?.name || '';
  document.getElementById('ts-initial').value = t?.customerInitial || t?.customer_initial || t?.initials || '';
  document.getElementById('ts-rating').value = t?.rating ?? 5;
  document.getElementById('ts-quote').value = t?.quote || t?.text || '';
  document.getElementById('ts-order').value = t?.displayOrder ?? t?.display_order ?? 0;
  document.getElementById('ts-is-featured').checked = t ? (t.isFeatured ?? t.is_featured) !== false : true;
  document.getElementById('testimonial-form-feedback').textContent = '';
  openModal('testimonial-modal-overlay');
}

/* ── Contact / Settings ─────────────────────────────────── */
function renderContactsTable() {
  const tbody = document.getElementById('contact-tbody');
  if (!tbody || !state.contacts) return;
  const list = state.contacts;
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No messages</td></tr>';
    return;
  }
  tbody.innerHTML = list.map((r) => {
    const read = !!(r.isRead ?? r.is_read);
    return `
    <tr class="${read ? '' : 'row-unread'}">
      <td>${esc(r.name)}</td>
      <td>${esc(r.email)}</td>
      <td>${esc(r.phone || '—')}</td>
      <td>${esc(r.enquiryType || r.enquiry_type || '—')}</td>
      <td>${esc((r.message || '').slice(0, 50))}</td>
      <td>${esc((r.submittedAt || r.submitted_at || '').toString().slice(0, 19))}</td>
      <td><span class="badge ${read ? 'badge--green' : 'badge--pink'}">${read ? 'Read' : 'New'}</span></td>
      <td>
        <div class="adm-table-actions">
          <button type="button" data-view-contact="${r.id}" title="View"><i class="fa-solid fa-eye"></i></button>
          <button type="button" class="del" data-del-contact="${r.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function loadContact() {
  const tbody = document.getElementById('contact-tbody');
  if (state.contacts && state.contacts.length) {
    renderContactsTable();
  }
  try {
    const rows = await AdminAPI.contactSubmissions();
    const list = Array.isArray(rows) ? rows : (rows.items || []);
    const unread = rows.unread ?? list.filter((r) => !(r.isRead ?? r.is_read)).length;
    const totalEl = document.getElementById('contact-total');
    if (totalEl) totalEl.textContent = rows.total ?? list.length;
    const unreadEl = document.getElementById('contact-unread');
    if (unreadEl) unreadEl.textContent = unread;
    updateUnreadBadges(unread);
    state.contacts = list;
    renderContactsTable();
  } catch (err) {
    if (tbody && (!state.contacts || !state.contacts.length)) {
      tbody.innerHTML = `<tr><td colspan="8" class="table-empty">${esc(err.message)}</td></tr>`;
    }
  }
}

function updateUnreadBadges(unread) {
  const n = Number(unread) || 0;
  const navBadge = document.getElementById('contact-unread-badge');
  const notifBadge = document.getElementById('notif-badge');
  if (navBadge) {
    navBadge.textContent = n > 0 ? String(n) : '';
    navBadge.classList.toggle('hidden', n <= 0);
  }
  if (notifBadge) {
    notifBadge.textContent = String(n);
    notifBadge.classList.toggle('hidden', n <= 0);
  }
}

let initialSettingsValues = {};

async function loadSettings() {
  try {
    const s = await AdminAPI.settings();
    const data = s.settings || s;
    initialSettingsValues = {};
    Object.keys(data).forEach((key) => {
      const el = document.getElementById('set-' + key);
      if (el) el.value = data[key] ?? '';
    });
    const form = document.getElementById('settings-form');
    if (form) {
      [...form.elements].forEach((el) => {
        if (el.name) {
          initialSettingsValues[el.name] = el.value ?? '';
        }
      });
    }
  } catch (err) {
    toast(err.message || 'Failed to load settings', true);
  }
}

function renderOrdersTable() {
  const tbody = document.getElementById('orders-tbody');
  if (!tbody || !state.orders) return;
  const items = state.orders;
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No orders yet</td></tr>';
    return;
  }
  tbody.innerHTML = items.map((o) => {
    const ref = o.orderRef || o.order_ref || (`#${o.id}`);
    const created = (o.createdAt || o.created_at || '').toString().slice(0, 19).replace('T', ' ');
    const count = o.itemCount ?? o.item_count ?? (o.items || []).length;
    const units = o.totalUnits ?? o.total_units ?? 0;
    return `
    <tr>
      <td><strong>${esc(ref)}</strong></td>
      <td>${esc(created || '—')}</td>
      <td>${count}</td>
      <td>${units}</td>
      <td><span class="badge ${o.status === 'new' ? 'badge--pink' : o.status === 'delivered' ? 'badge--green' : 'badge--gray'}">${esc(o.status || 'new')}</span></td>
      <td>
        <div class="adm-table-actions">
          <button type="button" data-view-order="${o.id}" title="View"><i class="fa-solid fa-eye"></i></button>
          <button type="button" class="del" data-del-order="${o.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function loadOrders() {
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;
  if (state.orders && state.orders.length) {
    renderOrdersTable();
  }
  try {
    const status = document.getElementById('orders-status-filter')?.value || '';
    const params = status ? { status } : {};
    const data = await AdminAPI.orders(params);
    const items = data.items || [];
    const newCount = items.filter((o) => o.status === 'new').length;
    updateOrdersBadge(newCount);
    state.orders = items;
    renderOrdersTable();
  } catch (err) {
    if (tbody && (!state.orders || !state.orders.length)) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty">${esc(err.message)}</td></tr>`;
    }
  }
}

function openOrderModal(order) {
  const ref = order.orderRef || order.order_ref || (`#${order.id}`);
  document.getElementById('order-modal-title').textContent = `Order ${ref}`;
  const items = (order.items || []).map((i) =>
    `<tr><td>${esc(i.perfumeName || i.perfume_name || i.name || 'Perfume')}</td><td>${esc(i.size || '—')}</td><td>${i.qty ?? 1}</td><td>${i.price != null ? money(i.price) : '—'}</td></tr>`
  ).join('');
  const msg = order.whatsappMessage || order.whatsapp_message || '';
  document.getElementById('order-modal-body').innerHTML = `
    <div class="form-group">
      <label>Status</label>
      <select id="order-status-select" class="adm-select">
        ${['new','confirmed','delivered','cancelled'].map(s =>
          `<option value="${s}" ${order.status===s?'selected':''}>${s}</option>`).join('')}
      </select>
    </div>
    <div class="adm-table-wrap" style="margin:12px 0;max-height:none;border:1px solid var(--adm-border)">
      <table class="adm-table" style="min-width:0">
        <thead><tr><th>Perfume</th><th>Size</th><th>Qty</th><th>Price</th></tr></thead>
        <tbody>${items || '<tr><td colspan="4">No items</td></tr>'}</tbody>
      </table>
    </div>
    ${msg ? `<pre class="contact-message">${esc(msg)}</pre>` : ''}
    <div class="modal-actions">
      <button type="button" class="btn btn-outline" data-close-modal="order-modal-overlay">Close</button>
      <button type="button" class="btn btn-primary" id="order-save-status" data-id="${order.id}">Save Status</button>
    </div>`;
  openModal('order-modal-overlay');
  document.getElementById('order-save-status')?.addEventListener('click', async () => {
    const saveBtn = document.getElementById('order-save-status');
    const origHtml = saveBtn ? saveBtn.innerHTML : 'Save Status';
    const id = Number(saveBtn?.dataset.id);
    const status = document.getElementById('order-status-select')?.value;
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    }
    try {
      await AdminAPI.updateOrder(id, { status });
      if (state.orders) {
        const o = state.orders.find(x => x.id === id);
        if (o) o.status = status;
      }
      toast('Order updated');
      closeModal('order-modal-overlay');
      renderOrdersTable();
      loadOrders();
    } catch (err) { toast(err.message, true); }
    finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = origHtml;
      }
    }
  });
}

/* ── Coupons ────────────────────────────────────────────── */
let couponsCache = [];

async function loadCoupons() {
  const tbody = document.querySelector('#coupons-table tbody');
  if (couponsCache && couponsCache.length) {
    paintCoupons(couponsCache);
  } else if (tbody && !tbody.querySelector('tr')) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading coupons...</td></tr>';
  }
  try {
    const list = await AdminAPI.coupons();
    couponsCache = Array.isArray(list) ? list : [];
    paintCoupons(couponsCache);
  } catch (err) {
    if (tbody && (!couponsCache || !couponsCache.length)) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:var(--adm-danger);padding:20px;">Failed to load coupons: ${esc(err.message)}</td></tr>`;
    }
  }
}

function paintCoupons(items) {
  couponsCache = items || [];
  const tbody = document.querySelector('#coupons-table tbody');
  if (!tbody) return;
  if (!couponsCache.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--adm-muted);">No coupon codes created yet. Click "Add Coupon" to create a promo discount.</td></tr>';
    return;
  }
  tbody.innerHTML = couponsCache.map((c, i) => `
    <tr>
      <td><code style="font-weight:700;font-size:0.95rem;background:#f3f4f6;padding:4px 9px;border-radius:6px;color:#111;letter-spacing:0.04em;">${esc(c.code)}</code></td>
      <td>${c.type === 'fixed' ? 'Fixed (₹)' : 'Percentage (%)'}</td>
      <td style="font-weight:600;color:var(--adm-green,#10b981);">${c.type === 'fixed' ? `₹${Number(c.value).toLocaleString('en-IN')}` : `${c.value}%`}</td>
      <td>${Number(c.min || c.minOrder || 0) > 0 ? `₹${Number(c.min || c.minOrder).toLocaleString('en-IN')}` : '<span style="color:var(--adm-muted)">None</span>'}</td>
      <td>${c.active !== false ? '<span class="badge badge--green">Active</span>' : '<span class="badge badge--gray">Inactive</span>'}</td>
      <td style="text-align: right;">
        <div class="adm-table-actions" style="justify-content: flex-end;">
          <button type="button" class="edit-coupon-btn" data-coupon-idx="${i}" title="Edit"><i class="fa-solid fa-pencil"></i></button>
          <button type="button" class="del del-coupon-btn" data-coupon-idx="${i}" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.edit-coupon-btn').forEach(b => {
    b.addEventListener('click', () => {
      const idx = parseInt(b.dataset.couponIdx, 10);
      openCouponModal(couponsCache[idx], idx);
    });
  });
  tbody.querySelectorAll('.del-coupon-btn').forEach(b => {
    b.addEventListener('click', async () => {
      const idx = parseInt(b.dataset.couponIdx, 10);
      const code = couponsCache[idx]?.code;
      const ok = await confirmDialog('Delete Coupon', `Are you sure you want to remove coupon code "${code}"?`);
      if (!ok) return;
      try {
        const next = couponsCache.filter((_, i) => i !== idx);
        await AdminAPI.saveCoupons(next);
        couponsCache = next;
        paintCoupons(couponsCache);
        toast(`Coupon "${code}" deleted`);
      } catch (err) {
        toast('Failed to delete coupon: ' + err.message, true);
      }
    });
  });
}

function openCouponModal(c = null, idx = -1) {
  document.getElementById('coupon-modal-title').innerHTML = `<i class="fa-solid fa-ticket" style="color: var(--adm-green);"></i> <span>${c ? 'Edit Coupon' : 'Add Coupon'}</span>`;
  document.getElementById('coupon-edit-index').value = String(idx);
  document.getElementById('coupon-code').value = c?.code || '';
  document.getElementById('coupon-type').value = c?.type || 'percent';
  document.getElementById('coupon-value').value = c?.value ?? 10;
  document.getElementById('coupon-min').value = (c?.min ?? c?.minOrder ?? 0) || '';
  document.getElementById('coupon-active').checked = c?.active !== false;
  document.getElementById('coupon-form-feedback').textContent = '';
  openModal('coupon-modal-overlay');
}

/* ── Bind events ────────────────────────────────────────── */
function bindEvents() {
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-submit');
    errEl.textContent = '';
    btn.disabled = true;
    try {
      const login = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const res = await AdminAPI.login(login, password);
      const user = res.user || res;
      if (user.role !== 'admin') throw new Error('This account is not an admin.');
      AdminAPI.setSession(res.session_token || res.token, user);
      showApp(user);
      switchSection('dashboard');
    } catch (err) {
      errEl.textContent = err.message || 'Login failed';
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await AdminAPI.logout();
    AdminAPI.clearSession();
    showLogin();
  });

  document.querySelectorAll('.adm-nav-link').forEach((btn) => {
    btn.addEventListener('click', () => switchSection(btn.dataset.section));
  });

  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
    document.getElementById('adm-sidebar')?.classList.toggle('open');
  });

  document.getElementById('global-search')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const q = e.target.value.trim();
    switchSection('perfumes');
    const search = document.getElementById('perfume-search');
    if (search) {
      search.value = q;
      loadPerfumes();
    }
  });

  document.getElementById('qa-add-perfume')?.addEventListener('click', async () => {
    switchSection('perfumes');
    document.getElementById('add-perfume-btn')?.click();
  });
  document.getElementById('qa-add-banner')?.addEventListener('click', () => {
    switchSection('banners');
    document.getElementById('add-banner-btn')?.click();
  });
  document.getElementById('qa-add-testimonial')?.addEventListener('click', () => {
    switchSection('testimonials');
    document.getElementById('add-testimonial-btn')?.click();
  });

  document.getElementById('notif-btn')?.addEventListener('click', () => {
    switchSection('dashboard');
    document.getElementById('low-stock-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-close-modal]');
    if (btn && btn.dataset.closeModal) {
      closeModal(btn.dataset.closeModal);
    }
  });
  document.querySelectorAll('.admin-modal-overlay').forEach((ov) => {
    ov.addEventListener('click', (e) => { if (e.target === ov) ov.classList.remove('open'); });
  });

  document.getElementById('confirm-modal-cancel')?.addEventListener('click', () => {
    closeModal('confirm-modal-overlay');
    state.confirmResolve?.(false);
  });
  document.getElementById('confirm-modal-ok')?.addEventListener('click', () => {
    closeModal('confirm-modal-overlay');
    state.confirmResolve?.(true);
  });

  // Perfume toolbar
  let searchTimer;
  document.getElementById('perfume-search')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadPerfumes, 280);
  });
  document.getElementById('perfume-type-filter')?.addEventListener('change', loadPerfumes);
  document.getElementById('perfume-status-filter')?.addEventListener('change', loadPerfumes);
  document.getElementById('perfume-sort-filter')?.addEventListener('change', loadPerfumes);
  document.getElementById('add-perfume-btn')?.addEventListener('click', () => {
    ensureTypes().then(fillTypeSelects).catch(() => {});
    fillTypeSelects();
    openPerfumeModal(null);
  });

  document.getElementById('perfumes-tbody')?.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-edit-perfume]');
    const editId = editBtn?.dataset.editPerfume;
    const delId = e.target.closest('[data-del-perfume]')?.dataset.delPerfume;
    if (editId) {
      ensureTypes().then(fillTypeSelects).catch(() => {});
      let p = (state.perfumes || []).find((x) => (x.perfumeId || x.perfume_id) === editId)
           || (state.allPerfumes || []).find((x) => (x.perfumeId || x.perfume_id) === editId);
      if (p) {
        // INSTANT 0ms modal open!
        openPerfumeModal(p);
      }
      AdminAPI.getPerfume(editId).then(full => {
        if (!full) return;
        const curId = document.getElementById('pf-id')?.value;
        if (curId === editId && document.getElementById('perfume-modal-overlay')?.classList.contains('open')) {
          if (full.images && Array.isArray(full.images) && full.images.length > 0) {
            const preview = document.getElementById('pf-images-preview');
            if (preview && !preview.querySelector('.pf-image-thumb')) {
              const mainImg = full.primaryImageUrl || full.primary_image_url || full.images[0]?.image_url;
              if (mainImg) {
                preview.innerHTML = `<div class="pf-image-thumb"><img src="${esc(mainImg)}" alt="Perfume"></div>`;
              }
            }
          }
        }
      }).catch(() => {});
      if (!p) {
        try {
          const fetched = await AdminAPI.getPerfume(editId);
          openPerfumeModal(fetched);
        } catch (err) { toast(err.message, true); }
      }
    }
    if (delId) {
      const ok = await confirmDialog('Delete perfume?', `Delete ${delId}? This cannot be undone.`);
      if (!ok) return;
      try {
        await AdminAPI.deletePerfume(delId);
        state.perfumes = (state.perfumes || []).filter(x => (x.perfumeId || x.perfume_id) !== delId);
        if (state.allPerfumes) state.allPerfumes = state.allPerfumes.filter(x => (x.perfumeId || x.perfume_id) !== delId);
        renderPerfumesTable();
        toast('Perfume deleted');
        loadPerfumes();
      } catch (err) { toast(err.message, true); }
    }
  });

  document.getElementById('perfumes-tbody')?.addEventListener('change', async (e) => {
    if (e.target.classList.contains('perfume-cb') || e.target.id === 'perfumes-select-all') {
      updateBulkBar();
      return;
    }
    const toggle = e.target.closest('.perfume-active-toggle');
    if (!toggle) return;
    const id = toggle.dataset.id;
    const isActive = toggle.checked;
    try {
      await AdminAPI.updatePerfume(id, { is_active: isActive });
      const row = toggle.closest('tr');
      if (row) row.classList.toggle('adm-row-inactive', !isActive);
      const p = (state.perfumes || []).find((x) => (x.perfumeId || x.perfume_id) === id);
      if (p) {
        p.isActive = isActive;
        p.is_active = isActive;
      }
      toast(isActive ? 'Perfume activated' : 'Perfume deactivated');
    } catch (err) {
      toggle.checked = !isActive;
      toast(err.message || 'Update failed', true);
    }
  });

  document.getElementById('perfumes-select-all')?.addEventListener('change', (e) => {
    document.querySelectorAll('.perfume-cb').forEach((c) => { c.checked = e.target.checked; });
    updateBulkBar();
  });

  document.getElementById('bulk-clear-btn')?.addEventListener('click', () => {
    document.querySelectorAll('.perfume-cb').forEach((c) => { c.checked = false; });
    const all = document.getElementById('perfumes-select-all');
    if (all) all.checked = false;
    updateBulkBar();
  });

  document.getElementById('bulk-prices-btn')?.addEventListener('click', () => {
    const ids = getSelectedPerfumeIds();
    document.getElementById('bulk-prices-hint').textContent = `Update ${ids.length} selected perfume${ids.length === 1 ? '' : 's'}`;
    document.getElementById('bulk-prices-feedback').textContent = '';
    openModal('bulk-prices-modal-overlay');
  });

  document.getElementById('bulk-mode')?.addEventListener('change', (e) => {
    const percent = e.target.value === 'percent';
    document.getElementById('bulk-percent-wrap')?.classList.toggle('hidden', !percent);
    document.getElementById('bulk-absolute-wrap')?.classList.toggle('hidden', percent);
  });

  document.getElementById('bulk-prices-apply')?.addEventListener('click', async () => {
    const applyBtn = document.getElementById('bulk-prices-apply');
    const origHtml = applyBtn ? applyBtn.innerHTML : 'Apply to Selected';
    const ids = getSelectedPerfumeIds();
    const mode = document.getElementById('bulk-mode').value;
    const fb = document.getElementById('bulk-prices-feedback');
    const body = { perfume_ids: ids, mode };
    if (applyBtn) {
      applyBtn.disabled = true;
      applyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Applying...';
    }
    try {
      if (mode === 'percent') {
        body.percent = Number(document.getElementById('bulk-percent').value);
      } else {
        const prices = {};
        const p6 = document.getElementById('bulk-p6').value.trim();
        const p12 = document.getElementById('bulk-p12').value.trim();
        const p30 = document.getElementById('bulk-p30').value.trim();
        const p50 = document.getElementById('bulk-p50').value.trim();
        if (p6 !== '') prices.price_6ml = Number(p6);
        if (p12 !== '') prices.price_12ml = Number(p12);
        if (p30 !== '') prices.price_30ml = Number(p30);
        if (p50 !== '') prices.price_50ml = Number(p50);
        if (!Object.keys(prices).length) throw new Error('Enter at least one price');
        body.prices = prices;
      }
      const res = await AdminAPI.bulkPrices(body);
      toast(`Updated ${res.updated || ids.length} perfume(s)`);
      closeModal('bulk-prices-modal-overlay');
      loadPerfumes();
    } catch (err) {
      fb.textContent = err.message || 'Update failed';
      fb.className = 'modal-feedback error';
    } finally {
      if (applyBtn) {
        applyBtn.disabled = false;
        applyBtn.innerHTML = origHtml;
      }
    }
  });

  // Sheet Event Listeners
  document.getElementById('sheet-search')?.addEventListener('input', () => {
    clearTimeout(sheetSearchTimer);
    sheetSearchTimer = setTimeout(loadSheet, 180);
  });
  document.getElementById('sheet-type-filter')?.addEventListener('change', loadSheet);
  document.getElementById('sheet-export-csv-btn')?.addEventListener('click', exportSheetToCsv);
  document.getElementById('sheet-print-btn')?.addEventListener('click', () => window.print());

  document.getElementById('sheet-edit-btn')?.addEventListener('click', () => {
    isSheetEditing = true;
    document.getElementById('sheet-edit-btn')?.classList.add('hidden');
    document.getElementById('sheet-save-btn')?.classList.remove('hidden');
    document.getElementById('sheet-cancel-btn')?.classList.remove('hidden');
    loadSheet();
  });

  document.getElementById('sheet-save-btn')?.addEventListener('click', saveSheetChanges);

  document.getElementById('sheet-cancel-btn')?.addEventListener('click', () => {
    resetSheetEditMode();
    loadSheet();
  });

  document.getElementById('sheet-tbody')?.addEventListener('click', (e) => {
    if (isSheetEditing) return;
    const editId = e.target.closest('[data-sheet-edit]')?.dataset.sheetEdit;
    if (editId) {
      ensureTypes().then(fillTypeSelects).catch(() => {});
      const all = state.allPerfumes || state.perfumes || [];
      let p = all.find((x) => (x.perfumeId || x.perfume_id) === editId);
      if (p) openPerfumeModal(p);
      AdminAPI.getPerfume(editId).then(full => {
        if (!full) return;
        const curId = document.getElementById('pf-id')?.value;
        if (curId === editId && document.getElementById('perfume-modal-overlay')?.classList.contains('open')) {
          if (full.images && Array.isArray(full.images) && full.images.length > 0) {
            const preview = document.getElementById('pf-images-preview');
            if (preview && !preview.querySelector('.pf-image-thumb')) {
              const mainImg = full.primaryImageUrl || full.primary_image_url || full.images[0]?.image_url;
              if (mainImg) {
                preview.innerHTML = `<div class="pf-image-thumb"><img src="${esc(mainImg)}" alt="Perfume"></div>`;
              }
            }
          }
        }
      }).catch(() => {});
      if (!p) {
        AdminAPI.getPerfume(editId).then(openPerfumeModal).catch(err => toast(err.message, true));
      }
    }
  });

  document.getElementById('low-stock-list')?.addEventListener('click', (e) => {
    const id = e.target.closest('[data-edit-stock]')?.dataset.editStock;
    if (!id) return;
    switchSection('perfumes');
    let p = (state.perfumes || []).find((x) => (x.perfumeId || x.perfume_id) === id)
         || (state.allPerfumes || []).find((x) => (x.perfumeId || x.perfume_id) === id);
    if (p) openPerfumeModal(p);
    else AdminAPI.getPerfume(id).then(openPerfumeModal).catch(() => {});
  });

  document.getElementById('orders-status-filter')?.addEventListener('change', loadOrders);
  document.getElementById('orders-tbody')?.addEventListener('click', async (e) => {
    const viewId = e.target.closest('[data-view-order]')?.dataset.viewOrder;
    const delId = e.target.closest('[data-del-order]')?.dataset.delOrder;
    if (viewId) {
      try {
        const order = await AdminAPI.getOrder(viewId);
        openOrderModal(order);
      } catch (err) { toast(err.message, true); }
    }
    if (delId) {
      const ok = await confirmDialog('Delete order?', 'Remove this order record?');
      if (!ok) return;
      try {
        await AdminAPI.deleteOrder(delId);
        toast('Order deleted');
        loadOrders();
      } catch (err) { toast(err.message, true); }
    }
  });

  // Perfumes Modal Tabs & Image Preview
  document.getElementById('perfume-modal-tabs')?.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-pf-tab]');
    if (tabBtn) switchPerfumeModalTab(tabBtn.dataset.pfTab);
  });

  document.getElementById('pf-image-files')?.addEventListener('change', (e) => {
    const files = e.target.files;
    const preview = document.getElementById('pf-images-preview');
    if (!preview) return;
    if (!files || !files.length) {
      const originalId = document.getElementById('pf-original-id').value;
      const currentPerfume = state.perfumes?.find((x) => (x.perfumeId || x.perfume_id) === originalId);
      if (currentPerfume?.primaryImageUrl) {
        preview.innerHTML = `<div class="pf-image-thumb"><img src="${esc(currentPerfume.primaryImageUrl)}" alt=""></div>`;
      } else {
        preview.innerHTML = `<div class="pf-image-empty-state"><i class="fa-regular fa-image"></i><span>No image uploaded yet</span></div>`;
      }
      return;
    }
    preview.innerHTML = '';
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const thumb = document.createElement('div');
        thumb.className = 'pf-image-thumb';
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = file.name;
        img.onload = () => URL.revokeObjectURL(img.src);
        thumb.appendChild(img);
        preview.appendChild(thumb);
      }
    });
  });

  document.getElementById('perfume-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fb = document.getElementById('perfume-form-feedback');
    fb.textContent = '';
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const origBtnHtml = submitBtn ? submitBtn.innerHTML : 'Save Perfume';

    const originalId = document.getElementById('pf-original-id').value;
    const perfumeId = document.getElementById('pf-id').value.trim();
    const perfumeName = document.getElementById('pf-name').value.trim();
    const fragranceTypeId = document.getElementById('pf-type').value;

    if (!perfumeId) {
      switchPerfumeModalTab('details');
      document.getElementById('pf-id').focus();
      fb.textContent = 'Please enter a Perfume ID.';
      return;
    }
    if (!perfumeName) {
      switchPerfumeModalTab('details');
      document.getElementById('pf-name').focus();
      fb.textContent = 'Please enter a Perfume Name.';
      return;
    }
    if (!fragranceTypeId) {
      switchPerfumeModalTab('details');
      document.getElementById('pf-type').focus();
      fb.textContent = 'Please select a Fragrance Type.';
      return;
    }

    const typeObj = (state.types || []).find(t => (t.typeId || t.type_id) === fragranceTypeId);
    const fragranceTypeName = typeObj ? (typeObj.typeName || typeObj.type_name) : '';

    const body = {
      perfume_id: perfumeId,
      perfume_name: perfumeName,
      fragrance_type_id: fragranceTypeId,
      description: document.getElementById('pf-description').value.trim() || null,
      stock_quantity: Number(document.getElementById('pf-stock').value) || 0,
      price_6ml: numOrNull(document.getElementById('pf-price-6')),
      price_12ml: numOrNull(document.getElementById('pf-price-12')),
      price_24ml: numOrNull(document.getElementById('pf-price-24')),
      price_20ml: numOrNull(document.getElementById('pf-price-20')),
      price_30ml: numOrNull(document.getElementById('pf-price-30')),
      price_50ml: numOrNull(document.getElementById('pf-price-50')),
      price_100ml: numOrNull(document.getElementById('pf-price-100')),
      price_car_6ml: numOrNull(document.getElementById('pf-price-car-6')),
      price_car_12ml: numOrNull(document.getElementById('pf-price-car-12')),
      is_attar: document.getElementById('pf-is-attar').checked,
      is_perfume: document.getElementById('pf-is-perfume').checked,
      is_car_hanger: document.getElementById('pf-is-car-hanger').checked,
      is_featured: document.getElementById('pf-is-featured').checked,
      is_best_seller: document.getElementById('pf-is-bestseller').checked,
      is_new_arrival: document.getElementById('pf-is-newarrival').checked,
      is_active: document.getElementById('pf-is-active').checked,
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    }

    try {
      let created = null;
      if (originalId) {
        await AdminAPI.updatePerfume(originalId, body);
      } else {
        created = await AdminAPI.createPerfume(body);
      }
      const actualPerfumeId = created?.perfume_id || perfumeId;

      const files = [...(document.getElementById('pf-image-files').files || [])];
      if (files.length) {
        try { await AdminAPI.uploadPerfumeImage(actualPerfumeId, files); }
        catch (upErr) { toast('Saved, but image upload note: ' + upErr.message, true); }
      }

      // Optimistic in-memory update for 0ms refresh!
      const targetId = originalId || actualPerfumeId;
      const updateItem = (item) => {
        if (!item) return;
        item.perfumeId = actualPerfumeId;
        item.perfume_id = actualPerfumeId;
        item.perfumeName = perfumeName;
        item.perfume_name = perfumeName;
        item.fragranceTypeId = fragranceTypeId;
        item.fragrance_type_id = fragranceTypeId;
        item.fragranceTypeName = fragranceTypeName || item.fragranceTypeName;
        item.description = body.description;
        item.stockQuantity = body.stock_quantity;
        item.stock_quantity = body.stock_quantity;
        item.price6ml = body.price_6ml;
        item.price12ml = body.price_12ml;
        item.price24ml = body.price_24ml;
        item.price20ml = body.price_20ml;
        item.price30ml = body.price_30ml;
        item.price50ml = body.price_50ml;
        item.price100ml = body.price_100ml;
        item.priceCar6ml = body.price_car_6ml;
        item.priceCar12ml = body.price_car_12ml;
        item.isAttar = body.is_attar;
        item.isPerfume = body.is_perfume;
        item.isCarHanger = body.is_car_hanger;
        item.isFeatured = body.is_featured;
        item.isBestSeller = body.is_best_seller;
        item.isNewArrival = body.is_new_arrival;
        item.isActive = body.is_active;
      };

      const matchP = (state.perfumes || []).find(x => (x.perfumeId || x.perfume_id) === targetId);
      if (matchP) {
        updateItem(matchP);
      } else if (!originalId) {
        const newItem = {
          perfumeId: actualPerfumeId,
          perfume_id: actualPerfumeId,
          perfumeName: perfumeName,
          perfume_name: perfumeName,
          fragranceTypeId: fragranceTypeId,
          fragrance_type_id: fragranceTypeId,
          fragranceTypeName: fragranceTypeName,
          description: body.description,
          stockQuantity: body.stock_quantity,
          stock_quantity: body.stock_quantity,
          price6ml: body.price_6ml,
          price12ml: body.price_12ml,
          price24ml: body.price_24ml,
          price20ml: body.price_20ml,
          price30ml: body.price_30ml,
          price50ml: body.price_50ml,
          price100ml: body.price_100ml,
          priceCar6ml: body.price_car_6ml,
          priceCar12ml: body.price_car_12ml,
          isAttar: body.is_attar,
          isPerfume: body.is_perfume,
          isCarHanger: body.is_car_hanger,
          isFeatured: body.is_featured,
          isBestSeller: body.is_best_seller,
          isNewArrival: body.is_new_arrival,
          isActive: body.is_active,
          primaryImageUrl: '/images/products/placeholder.webp'
        };
        if (state.perfumes) state.perfumes.unshift(newItem);
        if (state.allPerfumes) state.allPerfumes.unshift(newItem);
      }
      const matchAll = (state.allPerfumes || []).find(x => (x.perfumeId || x.perfume_id) === targetId);
      if (matchAll) updateItem(matchAll);

      // Close modal IMMEDIATELY
      closeModal('perfume-modal-overlay');
      toast('Perfume saved successfully');

      // Immediate 0ms UI update
      renderPerfumesTable();

      // Silent background revalidation
      loadPerfumes();
    } catch (err) {
      fb.textContent = typeof err.message === 'string' ? err.message : 'Save failed';
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtnHtml;
      }
    }
  });

  // Types
  document.getElementById('add-type-btn')?.addEventListener('click', () => openTypeModal(null));
  document.getElementById('type-modal-tabs')?.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-type-tab]');
    if (tabBtn) switchTypeModalTab(tabBtn.dataset.typeTab);
  });
  document.getElementById('ft-image-url')?.addEventListener('input', (e) => {
    updateTypeImagePreview(e.target.value);
  });
  document.getElementById('ft-image-clear-btn')?.addEventListener('click', () => {
    const urlInput = document.getElementById('ft-image-url');
    if (urlInput) urlInput.value = '';
    updateTypeImagePreview('');
  });
  document.getElementById('types-tbody')?.addEventListener('click', async (e) => {
    const editId = e.target.closest('[data-edit-type]')?.dataset.editType;
    const delId = e.target.closest('[data-del-type]')?.dataset.delType;
    if (editId) openTypeModal((state.types || []).find((t) => (t.type_id || t.typeId) === editId));
    if (delId) {
      const ok = await confirmDialog('Delete type?', `Delete fragrance type ${delId}?`);
      if (!ok) return;
      try {
        await AdminAPI.deleteFragranceType(delId);
        state.types = (state.types || []).filter(t => (t.type_id || t.typeId) !== delId);
        try { sessionStorage.removeItem('aarif_admin_types'); } catch (_) {}
        renderTypesTable();
        toast('Type deleted');
        loadTypes();
      } catch (err) { toast(err.message, true); }
    }
  });
  document.getElementById('type-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fb = document.getElementById('type-form-feedback');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const origBtnHtml = submitBtn ? submitBtn.innerHTML : 'Save Fragrance Type';

    const original = document.getElementById('ft-original-id').value;
    const body = {
      type_id: document.getElementById('ft-id').value.trim(),
      type_name: document.getElementById('ft-name').value.trim(),
      slug: document.getElementById('ft-slug').value.trim() || undefined,
      description: document.getElementById('ft-description').value.trim() || null,
      icon_image_url: document.getElementById('ft-image-url')?.value.trim() || null,
      display_order: Number(document.getElementById('ft-order').value) || 0,
      is_active: document.getElementById('ft-is-active').checked,
    };
    if (!body.type_id) {
      switchTypeModalTab('details');
      document.getElementById('ft-id').focus();
      fb.textContent = 'Please enter a Type ID.';
      return;
    }
    if (!body.type_name) {
      switchTypeModalTab('details');
      document.getElementById('ft-name').focus();
      fb.textContent = 'Please enter a Type Name.';
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    }

    try {
      if (original) await AdminAPI.updateFragranceType(original, body);
      else await AdminAPI.createFragranceType(body);

      // Optimistic in-memory update
      if (state.types) {
        const found = state.types.find(t => (t.type_id || t.typeId) === (original || body.type_id));
        if (found) {
          Object.assign(found, body);
        } else {
          state.types.push(body);
        }
      }
      try { sessionStorage.removeItem('aarif_admin_types'); } catch (_) {}

      closeModal('type-modal-overlay');
      toast('Fragrance type saved');
      renderTypesTable();
      fillTypeSelects();
      loadTypes();
    } catch (err) {
      fb.textContent = err.message || 'Save failed';
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtnHtml;
      }
    }
  });

  // Banners
  document.getElementById('add-banner-btn')?.addEventListener('click', () => openBannerModal(null));
  document.getElementById('bn-is-active')?.addEventListener('change', syncBannerActiveLabel);
  document.getElementById('bn-link-type')?.addEventListener('change', updateBannerLinkPanels);
  document.getElementById('bn-image-url')?.addEventListener('input', (e) => setBannerPreview(e.target.value.trim()));

  const bannerRows = document.querySelector('.banner-rows');
  bannerRows?.addEventListener('click', async (e) => {
    const moveBtn = e.target.closest('[data-move-banner]');
    if (moveBtn && !moveBtn.disabled) {
      e.stopPropagation();
      try {
        await AdminAPI.moveBanner(moveBtn.dataset.moveBanner, moveBtn.dataset.dir);
        toast('Banner order updated');
        loadBanners();
      } catch (err) { toast(err.message || 'Could not reorder', true); }
      return;
    }
    const editId = e.target.closest('[data-edit-banner]')?.dataset.editBanner;
    const delId = e.target.closest('[data-del-banner]')?.dataset.delBanner;
    if (editId) {
      const list = state.banners?.length ? state.banners : await AdminAPI.banners();
      const found = (Array.isArray(list) ? list : []).find((b) => String(b.id) === String(editId));
      openBannerModal(found);
    }
    if (delId) {
      const ok = await confirmDialog('Delete Banner', 'Permanently delete this banner?');
      if (!ok) return;
      try { await AdminAPI.deleteBanner(delId); toast('Banner deleted'); loadBanners(); }
      catch (err) { toast(err.message, true); }
    }
  });

  document.getElementById('bn-delete-btn')?.addEventListener('click', async () => {
    const id = document.getElementById('bn-id').value;
    if (!id) return;
    const ok = await confirmDialog('Delete Banner', 'Permanently delete this banner? This cannot be undone.');
    if (!ok) return;
    try {
      await AdminAPI.deleteBanner(id);
      toast('Banner deleted');
      closeModal('banner-modal-overlay');
      loadBanners();
    } catch (err) { toast(err.message, true); }
  });

  document.getElementById('bn-image-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fb = document.getElementById('banner-form-feedback');
    fb.textContent = 'Uploading image…';
    try {
      const res = await AdminAPI.uploadBannerImage(file);
      const url = res.imageUrl || res.image_url || res.url || res.secure_url;
      document.getElementById('bn-image-url').value = url || '';
      setBannerPreview(url || '');
      fb.textContent = 'Image uploaded';
    } catch (err) {
      fb.textContent = err.message || 'Upload failed (Cloudinary may not be configured)';
    }
  });
  document.getElementById('bn-image-upload-btn')?.addEventListener('click', () => {
    document.getElementById('bn-image-file')?.click();
  });

  document.getElementById('banner-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fb = document.getElementById('banner-form-feedback');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const origBtnHtml = submitBtn ? submitBtn.innerHTML : 'Save Banner';

    const id = document.getElementById('bn-id').value;
    const imageUrl = document.getElementById('bn-image-url').value.trim();
    if (!imageUrl) {
      fb.textContent = 'Banner image is required — upload a file or paste a URL.';
      return;
    }
    const linkType = document.getElementById('bn-link-type').value;
    const body = {
      title: document.getElementById('bn-title').value.trim(),
      subtitle: document.getElementById('bn-subtitle').value.trim() || null,
      link_url: resolveBannerLinkUrl(linkType, {
        fragranceType: document.getElementById('bn-fragrance-type').value,
        custom: document.getElementById('bn-link').value,
      }) || null,
      display_order: Number(document.getElementById('bn-order').value) || 0,
      is_active: document.getElementById('bn-is-active').checked,
      image_url: imageUrl,
    };
    if (linkType === 'type' && !document.getElementById('bn-fragrance-type').value) {
      fb.textContent = 'Select a fragrance type.';
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    }

    try {
      if (id) await AdminAPI.updateBanner(id, body);
      else await AdminAPI.createBanner(body);
      closeModal('banner-modal-overlay');
      toast('Banner saved');
      loadBanners();
    } catch (err) {
      fb.textContent = err.message || 'Save failed';
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtnHtml;
      }
    }
  });

  // Testimonials
  document.getElementById('add-testimonial-btn')?.addEventListener('click', () => openTestimonialModal(null));
  document.getElementById('testimonials-tbody')?.addEventListener('click', async (e) => {
    const editId = e.target.closest('[data-edit-testimonial]')?.dataset.editTestimonial;
    const delId = e.target.closest('[data-del-testimonial]')?.dataset.delTestimonial;
    if (editId) openTestimonialModal((state.testimonials || []).find((t) => String(t.id) === String(editId)));
    if (delId) {
      const ok = await confirmDialog('Delete testimonial?', 'Remove this review?');
      if (!ok) return;
      try { await AdminAPI.deleteTestimonial(delId); toast('Deleted'); loadTestimonials(); }
      catch (err) { toast(err.message, true); }
    }
  });
  document.getElementById('testimonial-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fb = document.getElementById('testimonial-form-feedback');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const origBtnHtml = submitBtn ? submitBtn.innerHTML : 'Save Testimonial';

    const id = document.getElementById('ts-id').value;
    const body = {
      customer_name: document.getElementById('ts-name').value.trim(),
      customer_initial: document.getElementById('ts-initial').value.trim() || null,
      rating: Number(document.getElementById('ts-rating').value) || 5,
      quote: document.getElementById('ts-quote').value.trim(),
      display_order: Number(document.getElementById('ts-order').value) || 0,
      is_featured: document.getElementById('ts-is-featured').checked,
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    }

    try {
      if (id) await AdminAPI.updateTestimonial(id, body);
      else await AdminAPI.createTestimonial(body);
      closeModal('testimonial-modal-overlay');
      toast('Testimonial saved');
      loadTestimonials();
    } catch (err) {
      fb.textContent = err.message || 'Save failed';
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtnHtml;
      }
    }
  });

  // Contact
  document.getElementById('contact-tbody')?.addEventListener('click', async (e) => {
    const viewId = e.target.closest('[data-view-contact]')?.dataset.viewContact;
    const delId = e.target.closest('[data-del-contact]')?.dataset.delContact;
    if (viewId) {
      const row = (state.contacts || []).find((c) => String(c.id) === String(viewId));
      if (!row) return;
      document.getElementById('contact-modal-body').innerHTML = `
        <p><strong>Name:</strong> ${esc(row.name)}</p>
        <p><strong>Email:</strong> ${esc(row.email)}</p>
        <p><strong>Phone:</strong> ${esc(row.phone || '—')}</p>
        <p><strong>Enquiry:</strong> ${esc(row.enquiryType || row.enquiry_type || '—')}</p>
        <p><strong>Message:</strong></p>
        <p class="contact-message">${esc(row.message)}</p>
        <div class="modal-actions" style="margin-top:16px;">
          <button type="button" class="btn btn-outline" data-close-modal="contact-modal-overlay">Close</button>
        </div>`;
      openModal('contact-modal-overlay');
      if (!(row.isRead ?? row.is_read)) {
        try { await AdminAPI.markContactRead(viewId); loadContact(); } catch (_) {}
      }
    }
    if (delId) {
      const ok = await confirmDialog('Delete message?', 'Remove this contact submission?');
      if (!ok) return;
      try { await AdminAPI.deleteContactSubmission(delId); toast('Deleted'); loadContact(); }
      catch (err) { toast(err.message, true); }
    }
  });

  document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fb = document.getElementById('settings-feedback');
    const submitBtns = Array.from(document.querySelectorAll('#settings-form button[type="submit"], button[form="settings-form"]'));
    const origBtnsHtml = submitBtns.map(b => b.innerHTML);

    const form = e.target;
    const body = {};
    let changedCount = 0;

    [...form.elements].forEach((el) => {
      if (!el.name) return;
      const currentVal = el.value ?? '';
      const initialVal = initialSettingsValues[el.name];
      if (initialVal === undefined || currentVal !== initialVal) {
        body[el.name] = currentVal;
        changedCount++;
      }
    });

    if (changedCount === 0) {
      if (fb) {
        fb.textContent = 'No changes detected to save.';
        fb.className = 'settings-feedback ok';
      }
      toast('No changes detected');
      return;
    }

    submitBtns.forEach(b => {
      b.disabled = true;
      b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    });

    try {
      await AdminAPI.saveSettings(body);
      Object.keys(body).forEach((key) => {
        initialSettingsValues[key] = body[key];
      });
      try {
        localStorage.removeItem('aarif_meta_cache_v2');
        localStorage.setItem('aarif_settings_sync', Date.now().toString());
      } catch (_) {}
      if (fb) {
        fb.textContent = `Settings saved successfully (${changedCount} field${changedCount > 1 ? 's' : ''} updated).`;
        fb.className = 'settings-feedback ok';
      }
      toast(changedCount === 1 ? '1 setting updated' : `${changedCount} settings updated`);
    } catch (err) {
      if (fb) {
        fb.textContent = err.message || 'Save failed';
        fb.className = 'settings-feedback err';
      }
      toast(err.message || 'Save failed', true);
    } finally {
      submitBtns.forEach((b, idx) => {
        b.disabled = false;
        b.innerHTML = origBtnsHtml[idx] || '<i class="fa-solid fa-floppy-disk"></i> Save Settings';
      });
    }
  });

  // Coupons
  document.getElementById('add-coupon-btn')?.addEventListener('click', () => openCouponModal());

  document.getElementById('coupon-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const origBtnHtml = submitBtn ? submitBtn.innerHTML : 'Save Coupon';

    const idx = parseInt(document.getElementById('coupon-edit-index').value, 10);
    const code = document.getElementById('coupon-code').value.trim().toUpperCase();
    const type = document.getElementById('coupon-type').value;
    const value = parseFloat(document.getElementById('coupon-value').value) || 0;
    const minVal = parseFloat(document.getElementById('coupon-min').value) || 0;
    const active = document.getElementById('coupon-active').checked;
    const fb = document.getElementById('coupon-form-feedback');

    if (!code) {
      fb.textContent = 'Coupon code is required';
      fb.className = 'modal-feedback error';
      return;
    }
    if (value <= 0) {
      fb.textContent = 'Discount value must be greater than 0';
      fb.className = 'modal-feedback error';
      return;
    }

    const item = { code, type, value, min: minVal, active };
    const next = [...couponsCache];
    if (idx >= 0) {
      next[idx] = item;
    } else {
      if (next.some(c => c.code.toUpperCase() === code)) {
        fb.textContent = `Coupon code "${code}" already exists`;
        fb.className = 'modal-feedback error';
        return;
      }
      next.push(item);
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    }

    try {
      await AdminAPI.saveCoupons(next);
      couponsCache = next;
      closeModal('coupon-modal-overlay');
      toast(`Coupon "${code}" saved successfully`);
      paintCoupons(couponsCache);
    } catch (err) {
      fb.textContent = err.message || 'Failed to save coupon';
      fb.className = 'modal-feedback error';
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtnHtml;
      }
    }
  });
}

/* ── Boot ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  const dateEl = document.getElementById('admin-today-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }
  bindEvents();

  const getInitialSection = () => {
    const h = (location.hash || '').replace(/^#/, '').trim();
    if (h === 'products') return 'perfumes';
    if (h && h in SECTION_TITLES) return h;
    return 'dashboard';
  };
  const initSec = getInitialSection();

  const token = AdminAPI.getToken();
  const cachedUser = AdminAPI.getUser();
  if (token && cachedUser && cachedUser.role === 'admin') {
    // 0ms immediate render!
    showApp(cachedUser);
    switchSection(initSec);
    Promise.allSettled([
      requireAdmin(),
      ensureTypes().then(fillTypeSelects),
    ]);
  } else {
    const ok = await requireAdmin();
    if (ok) {
      switchSection(initSec);
      ensureTypes().then(fillTypeSelects).catch(() => {});
    }
  }

  window.addEventListener('hashchange', () => {
    const sec = (location.hash || '').replace(/^#/, '').trim();
    if (sec && (sec in SECTION_TITLES || sec === 'products')) {
      switchSection(sec);
    }
  });
});
