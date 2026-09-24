'use strict';
/* ============================================================
   home-sections.js — Hero slider + fragrance type banner cards
   ============================================================ */

// ── Fragrance type icons ──────────────────────────────────────
const TYPE_ICONS = {
  'FT001': 'fa-wind',
  'FT002': 'fa-apple-whole',
  'FT003': 'fa-fire',
  'FT004': 'fa-gem',
  'FT005': 'fa-spa',
  'FT006': 'fa-tree',
  'FT007': 'fa-cookie-bite',
  'FT008': 'fa-scroll',
};

// Gradient backgrounds for each type (shown when no image uploaded)
const TYPE_GRADIENTS = {
  'FT001': 'linear-gradient(135deg,#001a22 0%,#003d4d 100%)',  // aquatic
  'FT002': 'linear-gradient(135deg,#2a1000 0%,#6d2e00 100%)',  // fruity
  'FT003': 'linear-gradient(135deg,#1a0500 0%,#5c1a00 100%)',  // spicy
  'FT004': 'linear-gradient(135deg,#0a0500 0%,#3d2200 100%)',  // oud gold-black
  'FT005': 'linear-gradient(135deg,#1a0010 0%,#4a0030 100%)',  // floral
  'FT006': 'linear-gradient(135deg,#0d0a00 0%,#3d2a00 100%)',  // woody
  'FT007': 'linear-gradient(135deg,#1a0a00 0%,#5c3000 100%)',  // gourmand
  'FT008': 'linear-gradient(135deg,#000000 0%,#2a2200 100%)',  // heritage gold
};

// ── Render fragrance type cards (supermarket top-cat style) ───
function renderTypeCards(types) {
  const carousel = document.getElementById('types-carousel');
  if (!carousel) return;

  if (!types || !types.length) {
    carousel.innerHTML = Array.from({ length: 8 }, () => `
      <div class="top-cat-card top-cat-card--skeleton" aria-hidden="true">
        <div class="top-cat-card-image">
          <div class="skeleton" style="height:100%;min-height:88px;border-radius:8px;"></div>
        </div>
        <span class="top-cat-card-name"><span class="skeleton" style="display:block;height:12px;width:70%;margin:8px auto 0;"></span></span>
      </div>
    `).join('');
    return;
  }

  carousel.innerHTML = types.map(t => {
    const icon = TYPE_ICONS[t.type_id] || 'fa-spray-can-sparkles';
    const grad = TYPE_GRADIENTS[t.type_id] || 'linear-gradient(135deg,#1a1508,#3d2a00)';
    const imgUrl = t.icon_image_url || '';
    const href = `products.html?type=${encodeURIComponent(t.type_id)}`;
    const name = t.type_name || '';

    const imageInner = imgUrl
      ? `<img src="${escHtml(imgUrl)}${imgUrl.includes('?') ? '&' : '?'}v=5" alt="" class="top-cat-card-img" loading="lazy" decoding="async">`
      : `<div class="top-cat-card-image--fallback" style="background:${grad}">
           <i class="fa-solid ${icon} top-cat-card-fallback-icon" aria-hidden="true"></i>
         </div>`;

    return `
      <a href="${href}" class="top-cat-card" aria-label="${escHtml(name)}">
        <div class="top-cat-card-image">${imageInner}</div>
        <span class="top-cat-card-name">${escHtml(name)}</span>
      </a>`;
  }).join('');

  initTopCatCarousel();
}

function initTopCatCarousel() {
  const track = document.getElementById('types-carousel');
  const prev = document.getElementById('top-cat-prev');
  const next = document.getElementById('top-cat-next');
  if (!track || track.dataset.navBound) return;
  track.dataset.navBound = '1';

  const scrollAmount = () => Math.min(track.clientWidth * 0.75, 320);
  prev?.addEventListener('click', () => track.scrollBy({ left: -scrollAmount(), behavior: 'smooth' }));
  next?.addEventListener('click', () => track.scrollBy({ left: scrollAmount(), behavior: 'smooth' }));
}

