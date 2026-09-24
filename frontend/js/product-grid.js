'use strict';
/* Renders the product grid on products.html with pagination */

function renderSkeletonGrid(count) {
  const grid = document.getElementById('product-grid');
  if (!grid) return;
  grid.innerHTML = Array(count || 12).fill(0).map(() => `
    <article class="fp-card fp-card--skeleton">
      <div class="fp-image-area" style="background:#f0e8d0;aspect-ratio:1"></div>
      <div class="fp-content">
        <div class="skeleton fp-title-skel" style="height:12px;width:50%;margin-bottom:8px"></div>
        <div class="skeleton fp-title-skel" style="height:15px;margin-bottom:6px"></div>
        <div class="skeleton fp-meta-skel" style="height:11px;width:60%"></div>
      </div>
    </article>`).join('');
}

function renderGrid(products, total) {
  const grid = document.getElementById('product-grid');
  if (!grid) return;
  if (!products || !products.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:48px;text-align:center;color:#888">
      <i class="fa-solid fa-spray-can-sparkles" style="font-size:48px;opacity:.3;margin-bottom:16px;display:block"></i>
      <p>No perfumes found. Try a different search or filter.</p></div>`;
    return;
  }
  grid.innerHTML = products.map((p, i) => buildProductCardHTML(p, i)).join('');
  bindProductCards(grid);
}

function renderPagination(total) {
  const wrap = document.getElementById('pagination');
  if (!wrap) return;
  const page = filterState.currentPage;
  const perPage = filterState.perPage;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (totalPages <= 1) { wrap.innerHTML = ''; return; }

  let html = '';
  if (page > 1) html += `<button class="page-btn" data-page="${page-1}">‹ Prev</button>`;

  const start = Math.max(1, page - 2);
  const end   = Math.min(totalPages, page + 2);
  if (start > 1)          html += `<button class="page-btn" data-page="1">1</button>${start>2?'<span style="padding:0 6px">…</span>':''}`;
  for (let i = start; i <= end; i++) html += `<button class="page-btn${i===page?' active':''}" data-page="${i}">${i}</button>`;
  if (end < totalPages)   html += `${end<totalPages-1?'<span style="padding:0 6px">…</span>':''}<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
  if (page < totalPages) html += `<button class="page-btn" data-page="${page+1}">Next ›</button>`;

  wrap.innerHTML = html;
  wrap.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filterState.currentPage = parseInt(btn.dataset.page, 10);
      applyFilters(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

function updateResultCount(showing, total) {
  const el = document.getElementById('result-count');
  if (el) el.textContent = `Showing ${showing} of ${total} perfume${total===1?'':'s'}`;
}

function initProductsPage() {
  applyUrlParams();
  buildSidebarFilters();
  initTypeToggle();
  initSortControl();
  initPerPageControl();
  initViewToggle();
  initMobileFilters();
  applyFilters();
  renderFooterTypes();
}

function initSortControl() {
  const sel = document.getElementById('sort-select');
  if (!sel) return;
  sel.value = filterState.sortBy;
  sel.addEventListener('change', () => {
    filterState.sortBy = sel.value;
    filterState.currentPage = 1;
    applyFilters();
  });
}

function initPerPageControl() {
  const sel = document.getElementById('per-page-select');
  if (!sel) return;
  sel.value = String(filterState.perPage);
  sel.addEventListener('change', () => {
    filterState.perPage = parseInt(sel.value, 10);
    filterState.currentPage = 1;
    applyFilters();
  });
}

function initMobileFilters() {
  const btn = document.getElementById('mobile-filter-btn');
  const sidebar = document.querySelector('.catalog-sidebar');

  let backdrop = document.getElementById('filter-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'filter-backdrop';
    backdrop.className = 'filter-backdrop';
    document.body.appendChild(backdrop);
  }

  const open = () => {
    if (sidebar) sidebar.classList.add('is-open');
    if (backdrop) backdrop.classList.add('is-open');
    document.body.classList.add('filter-drawer-open');
  };

  const close = () => {
    if (sidebar) sidebar.classList.remove('is-open');
    if (backdrop) backdrop.classList.remove('is-open');
    document.body.classList.remove('filter-drawer-open');
  };

  if (btn) btn.addEventListener('click', open);

  document.addEventListener('click', e => {
    if (e.target.closest('#mobile-filter-close') || e.target.closest('.filter-panel-close') || e.target === backdrop || e.target.id === 'drawer-overlay') {
      close();
    }
  });
}

function initViewToggle() {
  const gridBtn = document.getElementById('view-grid');
  const listBtn = document.getElementById('view-list');
  const grid    = document.getElementById('product-grid');
  if (!gridBtn || !listBtn || !grid) return;
  gridBtn.addEventListener('click', () => { grid.classList.remove('list-view'); gridBtn.classList.add('active'); listBtn.classList.remove('active'); });
  listBtn.addEventListener('click', () => { grid.classList.add('list-view');    listBtn.classList.add('active'); gridBtn.classList.remove('active'); });
}
