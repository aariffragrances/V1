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
}

const DRAWER_TYPE_ICONS = {
  'FT001': 'fa-wind',
  'FT002': 'fa-apple-whole',
  'FT003': 'fa-fire',
  'FT004': 'fa-gem',
  'FT005': 'fa-spa',
  'FT006': 'fa-tree',
  'FT007': 'fa-cookie-bite',
  'FT008': 'fa-scroll',
};

const STANDARD_FRAGRANCE_TYPES = [
  { id: 'FT001', name: 'Aquatic Fresh', icon: 'fa-wind', count: 7 },
  { id: 'FT002', name: 'Fruity Delights', icon: 'fa-apple-whole', count: 9 },
  { id: 'FT003', name: 'Spicy & Aromatic', icon: 'fa-fire', count: 9 },
  { id: 'FT004', name: 'Mystic Oud', icon: 'fa-gem', count: 7 },
  { id: 'FT005', name: 'Floral Elegance', icon: 'fa-spa', count: 6 },
  { id: 'FT006', name: 'Rich Woody', icon: 'fa-tree', count: 4 },
  { id: 'FT007', name: 'Sweet Gourmand', icon: 'fa-cookie-bite', count: 5 },
  { id: 'FT008', name: 'Heritage Traditional', icon: 'fa-scroll', count: 3 },
];

function ensureStandardMobileDrawer() {
  // Ensure overlay
  let overlay = document.getElementById('drawer-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'drawer-overlay';
    overlay.className = 'drawer-overlay';
    document.body.appendChild(overlay);
  }

  // Ensure drawer
  let drawer = document.getElementById('mobile-drawer');
  if (!drawer) {
    drawer = document.createElement('aside');
    drawer.id = 'mobile-drawer';
    drawer.className = 'mobile-drawer';
    drawer.setAttribute('aria-label', 'Mobile navigation');
    document.body.appendChild(drawer);
  }

  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const urlParams = new URLSearchParams(window.location.search);
  const activeType = urlParams.get('type') || '';
  const activeCol = urlParams.get('collection') || '';

  const types = (typeof FRAGRANCE_TYPES !== 'undefined' && FRAGRANCE_TYPES.length)
    ? FRAGRANCE_TYPES.map(t => ({
        id: t.type_id,
        name: t.type_name,
        count: t.product_count || '',
        icon: DRAWER_TYPE_ICONS[t.type_id] || 'fa-spray-can-sparkles'
      }))
    : STANDARD_FRAGRANCE_TYPES;

  drawer.innerHTML = `
    <div class="drawer-header">
      <div class="drawer-brand">
        <img src="https://res.cloudinary.com/h7kuxzes/image/upload/v1790527578/aarif-fragrances/brand/aarif-logo-full.png" alt="Aarif Fragrances" class="logo-img logo-img--drawer">
        <span class="logo-brand-text"><span class="logo-brand-name">AARIF</span><span class="logo-brand-tag">Fragrances</span></span>
      </div>
      <button type="button" id="drawer-close" class="drawer-close" aria-label="Close menu"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <nav class="drawer-nav">
      <a href="index.html" class="drawer-link${currentPath === 'index.html' && !activeType && !activeCol ? ' active' : ''}">
        <i class="fa-solid fa-house"></i> Home
      </a>
      <a href="products.html" class="drawer-link${currentPath === 'products.html' && !activeType && !activeCol ? ' active' : ''}">
        <i class="fa-solid fa-spray-can-sparkles"></i> All Perfumes
      </a>

      <!-- Category accordion matching exact user spec -->
      <div class="drawer-accordion">
        <button type="button" class="drawer-acc-trigger is-open" id="drawer-cat-trigger" aria-expanded="true">
          <span class="drawer-acc-label">
            <span class="drawer-acc-dot" aria-hidden="true"></span>
            Category
          </span>
          <i class="fa-solid fa-chevron-down drawer-acc-chevron"></i>
        </button>
        <div class="drawer-acc-panel is-open" id="drawer-cat-panel">
          ${types.map(t => `
            <a href="products.html?type=${encodeURIComponent(t.id)}" class="drawer-cat-item${activeType === t.id ? ' active' : ''}">
              <span class="drawer-cat-item-left">
                <i class="fa-solid ${t.icon} drawer-cat-icon"></i>
                <span class="drawer-cat-name">${t.name}</span>
              </span>
              <span class="drawer-cat-count">${t.count || ''}</span>
            </a>
          `).join('')}
        </div>
      </div>

      <a href="products.html?collection=featured" class="drawer-link drawer-link--bullet${activeCol === 'featured' ? ' active' : ''}">
        <span class="drawer-acc-dot" aria-hidden="true"></span> Featured products
      </a>
      <a href="products.html?collection=bestsellers" class="drawer-link drawer-link--bullet${activeCol === 'bestsellers' ? ' active' : ''}">
        <span class="drawer-acc-dot" aria-hidden="true"></span> Best Sellers
      </a>
      <a href="about.html" class="drawer-link${currentPath === 'about.html' ? ' active' : ''}">
        <i class="fa-solid fa-circle-info"></i> About
      </a>
      <a href="policies.html" class="drawer-link${currentPath === 'policies.html' ? ' active' : ''}">
        <i class="fa-solid fa-file-lines"></i> Policies
      </a>
      <a href="contact.html" class="drawer-link${currentPath === 'contact.html' ? ' active' : ''}">
        <i class="fa-solid fa-envelope"></i> Contact
      </a>
      <a href="https://wa.me/919688498926" target="_blank" rel="noopener" class="drawer-link site-whatsapp-link">
        <i class="fa-brands fa-whatsapp"></i> WhatsApp Order
      </a>
    </nav>
  `;
}