// ── Hero slider ───────────────────────────────────────────────
function initHeroSlider() {
  const slider = document.getElementById('hero-slider');
  if (!slider) return;

  const slides = Array.from(slider.querySelectorAll('.hero-slide'));
  const dotsWrap = document.getElementById('hero-slider-dots');
  const prevBtn = document.getElementById('hero-slider-prev');
  const nextBtn = document.getElementById('hero-slider-next');
  if (!slides.length) return;

  let current = 0;
  let timer = null;

  // Build dots
  if (dotsWrap) {
    dotsWrap.innerHTML = slides.map((_, i) =>
      `<button type="button" class="hero-dot${i === 0 ? ' active' : ''}"
         role="tab" aria-selected="${i === 0}" aria-label="Slide ${i + 1}"></button>`
    ).join('');
  }

  function goTo(idx) {
    slides[current].classList.remove('active');
    if (dotsWrap) {
      dotsWrap.querySelectorAll('.hero-dot')[current]?.classList.remove('active');
      dotsWrap.querySelectorAll('.hero-dot')[current]?.setAttribute('aria-selected', 'false');
    }
    current = (idx + slides.length) % slides.length;
    slides[current].classList.add('active');
    if (dotsWrap) {
      dotsWrap.querySelectorAll('.hero-dot')[current]?.classList.add('active');
      dotsWrap.querySelectorAll('.hero-dot')[current]?.setAttribute('aria-selected', 'true');
    }
  }

  function startAuto() {
    timer = setInterval(() => goTo(current + 1), 5000);
  }
  function stopAuto() { clearInterval(timer); }

  prevBtn?.addEventListener('click', () => { stopAuto(); goTo(current - 1); startAuto(); });
  nextBtn?.addEventListener('click', () => { stopAuto(); goTo(current + 1); startAuto(); });

  dotsWrap?.addEventListener('click', e => {
    const dot = e.target.closest('.hero-dot');
    if (!dot) return;
    const idx = Array.from(dotsWrap.children).indexOf(dot);
    stopAuto(); goTo(idx); startAuto();
  });

  // Pause on hover
  slider.addEventListener('mouseenter', stopAuto);
  slider.addEventListener('mouseleave', startAuto);

  // Touch swipe gesture support for mobile
  let touchStartX = 0;
  let touchEndX = 0;

  slider.addEventListener('touchstart', e => {
    stopAuto();
    if (e.changedTouches && e.changedTouches[0]) {
      touchStartX = e.changedTouches[0].screenX;
    }
  }, { passive: true });

  slider.addEventListener('touchend', e => {
    if (e.changedTouches && e.changedTouches[0]) {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 35) {
        if (diff > 0) goTo(current + 1);
        else goTo(current - 1);
      }
    }
    startAuto();
  }, { passive: true });

  startAuto();
}

// ── Refresh hero with dynamic banner images from API ──────────
function refreshHeroSlider() {
  const banners = typeof getPromotionBanners === 'function' ? getPromotionBanners() : [];
  if (!banners || !banners.length) return;

  const slider = document.getElementById('hero-slider');
  if (!slider) return;

  // Replace fallback slides with real banner images
  const prev = document.getElementById('hero-slider-prev');
  const next = document.getElementById('hero-slider-next');
  const dots = document.getElementById('hero-slider-dots');

  // Remove old slides (keep buttons and dots)
  slider.querySelectorAll('.hero-slide').forEach(s => s.remove());

  banners.forEach((b, i) => {
    const div = document.createElement('div');
    const imgUrl = b.imageUrl || b.image_url || '';
    const title = b.title || '';
    const subtitle = b.subtitle || '';
    const link = b.linkUrl || b.link_url || 'products.html';
    // Full artwork banners — no text overlay
    const isArtBanner = /\/assets\/banners\//i.test(imgUrl) || (!subtitle && !!imgUrl);
    const hasCopy = !!(title || subtitle) && !isArtBanner;
    div.className = 'hero-slide' + (imgUrl ? ' hero-slide--image' : ' hero-slide--fallback') + (i === 0 ? ' active' : '');
    div.dataset.slide = i;
    div.innerHTML = `
      ${imgUrl ? `<img src="${escHtml(imgUrl)}"
           alt="${escHtml(title || 'Aarif Fragrances banner')}"
           class="hero-slide-img"
           loading="${i === 0 ? 'eager' : 'lazy'}"
           decoding="async"
           width="1776" height="602">` : ''}
      ${hasCopy ? `<div class="hero-content">
        ${title ? `<h2 class="hero-title">${escHtml(title)}</h2>` : ''}
        ${subtitle ? `<p class="hero-sub">${escHtml(subtitle)}</p>` : ''}
        <a href="${escHtml(link)}" class="hero-btn">
          <i class="fa-solid fa-spray-can-sparkles"></i> Shop Now
        </a>
      </div>` : `<a href="${escHtml(link)}" class="hero-slide-link" aria-label="${escHtml(title || 'Shop now')}"></a>`}`;
    slider.insertBefore(div, prev);
  });

  // Re-init slider
  initHeroSlider();
}

// ── Product strip helpers (featured / best sellers) ───────────
function renderProductStrip(gridId, products, maxItems) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  if (!products || !products.length) {
    grid.closest('.section')?.classList.add('hidden');
    stopAutoScrollStrip(grid);
    return;
  }
  grid.closest('.section')?.classList.remove('hidden');
  const items = products.slice(0, maxItems || 8);
  if (typeof buildProductCardHTML === 'function') {
    grid.innerHTML = items.map((p, i) => buildProductCardHTML(p, i)).join('');
    // Duplicate cards for a seamless GMS-style infinite loop
    if (items.length >= 2) {
      grid.insertAdjacentHTML(
        'beforeend',
        items.map((p, i) => buildProductCardHTML(p, i + items.length)).join('')
      );
      grid.dataset.loopCount = String(items.length);
    } else {
      delete grid.dataset.loopCount;
    }
    delete grid.dataset.fpBound;
    if (typeof bindProductCards === 'function') bindProductCards(grid);
  }
  initAutoScrollStrip(grid, { itemSelector: '.fp-card', intervalMs: 2800 });
}

