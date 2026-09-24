'use strict';
/* Aarif Fragrances — Admin Portal */

const SECTION_TITLES = {
  dashboard: 'Dashboard',
  perfumes: 'Perfumes',
  'fragrance-types': 'Fragrance Types',
  banners: 'Banners',
  testimonials: 'Testimonials',
  orders: 'Orders',
  contact: 'Contact Messages',
  settings: 'Store Settings',
};

let state = {
  types: [],
  perfumes: [],
  banners: [],
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
  } catch (_) {
    AdminAPI.clearSession();
    showLogin();
    return false;
  }
}

/* ── Navigation ─────────────────────────────────────────── */
function switchSection(section) {
  document.querySelectorAll('.adm-nav-link').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.section === section);
  });
  document.querySelectorAll('.adm-section').forEach((sec) => {
    sec.classList.toggle('active', sec.id === 'section-' + section);
  });
  document.body.classList.remove('sidebar-open');
  document.getElementById('adm-sidebar')?.classList.remove('open');

  if (section === 'dashboard') loadDashboard();
  else if (section === 'perfumes') loadPerfumes();
  else if (section === 'fragrance-types') loadTypes();
  else if (section === 'banners') loadBanners();
  else if (section === 'testimonials') loadTestimonials();
  else if (section === 'orders') loadOrders();
  else if (section === 'contact') loadContact();
  else if (section === 'settings') loadSettings();
}

/* ── Dashboard ──────────────────────────────────────────── */
async function loadDashboard() {
  try {
    const s = await AdminAPI.stats();
    document.getElementById('stat-perfumes').textContent = s.total_perfumes ?? s.totalPerfumes ?? 0;
    document.getElementById('stat-types').textContent = s.total_fragrance_types ?? s.totalFragranceTypes ?? 0;
    document.getElementById('stat-featured').textContent = s.featured_count ?? s.featuredCount ?? 0;
    document.getElementById('stat-bestsellers').textContent = s.best_seller_count ?? s.bestSellerCount ?? 0;
    const unread = s.unread_messages ?? s.unreadMessages;
    if (unread != null) updateUnreadBadges(unread);
    const low = s.low_stock_count ?? s.lowStockCount ?? 0;
    const newOrders = s.new_orders_count ?? s.newOrdersCount ?? 0;
    updateNotifBadge(low);
    updateOrdersBadge(newOrders);
    await loadLowStockPanel();
  } catch (err) {
    toast(err.message || 'Failed to load stats', true);
  }
}