function openMobileDrawer() {
  const drawer = document.getElementById('mobile-drawer');
  const overlay = document.getElementById('drawer-overlay');
  const toggle = document.getElementById('mobile-menu-toggle');
  if (drawer) drawer.classList.add('open');
  if (overlay) overlay.classList.add('open');
  document.body.classList.add('drawer-is-open');
  document.body.style.overflow = 'hidden';
  if (toggle) toggle.setAttribute('aria-expanded', 'true');
}

function closeMobileDrawer() {
  const drawer = document.getElementById('mobile-drawer');
  const overlay = document.getElementById('drawer-overlay');
  const toggle = document.getElementById('mobile-menu-toggle');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  document.body.classList.remove('drawer-is-open');
  document.body.style.overflow = '';
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
}

function toggleDrawerCat(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const panel = document.getElementById('drawer-cat-panel');
  const catTrigger = document.getElementById('drawer-cat-trigger');
  if (!panel || !catTrigger) return;
  const isOpen = panel.classList.toggle('is-open');
  catTrigger.classList.toggle('is-open', isOpen);
  catTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

window.openMobileDrawer = openMobileDrawer;
window.closeMobileDrawer = closeMobileDrawer;
window.toggleDrawerCat = toggleDrawerCat;

function initNavigation() {
  ensureSiteChrome();
  ensureStandardMobileDrawer();

  // Direct bind on toggle button if present
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  if (toggleBtn && !toggleBtn.dataset.bound) {
    toggleBtn.dataset.bound = '1';
    const onToggle = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      openMobileDrawer();
    };
    toggleBtn.addEventListener('click', onToggle);
    toggleBtn.addEventListener('touchend', onToggle);
  }

  // Re-render drawer types if metadata arrives later
  document.addEventListener('aarif:metadata-ready', () => {
    ensureStandardMobileDrawer();
  });

  // Browse-all dropdown for desktop
  const btn = document.getElementById('subnav-types-btn');
  const dropdown = document.getElementById('subnav-types-dropdown');
  if (btn && dropdown && !btn.dataset.navBound) {
    btn.dataset.navBound = '1';
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const open = dropdown.classList.toggle('open');
      btn.setAttribute('aria-expanded', open);
      if (open) buildBrowseDropdown(dropdown);
    });
    document.addEventListener('click', () => { dropdown.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); });
    dropdown.addEventListener('click', e => e.stopPropagation());
  }
}

// Global delegated listeners supporting both click & touch
['click', 'touchend'].forEach(evtType => {
  document.addEventListener(evtType, e => {
    // Mobile menu toggle clicked / tapped
    const toggle = e.target.closest('#mobile-menu-toggle, .mobile-menu-toggle');
    if (toggle) {
      e.preventDefault();
      e.stopPropagation();
      openMobileDrawer();
      return;
    }

    // Drawer close button or overlay clicked
    if (e.target.closest('#drawer-close, .drawer-close') || e.target.id === 'drawer-overlay') {
      e.preventDefault();
      closeMobileDrawer();
      return;
    }

    // Accordion Category header toggled
    const catTrigger = e.target.closest('#drawer-cat-trigger');
    if (catTrigger) {
      toggleDrawerCat(e);
      return;
    }

    // Nav link clicked inside drawer -> close drawer
    if (e.target.closest('.drawer-nav a')) {
      closeMobileDrawer();
    }
  }, { passive: false });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeMobileDrawer();
});

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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNavigation);
} else {
  initNavigation();
}
