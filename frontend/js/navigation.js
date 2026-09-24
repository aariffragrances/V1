'use strict';
/* Navigation — shared chrome integrity + mobile drawer + Browse All dropdown */

const SITE_BROWSE_LINKS = [
  { href: 'products.html', label: 'All Perfumes' },
  { href: 'index.html#fragrance-types', label: 'Fragrance Types', cls: 'browse-nav-link--section' },
  { href: 'products.html?collection=featured', label: 'Featured' },
  { href: 'products.html?collection=bestsellers', label: 'Best Sellers' },
  { href: 'about.html', label: 'About' },
  { href: 'contact.html', label: 'Contact' },
  { href: 'policies.html', label: 'Policies' },
];

function ensureSiteChrome() {
  const stack = document.getElementById('header-stack');
  if (!stack) return;

  // Ensure wishlist exists next to cart
  const actions = stack.querySelector('.header-actions');
  if (actions && !document.getElementById('header-wishlist')) {
    const wish = document.createElement('a');
    wish.href = 'wishlist.html';
    wish.className = 'header-action';
    wish.id = 'header-wishlist';
    wish.title = 'Wishlist';
    wish.innerHTML = '<i class="fa-regular fa-heart"></i><span class="header-action-label">Wishlist</span><span class="header-action-badge" id="wishlist-count">0</span>';
    const cart = document.getElementById('header-basket');
    if (cart) actions.insertBefore(wish, cart);
    else {
      const toggle = document.getElementById('mobile-menu-toggle');
      if (toggle) actions.insertBefore(wish, toggle);
      else actions.appendChild(wish);
    }
  }

  // Ensure search exists
  const headerInner = stack.querySelector('.header-inner');
  if (headerInner && !headerInner.querySelector('.header-search-wrapper')) {
    const search = document.createElement('div');
    search.className = 'header-search-wrapper';
    search.innerHTML = `
      <div class="header-search">
        <i class="fa-solid fa-magnifying-glass search-icon"></i>
        <input type="search" id="header-search" placeholder="Search perfumes..." aria-label="Search perfumes" autocomplete="off">
        <button type="button" id="search-clear" class="search-clear" aria-label="Clear search"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div id="search-dropdown" class="search-dropdown" aria-hidden="true"></div>`;
    const actionsEl = headerInner.querySelector('.header-actions');
    if (actionsEl) headerInner.insertBefore(search, actionsEl);
    else headerInner.appendChild(search);
  }

  // Ensure full browse bar (Browse All + all nav links)
  let browse = stack.querySelector('.browse-bar');
  const needsBrowse =
    !browse ||
    !browse.querySelector('#subnav-types-btn') ||
    !browse.querySelector('a[href="policies.html"]') ||
    !browse.querySelector('a[href*="collection=featured"]');

  if (needsBrowse) {
    const html = `
      <div class="container browse-bar-inner">
        <div class="browse-cat-wrap" id="subnav-types-wrap">
          <button type="button" class="browse-cat-btn" id="subnav-types-btn" aria-expanded="false" aria-haspopup="true">
            <i class="fa-solid fa-border-all"></i> Browse All Fragrances
            <i class="fa-solid fa-chevron-down sub-nav-chevron"></i>
          </button>
          <div class="sub-nav-dropdown" id="subnav-types-dropdown" role="menu"></div>
        </div>
        <nav class="browse-nav-links" aria-label="Main navigation">
          ${SITE_BROWSE_LINKS.map((l) =>
            `<a href="${l.href}" class="browse-nav-link${l.cls ? ' ' + l.cls : ''}">${l.label}</a>`
          ).join('')}
        </nav>
      </div>`;
    if (!browse) {
      browse = document.createElement('div');
      browse.className = 'browse-bar';
      stack.appendChild(browse);
    }
    browse.innerHTML = html;
  }
function initNavigation() {
  ensureSiteChrome();

  // Highlight active link in drawer and header
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.drawer-nav a, .browse-nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    const page = href.split('/').pop().split('?')[0].split('#')[0];
    if (page && page === currentPath) {
      link.classList.add('active');
    }
  });

  // Mobile drawer
  const toggle  = document.getElementById('mobile-menu-toggle');
  const drawer  = document.getElementById('mobile-drawer');
  const overlay = document.getElementById('drawer-overlay');
  const close   = document.getElementById('drawer-close');

  function openDrawer()  { drawer?.classList.add('open'); overlay?.classList.add('open'); document.body.style.overflow = 'hidden'; toggle?.setAttribute('aria-expanded','true'); }
  function closeDrawer() { drawer?.classList.remove('open'); overlay?.classList.remove('open'); document.body.style.overflow = ''; toggle?.setAttribute('aria-expanded','false'); }

  toggle?.addEventListener('click', openDrawer);
  close?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  // Browse-all dropdown
  const btn      = document.getElementById('subnav-types-btn');
  const dropdown = document.getElementById('subnav-types-dropdown');
  if (btn && dropdown) {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const open = dropdown.classList.toggle('open');
      btn.setAttribute('aria-expanded', open);
      if (open) buildBrowseDropdown(dropdown);
    });
    document.addEventListener('click', () => { dropdown.classList.remove('open'); btn.setAttribute('aria-expanded','false'); });
    dropdown.addEventListener('click', e => e.stopPropagation());
  }

  // Populate mobile type list
  const mobileList = document.getElementById('mobile-type-list');
  if (mobileList) {
    document.addEventListener('aarif:metadata-ready', () => {
      mobileList.innerHTML = FRAGRANCE_TYPES.map(t =>
        `<li><a href="products.html?type=${encodeURIComponent(t.type_id)}">${t.type_name}</a></li>`
      ).join('');
    });
  }
}

function buildBrowseDropdown(dropdown) {
  if (dropdown.dataset.built) return;
  dropdown.dataset.built = '1';
  dropdown.innerHTML = FRAGRANCE_TYPES.length
    ? FRAGRANCE_TYPES.map(t =>
        `<a href="products.html?type=${encodeURIComponent(t.type_id)}">${t.type_name}
           <span style="color:#888;font-size:11px;margin-left:6px">${t.product_count || ''}</span>
         </a>`).join('')
    : '<a href="products.html">All Perfumes</a>';
}

function renderFooterTypes() {
  const wrap = document.getElementById('footer-types-list');
  if (!wrap || typeof FRAGRANCE_TYPES === 'undefined') return;
  wrap.innerHTML = FRAGRANCE_TYPES.slice(0, 7).map(t =>
    `<a href="products.html?type=${encodeURIComponent(t.type_id)}">${String(t.type_name || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</a>`
  ).join('');
}
