'use strict';
/* Filter state + sidebar for products.html */
const filterState = {
  selectedTypes: [],
  collection: '', // '' | 'featured' | 'bestsellers'
  productType: 'attar', // '' | 'attar' | 'perfume' | 'car_hanger' — default Attar on catalog
  searchQuery: '',
  sortBy: 'none',
  currentPage: 1,
  perPage: 24,
};

const FILTER_TYPE_ICONS = {
  'FT001': 'fa-wind',
  'FT002': 'fa-apple-whole',
  'FT003': 'fa-fire',
  'FT004': 'fa-gem',
  'FT005': 'fa-spa',
  'FT006': 'fa-tree',
  'FT007': 'fa-cookie-bite',
  'FT008': 'fa-scroll',
};

const FILTER_COLLECTIONS = {
  featured: { name: 'Featured products' },
  bestsellers: { name: 'Best Sellers' },
};

function applyUrlParams() {
  const p = new URLSearchParams(window.location.search);
  const type   = p.get('type');
  const search = p.get('search');
  const sort   = p.get('sort');
  const productType = (p.get('ptype') || p.get('productType') || '').toLowerCase();
  const collection = (p.get('collection') || p.get('filter') || '').toLowerCase();
  if (type)   { filterState.selectedTypes = [type]; }
  if (search) { filterState.searchQuery = search; const inp = document.getElementById('header-search'); if (inp) inp.value = search; }
  if (sort)   filterState.sortBy = sort;
  if (productType === 'attar' || productType === 'perfume' || productType === 'car_hanger' || productType === 'car-hanger' || productType === 'car_hangover' || productType === 'car-hangover') {
    filterState.productType = (productType === 'car-hanger' || productType === 'car_hangover' || productType === 'car-hangover')
      ? 'car_hanger'
      : productType;
  }
  if (collection === 'featured' || collection === 'bestsellers' || collection === 'best-sellers') {
    filterState.collection = collection === 'best-sellers' ? 'bestsellers' : collection;
  }
}

function applyFilters(skipReset) {
  if (!skipReset) filterState.currentPage = 1;

  let results = typeof ALL_PERFUMES !== 'undefined' ? [...ALL_PERFUMES] : [];

  if (filterState.collection === 'featured') {
    results = results.filter(p => p.isFeatured);
  } else if (filterState.collection === 'bestsellers') {
    results = results.filter(p => p.isBestSeller);
  }

  if (filterState.selectedTypes.length) {
    results = results.filter(p =>
      filterState.selectedTypes.includes(p.fragranceTypeId) ||
      filterState.selectedTypes.includes(p.fragranceTypeName)
    );
  }
  if (filterState.productType === 'attar') {
    results = results.filter(p => p.isAttar || ((p.price6ml != null || p.price12ml != null) && !(p.isCarHanger || p.isCarHangover)));
  } else if (filterState.productType === 'perfume') {
    results = results.filter(p => p.isPerfume || p.perfumeSpray || p.price30ml != null || p.price50ml != null);
  } else if (filterState.productType === 'car_hanger') {
    results = results.filter(p => p.isCarHanger || p.isCarHangover);
  }
  if (filterState.searchQuery.trim()) {
    const q = filterState.searchQuery.toLowerCase();
    results = results.filter(p =>
      (p.displayName||'').toLowerCase().includes(q) ||
      (p.perfumeName||'').toLowerCase().includes(q) ||
      (p.fragranceTypeName||'').toLowerCase().includes(q)
    );
  }

  if (filterState.sortBy === 'name-asc')   results.sort((a,b) => (a.displayName||'').localeCompare(b.displayName||''));
  if (filterState.sortBy === 'name-desc')  results.sort((a,b) => (b.displayName||'').localeCompare(a.displayName||''));
  if (filterState.sortBy === 'price-asc')  results.sort((a,b) => getMinPrice(a)-getMinPrice(b));
  if (filterState.sortBy === 'price-desc') results.sort((a,b) => getMinPrice(b)-getMinPrice(a));

  const total = results.length;
  const pp    = filterState.perPage;
  const start = (filterState.currentPage - 1) * pp;
  const page  = results.slice(start, start + pp);

  if (typeof renderGrid          === 'function') renderGrid(page, total);
  if (typeof renderPagination    === 'function') renderPagination(total);
  if (typeof updateResultCount   === 'function') updateResultCount(page.length, total);
  if (typeof renderActiveChips   === 'function') renderActiveChips();
  if (typeof renderBreadcrumb    === 'function') renderBreadcrumb();
  syncSidebarSelection();
  syncTypeToggle();
}