async function loadLowStockPanel() {
  const list = document.getElementById('low-stock-list');
  const badge = document.getElementById('low-stock-count-badge');
  if (!list) return;
  try {
    const data = await AdminAPI.lowStock(10);
    const items = data.items || [];
    if (badge) badge.textContent = String(items.length);
    updateNotifBadge(items.length);
    if (!items.length) {
      list.innerHTML = '<p class="table-empty" style="padding:16px">All stock levels look healthy.</p>';
      return;
    }
    list.innerHTML = items.map((p) => `
      <button type="button" class="low-stock-item" data-edit-stock="${esc(p.perfumeId)}">
        <div class="table-thumb table-thumb--empty"><i class="fa-solid fa-box"></i></div>
        <div style="flex:1;text-align:left">
          <strong>${esc(p.perfumeName)}</strong>
          <div style="font-size:.75rem;color:var(--adm-muted)">${esc(p.perfumeId)}</div>
        </div>
        <span class="badge ${p.stockQuantity <= 0 ? 'badge--pink' : 'badge--amber'}">${p.stockQuantity}</span>
      </button>`).join('');
  } catch (err) {
    list.innerHTML = `<p class="table-empty">${esc(err.message)}</p>`;
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
  if (state.types.length) return state.types;
  state.types = await AdminAPI.fragranceTypes();
  return state.types;
}

function fillTypeSelects() {
  const opts = '<option value="">All Types</option>' +
    state.types.map((t) => `<option value="${esc(t.type_id)}">${esc(t.type_name)}</option>`).join('');
  const filter = document.getElementById('perfume-type-filter');
  if (filter) {
    const cur = filter.value;
    filter.innerHTML = opts;
    filter.value = cur;
  }
  const pf = document.getElementById('pf-type');
  if (pf) {
    pf.innerHTML = state.types.map((t) =>
      `<option value="${esc(t.type_id)}">${esc(t.type_name)}</option>`
    ).join('');
  }
}

async function loadTypes() {
  const tbody = document.getElementById('types-tbody');
  try {
    state.types = await AdminAPI.fragranceTypes();
    fillTypeSelects();
    if (!state.types.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No fragrance types yet</td></tr>';
      return;
    }
    tbody.innerHTML = state.types.map((t) => `
      <tr class="${t.is_active ? '' : 'adm-row-inactive'}">
        <td><code>${esc(t.type_id)}</code></td>
        <td><strong>${esc(t.type_name)}</strong></td>
        <td>${esc(t.slug || '')}</td>
        <td>${esc((t.description || '').slice(0, 60))}</td>
        <td>${t.item_count ?? 0}</td>
        <td>${t.display_order ?? 0}</td>
        <td><span class="badge ${t.is_active ? 'badge--green' : 'badge--gray'}">${t.is_active ? 'Active' : 'Off'}</span></td>
        <td>
          <div class="adm-table-actions">
            <button type="button" data-edit-type="${esc(t.type_id)}" title="Edit"><i class="fa-solid fa-pencil"></i></button>
            <button type="button" class="del" data-del-type="${esc(t.type_id)}" title="Delete"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty">${esc(err.message)}</td></tr>`;
  }
}

function openTypeModal(type) {
  document.getElementById('type-modal-title').textContent = type ? 'Edit Fragrance Type' : 'Add Fragrance Type';
  document.getElementById('ft-original-id').value = type?.type_id || '';
  document.getElementById('ft-id').value = type?.type_id || '';
  document.getElementById('ft-id').readOnly = !!type;
  document.getElementById('ft-name').value = type?.type_name || '';
  document.getElementById('ft-slug').value = type?.slug || '';
  document.getElementById('ft-description').value = type?.description || '';
  document.getElementById('ft-order').value = type?.display_order ?? 0;
  document.getElementById('ft-is-active').checked = type ? !!type.is_active : true;
  document.getElementById('type-form-feedback').textContent = '';
  openModal('type-modal-overlay');
}

/* ── Perfumes ───────────────────────────────────────────── */
async function loadPerfumes() {
  const tbody = document.getElementById('perfumes-tbody');
  try {
    await ensureTypes();
    fillTypeSelects();
    const search = document.getElementById('perfume-search')?.value?.trim() || '';
    const typeId = document.getElementById('perfume-type-filter')?.value || '';
    const params = { page: 1, per_page: 500 };
    if (search) params.search = search;
    if (typeId) params.fragrance_type_id = typeId;
    const data = await AdminAPI.perfumes(params);
    state.perfumes = data.items || data || [];
    const total = data.total_count ?? data.total ?? state.perfumes.length;
    const sub = document.getElementById('perfumes-subtitle');
    if (sub) sub.textContent = `${total} perfume${total === 1 ? '' : 's'} across ${state.types.length} fragrance types`;
    const showing = document.getElementById('perfumes-filter-showing');
    if (showing) showing.textContent = `Showing ${state.perfumes.length} of ${total} perfume${total === 1 ? '' : 's'}`;
    if (!state.perfumes.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No perfumes found</td></tr>';
      updateBulkBar();
      return;
    }
    tbody.innerHTML = state.perfumes.map((p) => {
      const badges = [];
      if (p.isAttar) badges.push('<span class="badge-chip">Attar</span>');
      if (p.isPerfume) badges.push('<span class="badge-chip">Perfume</span>');
      if (p.isCarHanger || p.isCarHangover) badges.push('<span class="badge-chip">Car Hanger</span>');
      if (p.isFeatured) badges.push('<span class="badge-chip badge-chip--feat">Feat</span>');
      if (p.isBestSeller) badges.push('<span class="badge-chip badge-chip--hot">Best</span>');
      if (p.isNewArrival) badges.push('<span class="badge-chip badge-chip--new">New</span>');
      const imgSrc = p.primaryImageUrl || 'assets/bottle-blue.png?v=1';
      const img = `<img src="${esc(imgSrc)}" alt="" class="thumb" loading="lazy" onerror="this.onerror=null;this.src='assets/bottle-blue.png?v=1'">`;
      const prices = [
        p.price6ml != null ? `<span>6ml <b>${money(p.price6ml)}</b></span>` : '',
        p.price12ml != null ? `<span>12ml <b>${money(p.price12ml)}</b></span>` : '',
        p.price30ml != null ? `<span>30ml <b>${money(p.price30ml)}</b></span>` : '',
        p.price50ml != null ? `<span>50ml <b>${money(p.price50ml)}</b></span>` : '',
      ].filter(Boolean).join('') || '—';
      const stock = Number(p.stockQuantity ?? 0);
      const stockBadge = stock <= 0
        ? '<span class="badge badge--pink">Out of Stock</span>'
        : stock <= 10
          ? `<span class="badge badge--amber">${stock}</span>`
          : `<span>${stock}</span>`;
      const inactive = p.isActive === false ? ' adm-row-inactive' : '';
      return `<tr class="${inactive.trim()}" data-id="${esc(p.perfumeId)}">
        <td><input type="checkbox" class="perfume-cb" value="${esc(p.perfumeId)}"></td>
        <td>
          <div class="prod-cell">
            ${img}
            <div class="prod-cell-text">
              <strong>${esc(p.perfumeName)}</strong>
              <small>${esc(p.perfumeId)}${p.brand ? ' · ' + esc(p.brand) : ''}</small>
            </div>
          </div>
        </td>
        <td>${esc(p.fragranceTypeName || '—')}</td>
        <td><div class="price-stack">${prices}</div></td>
        <td>${stockBadge}</td>
        <td><div class="badge-chips">${badges.join('') || '—'}</div></td>
        <td>
          <label class="toggle" title="Active">
            <input type="checkbox" class="perfume-active-toggle" data-id="${esc(p.perfumeId)}" ${p.isActive !== false ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td>
          <div class="adm-table-actions">
            <button type="button" data-edit-perfume="${esc(p.perfumeId)}" title="Edit"><i class="fa-solid fa-pencil"></i></button>
            <button type="button" class="del" data-del-perfume="${esc(p.perfumeId)}" title="Delete"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
    }).join('');
    updateBulkBar();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty">${esc(err.message)}</td></tr>`;
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

function openPerfumeModal(p) {
  document.getElementById('perfume-modal-title').textContent = p ? 'Edit Perfume' : 'Add Perfume';
  document.getElementById('pf-original-id').value = p?.perfumeId || '';
  document.getElementById('pf-id').value = p?.perfumeId || '';
  document.getElementById('pf-id').readOnly = !!p;
  document.getElementById('pf-name').value = p?.perfumeName || '';
  document.getElementById('pf-brand').value = p?.brand || '';
  document.getElementById('pf-type').value = p?.fragranceTypeId || (state.types[0]?.type_id || '');
  document.getElementById('pf-stock').value = p?.stockQuantity ?? 100;
  document.getElementById('pf-description').value = p?.description || '';
  document.getElementById('pf-price-6').value = p?.price6ml ?? '';
  document.getElementById('pf-price-12').value = p?.price12ml ?? '';
  document.getElementById('pf-price-30').value = p?.price30ml ?? '';
  document.getElementById('pf-price-50').value = p?.price50ml ?? '';
  document.getElementById('pf-is-attar').checked = !!p?.isAttar;
  document.getElementById('pf-is-perfume').checked = p ? !!p.isPerfume : true;
  document.getElementById('pf-is-car-hanger').checked = !!(p?.isCarHanger ?? p?.isCarHangover);
  document.getElementById('pf-is-featured').checked = !!p?.isFeatured;
  document.getElementById('pf-is-bestseller').checked = !!p?.isBestSeller;
  document.getElementById('pf-is-newarrival').checked = !!p?.isNewArrival;
  document.getElementById('pf-is-active').checked = p ? !!p.isActive : true;
  document.getElementById('pf-image-files').value = '';
  document.getElementById('perfume-form-feedback').textContent = '';
  const preview = document.getElementById('pf-images-preview');
  preview.innerHTML = p?.primaryImageUrl
    ? `<img src="${esc(p.primaryImageUrl)}" alt="">`
    : '';
  openModal('perfume-modal-overlay');
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
  try {
    if (scrollActive) scrollActive.innerHTML = '<p class="banner-row-empty">Loading…</p>';
    if (scrollInactive) scrollInactive.innerHTML = '';
    const banners = await AdminAPI.banners();
    paintBanners(Array.isArray(banners) ? banners : (banners.items || []));
  } catch (err) {
    if (scrollActive) scrollActive.innerHTML = `<p class="banner-row-empty">${esc(err.message)}</p>`;
    if (scrollInactive) scrollInactive.innerHTML = '';
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

  await ensureTypes();
  const typeSel = document.getElementById('bn-fragrance-type');
  if (typeSel) {
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
async function loadTestimonials() {
  const tbody = document.getElementById('testimonials-tbody');
  try {
    const rows = await AdminAPI.testimonials();
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
    state.testimonials = rows;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">${esc(err.message)}</td></tr>`;
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
async function loadContact() {
  const tbody = document.getElementById('contact-tbody');
  try {
    const rows = await AdminAPI.contactSubmissions();
    const list = Array.isArray(rows) ? rows : (rows.items || []);
    const unread = rows.unread ?? list.filter((r) => !(r.isRead ?? r.is_read)).length;
    document.getElementById('contact-total').textContent = rows.total ?? list.length;
    document.getElementById('contact-unread').textContent = unread;
    updateUnreadBadges(unread);
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No messages</td></tr>';
      return;
    }
    state.contacts = list;
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
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty">${esc(err.message)}</td></tr>`;
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

async function loadSettings() {
  try {
    const s = await AdminAPI.settings();
    const data = s.settings || s;
    Object.keys(data).forEach((key) => {
      const el = document.getElementById('set-' + key);
      if (el) el.value = data[key] ?? '';
    });
  } catch (err) {
    toast(err.message || 'Failed to load settings', true);
  }
}

async function loadOrders() {
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;
  try {
    const status = document.getElementById('orders-status-filter')?.value || '';
    const params = status ? { status } : {};
    const data = await AdminAPI.orders(params);
    const items = data.items || [];
    const newCount = items.filter((o) => o.status === 'new').length;
    updateOrdersBadge(status ? (await AdminAPI.stats()).new_orders_count || newCount : newCount);
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No orders yet</td></tr>';
      return;
    }
    state.orders = items;
    tbody.innerHTML = items.map((o) => `
      <tr>
        <td><strong>${esc(o.orderRef)}</strong></td>
        <td>${esc((o.createdAt || '').toString().slice(0, 19).replace('T', ' '))}</td>
        <td>${o.itemCount ?? (o.items || []).length}</td>
        <td>${o.totalUnits ?? 0}</td>
        <td><span class="badge ${o.status === 'new' ? 'badge--pink' : o.status === 'delivered' ? 'badge--green' : 'badge--gray'}">${esc(o.status)}</span></td>
        <td>
          <div class="adm-table-actions">
            <button type="button" data-view-order="${o.id}" title="View"><i class="fa-solid fa-eye"></i></button>
            <button type="button" class="del" data-del-order="${o.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">${esc(err.message)}</td></tr>`;
  }
}

function openOrderModal(order) {
  document.getElementById('order-modal-title').textContent = `Order ${order.orderRef}`;
  const items = (order.items || []).map((i) =>
    `<tr><td>${esc(i.perfumeName)}</td><td>${esc(i.size || '—')}</td><td>${i.qty}</td><td>${i.price != null ? money(i.price) : '—'}</td></tr>`
  ).join('');
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
    ${order.whatsappMessage ? `<pre class="contact-message">${esc(order.whatsappMessage)}</pre>` : ''}
    <div class="modal-actions">
      <button type="button" class="btn btn-outline" data-close-modal="order-modal-overlay">Close</button>
      <button type="button" class="btn btn-primary" id="order-save-status" data-id="${order.id}">Save Status</button>
    </div>`;
  openModal('order-modal-overlay');
  document.getElementById('order-save-status')?.addEventListener('click', async () => {
    const id = Number(document.getElementById('order-save-status').dataset.id);
    const status = document.getElementById('order-status-select').value;
    try {
      await AdminAPI.updateOrder(id, { status });
      toast('Order updated');
      closeModal('order-modal-overlay');
      loadOrders();
    } catch (err) { toast(err.message, true); }
  });
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

  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
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
  document.getElementById('add-perfume-btn')?.addEventListener('click', async () => {
    await ensureTypes(); fillTypeSelects(); openPerfumeModal(null);
  });

  document.getElementById('perfumes-tbody')?.addEventListener('click', async (e) => {
    const editId = e.target.closest('[data-edit-perfume]')?.dataset.editPerfume;
    const delId = e.target.closest('[data-del-perfume]')?.dataset.delPerfume;
    if (editId) {
      await ensureTypes(); fillTypeSelects();
      let p = state.perfumes.find((x) => x.perfumeId === editId);
      try { p = { ...p, ...(await AdminAPI.getPerfume(editId)) }; } catch (_) {}
      openPerfumeModal(p);
    }
    if (delId) {
      const ok = await confirmDialog('Delete perfume?', `Delete ${delId}? This cannot be undone.`);
      if (!ok) return;
      try {
        await AdminAPI.deletePerfume(delId);
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
      const p = state.perfumes.find((x) => x.perfumeId === id);
      if (p) p.isActive = isActive;
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
    const ids = getSelectedPerfumeIds();
    const mode = document.getElementById('bulk-mode').value;
    const fb = document.getElementById('bulk-prices-feedback');
    const body = { perfume_ids: ids, mode };
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
    }
  });

  document.getElementById('low-stock-list')?.addEventListener('click', async (e) => {
    const id = e.target.closest('[data-edit-stock]')?.dataset.editStock;
    if (!id) return;
    switchSection('perfumes');
    await ensureTypes(); fillTypeSelects();
    let p = state.perfumes.find((x) => x.perfumeId === id);
    try { p = { ...p, ...(await AdminAPI.getPerfume(id)) }; } catch (_) {}
    if (p) openPerfumeModal(p);
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

  document.getElementById('perfume-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fb = document.getElementById('perfume-form-feedback');
    fb.textContent = '';
    const originalId = document.getElementById('pf-original-id').value;
    const body = {
      perfume_id: document.getElementById('pf-id').value.trim(),
      perfume_name: document.getElementById('pf-name').value.trim(),
      brand: document.getElementById('pf-brand').value.trim() || null,
      fragrance_type_id: document.getElementById('pf-type').value,
      description: document.getElementById('pf-description').value.trim() || null,
      stock_quantity: Number(document.getElementById('pf-stock').value) || 0,
      price_6ml: numOrNull(document.getElementById('pf-price-6')),
      price_12ml: numOrNull(document.getElementById('pf-price-12')),
      price_30ml: numOrNull(document.getElementById('pf-price-30')),
      price_50ml: numOrNull(document.getElementById('pf-price-50')),
      is_attar: document.getElementById('pf-is-attar').checked,
      is_perfume: document.getElementById('pf-is-perfume').checked,
      is_car_hanger: document.getElementById('pf-is-car-hanger').checked,
      is_featured: document.getElementById('pf-is-featured').checked,
      is_best_seller: document.getElementById('pf-is-bestseller').checked,
      is_new_arrival: document.getElementById('pf-is-newarrival').checked,
      is_active: document.getElementById('pf-is-active').checked,
    };
    try {
      if (originalId) await AdminAPI.updatePerfume(originalId, body);
      else await AdminAPI.createPerfume(body);
      const files = [...(document.getElementById('pf-image-files').files || [])];
      if (files.length) {
        try { await AdminAPI.uploadPerfumeImage(body.perfume_id, files); }
        catch (upErr) { toast('Saved, but image upload failed: ' + upErr.message, true); }
      }
      toast('Perfume saved');
      closeModal('perfume-modal-overlay');
      loadPerfumes();
    } catch (err) {
      fb.textContent = typeof err.message === 'string' ? err.message : 'Save failed';
    }
  });

  // Types
  document.getElementById('add-type-btn')?.addEventListener('click', () => openTypeModal(null));
  document.getElementById('types-tbody')?.addEventListener('click', async (e) => {
    const editId = e.target.closest('[data-edit-type]')?.dataset.editType;
    const delId = e.target.closest('[data-del-type]')?.dataset.delType;
    if (editId) openTypeModal(state.types.find((t) => t.type_id === editId));
    if (delId) {
      const ok = await confirmDialog('Delete type?', `Delete fragrance type ${delId}?`);
      if (!ok) return;
      try {
        await AdminAPI.deleteFragranceType(delId);
        state.types = [];
        toast('Type deleted');
        loadTypes();
      } catch (err) { toast(err.message, true); }
    }
  });
  document.getElementById('type-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fb = document.getElementById('type-form-feedback');
    const original = document.getElementById('ft-original-id').value;
    const body = {
      type_id: document.getElementById('ft-id').value.trim(),
      type_name: document.getElementById('ft-name').value.trim(),
      slug: document.getElementById('ft-slug').value.trim() || undefined,
      description: document.getElementById('ft-description').value.trim() || null,
      display_order: Number(document.getElementById('ft-order').value) || 0,
      is_active: document.getElementById('ft-is-active').checked,
    };
    try {
      if (original) await AdminAPI.updateFragranceType(original, body);
      else await AdminAPI.createFragranceType(body);
      state.types = [];
      toast('Fragrance type saved');
      closeModal('type-modal-overlay');
      loadTypes();
    } catch (err) { fb.textContent = err.message || 'Save failed'; }
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
    try {
      if (id) await AdminAPI.updateBanner(id, body);
      else await AdminAPI.createBanner(body);
      toast('Banner saved');
      closeModal('banner-modal-overlay');
      loadBanners();
    } catch (err) { fb.textContent = err.message || 'Save failed'; }
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
    const id = document.getElementById('ts-id').value;
    const body = {
      customer_name: document.getElementById('ts-name').value.trim(),
      customer_initial: document.getElementById('ts-initial').value.trim() || null,
      rating: Number(document.getElementById('ts-rating').value) || 5,
      quote: document.getElementById('ts-quote').value.trim(),
      display_order: Number(document.getElementById('ts-order').value) || 0,
      is_featured: document.getElementById('ts-is-featured').checked,
    };
    try {
      if (id) await AdminAPI.updateTestimonial(id, body);
      else await AdminAPI.createTestimonial(body);
      toast('Testimonial saved');
      closeModal('testimonial-modal-overlay');
      loadTestimonials();
    } catch (err) { fb.textContent = err.message || 'Save failed'; }
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
        <p><strong>Enquiry:</strong> ${esc(row.enquiry_type || '—')}</p>
        <p><strong>Message:</strong></p>
        <p class="contact-message">${esc(row.message)}</p>`;
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
    const form = e.target;
    const body = {};
    [...form.elements].forEach((el) => {
      if (el.name) body[el.name] = el.value;
    });
    try {
      await AdminAPI.saveSettings(body);
      fb.textContent = 'Settings saved successfully.';
      fb.className = 'settings-feedback ok';
      toast('Settings saved');
    } catch (err) {
      fb.textContent = err.message || 'Save failed';
      fb.className = 'settings-feedback err';
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
  const ok = await requireAdmin();
  if (ok) {
    await ensureTypes().catch(() => {});
    fillTypeSelects();
    switchSection('dashboard');
  }
});