function renderHomeProductStrips() {
  const featured    = typeof getFeaturedProducts    === 'function' ? getFeaturedProducts(12)    : [];
  const bestSellers = typeof getBestSellerProducts  === 'function' ? getBestSellerProducts(12)  : [];
  renderProductStrip('featured-grid',     featured,    12);
  renderProductStrip('best-sellers-grid', bestSellers, 12);
}

function stopAutoScrollStrip(el) {
  if (!el) return;
  if (el._autoScrollTimer) {
    clearInterval(el._autoScrollTimer);
    el._autoScrollTimer = null;
  }
  if (el._autoScrollObs) {
    el._autoScrollObs.disconnect();
    el._autoScrollObs = null;
  }
  delete el.dataset.autoScrollBound;
}

// ── Auto-scroll horizontal strips one card at a time (GMS-style) ─
function initAutoScrollStrip(el, opts) {
  if (!el) return;
  stopAutoScrollStrip(el);

  const itemSelector = (opts && opts.itemSelector) || '.fp-card';
  const intervalMs = (opts && opts.intervalMs) || 2800;
  el.dataset.autoScrollBound = '1';

  let paused = false;
  let inView = true;
  let index = 0;

  const pause = () => { paused = true; };
  const resume = () => { paused = false; };
  el.addEventListener('mouseenter', pause);
  el.addEventListener('mouseleave', resume);
  el.addEventListener('focusin', pause);
  el.addEventListener('focusout', resume);
  el.addEventListener('touchstart', pause, { passive: true });
  el.addEventListener('touchend', resume, { passive: true });
  el.addEventListener('wheel', pause, { passive: true });

  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      inView = entries.some((e) => e.isIntersecting && e.intersectionRatio > 0.2);
    }, { threshold: [0, 0.2, 0.5] });
    obs.observe(el);
    el._autoScrollObs = obs;
  }

  const stepSize = () => {
    const item = el.querySelector(itemSelector);
    if (!item) return 0;
    const styles = getComputedStyle(el);
    const gap = parseFloat(styles.columnGap || styles.gap) || 20;
    return Math.round(item.getBoundingClientRect().width + gap);
  };

  const tick = () => {
    if (paused || document.hidden || !inView) return;
    const cards = el.querySelectorAll(itemSelector);
    if (cards.length < 2) return;
    const step = stepSize();
    if (step <= 0) return;

    const loopCount = parseInt(el.dataset.loopCount || '0', 10);
    const maxIndex = loopCount > 0
      ? loopCount
      : Math.max(1, Math.ceil((el.scrollWidth - el.clientWidth) / step));

    index += 1;

    // Seamless loop for duplicated product strips
    if (loopCount > 0 && index >= loopCount) {
      el.style.scrollBehavior = 'auto';
      el.scrollLeft = 0;
      void el.offsetWidth;
      el.style.scrollBehavior = '';
      index = 1;
      el.scrollTo({ left: step, behavior: 'smooth' });
      return;
    }

    // Non-loop strips (e.g. testimonials): wrap to start
    if (loopCount <= 0 && index > maxIndex) {
      index = 0;
      el.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }

    el.scrollTo({ left: index * step, behavior: 'smooth' });
  };

  el._autoScrollTimer = setInterval(tick, intervalMs);
}

// ── Testimonials ──────────────────────────────────────────────
function renderTestimonials() {
  const wrap = document.getElementById('testimonials-carousel');
  if (!wrap) return;
  fetch('/api/v1/testimonials')
    .then(r => r.ok ? r.json() : [])
    .then(list => {
      if (!list.length) { wrap.closest('.section')?.classList.add('hidden'); return; }
      wrap.innerHTML = list.map(t => `
        <div class="testimonial-card">
          <div class="testimonial-avatar">${escHtml(t.initials || '?')}</div>
          <div class="testimonial-name">${escHtml(t.name)}</div>
          <div class="testimonial-stars">${'★'.repeat(t.rating || 5)}</div>
          <p class="testimonial-text">"${escHtml(t.text)}"</p>
        </div>`).join('');
      initAutoScrollStrip(wrap, { itemSelector: '.testimonial-card', intervalMs: 3800 });
    })
    .catch(() => wrap.closest('.section')?.classList.add('hidden'));
}

// ── Footer type list ──────────────────────────────────────────
function renderFooterTypes() {
  const wrap = document.getElementById('footer-types-list');
  if (!wrap || typeof FRAGRANCE_TYPES === 'undefined') return;
  wrap.innerHTML = FRAGRANCE_TYPES.slice(0, 7).map(t =>
    `<a href="products.html?type=${encodeURIComponent(t.type_id)}">${escHtml(t.type_name)}</a>`
  ).join('');
}

// ── Stats teaser ──────────────────────────────────────────────
function renderTeaserStats() {
  const total = document.getElementById('teaser-products');
  const types = document.getElementById('teaser-types');
  if (total && typeof ALL_PERFUMES !== 'undefined') total.textContent = ALL_PERFUMES.length + '+';
  if (types  && typeof FRAGRANCE_TYPES !== 'undefined') types.textContent = FRAGRANCE_TYPES.length;
}

// ── Escape helper ─────────────────────────────────────────────
function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