function getMinPrice(p) {
  const prices = [p.price6ml,p.price12ml,p.price30ml,p.price50ml].filter(x => x != null);
  return prices.length ? Math.min(...prices) : 0;
}

function buildSidebarFilters() {
  const list = document.getElementById('type-filter-list');
  if (!list || typeof FRAGRANCE_TYPES === 'undefined') return;

  list.innerHTML = FRAGRANCE_TYPES.map(t => `
    <button type="button" class="filter-nav-item" role="listitem"
      data-filter-kind="type"
      data-filter-id="${t.type_id}"
      aria-pressed="false">
      <i class="fa-solid ${FILTER_TYPE_ICONS[t.type_id] || 'fa-spray-can-sparkles'}" aria-hidden="true"></i>
      <span class="filter-nav-text">${t.type_name}</span>
      <span class="filter-nav-count">${t.product_count || 0}</span>
    </button>`).join('');

  if (!list.dataset.bound) {
    list.dataset.bound = '1';
    list.addEventListener('click', e => {
      const btn = e.target.closest('.filter-nav-item');
      if (!btn || !list.contains(btn)) return;
      const id = btn.dataset.filterId;
      filterState.collection = '';
      if (filterState.selectedTypes.includes(id)) {
        filterState.selectedTypes = filterState.selectedTypes.filter(x => x !== id);
      } else {
        filterState.selectedTypes.push(id);
      }
      filterState.currentPage = 1;
      applyFilters();
    });
  }

  // Collection rows (Featured / Best Sellers) — same style as Category
  document.querySelectorAll('[data-filter-collection]').forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const id = btn.dataset.filterCollection;
      if (filterState.collection === id) {
        filterState.collection = '';
      } else {
        filterState.collection = id;
        filterState.selectedTypes = [];
      }
      filterState.currentPage = 1;
      applyFilters();
    });
  });

  // Accordion toggle for Category
  document.querySelectorAll('[data-filter-acc]').forEach(trigger => {
    if (trigger.dataset.bound) return;
    trigger.dataset.bound = '1';
    trigger.addEventListener('click', () => {
      const open = trigger.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      const panel = trigger.nextElementSibling;
      if (panel) panel.classList.toggle('is-open', open);
    });
  });

  syncSidebarSelection();
}

function syncSidebarSelection() {
  const list = document.getElementById('type-filter-list');
  if (list) {
    list.querySelectorAll('.filter-nav-item').forEach(btn => {
      const active = filterState.selectedTypes.includes(btn.dataset.filterId);
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }
  document.querySelectorAll('[data-filter-collection]').forEach(btn => {
    const active = filterState.collection === btn.dataset.filterCollection;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function syncTypeToggle() {
  document.querySelectorAll('#type-toggle .type-toggle-btn').forEach(btn => {
    const active = filterState.productType === btn.dataset.productType;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function initTypeToggle() {
  const wrap = document.getElementById('type-toggle');
  if (!wrap || wrap.dataset.bound) return;
  wrap.dataset.bound = '1';
  wrap.addEventListener('click', e => {
    const btn = e.target.closest('.type-toggle-btn');
    if (!btn || !wrap.contains(btn)) return;
    const val = btn.dataset.productType;
    filterState.productType = filterState.productType === val ? '' : val;
    filterState.currentPage = 1;
    applyFilters();
  });
  syncTypeToggle();
}

function renderActiveChips() {
  // Filter chips removed from sidebar
}

function renderBreadcrumb() {
  const nav = document.getElementById('cat-page-header');
  if (!nav) return;
  const parts = ['<a href="index.html">Home</a>', '<span>›</span>', '<a href="products.html">Perfumes</a>'];
  if (filterState.collection && FILTER_COLLECTIONS[filterState.collection]) {
    parts.push('<span>›</span>', `<span class="breadcrumb-current">${FILTER_COLLECTIONS[filterState.collection].name}</span>`);
  } else if (filterState.selectedTypes.length === 1) {
    const t = typeof FRAGRANCE_TYPES !== 'undefined' ? FRAGRANCE_TYPES.find(x => x.type_id===filterState.selectedTypes[0]) : null;
    if (t) parts.push('<span>›</span>', `<span class="breadcrumb-current">${t.type_name}</span>`);
  }
  nav.innerHTML = parts.join(' ');
}

function clearAllFilters() {
  filterState.selectedTypes = [];
  filterState.collection    = '';
  filterState.productType   = 'attar';
  filterState.searchQuery   = '';
  filterState.sortBy        = 'none';
  filterState.currentPage   = 1;
  const inp = document.getElementById('header-search'); if (inp) inp.value='';
  const sel = document.getElementById('sort-select');   if (sel) sel.value='none';
  applyFilters();
}
