'use strict';
/* ============================================================
   site-settings.js — Dynamic Store Settings Hydration
   Applies contact info, stats, teasers, and social links to DOM
   ============================================================ */

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function applySiteSettings(s) {
  if (!s || typeof s !== 'object') return;
  window.SITE_SETTINGS = s;

  // 1. Store Name & Tagline
  if (s.store_name) {
    document.querySelectorAll('.site-store-name').forEach(el => { el.textContent = s.store_name; });
    document.querySelectorAll('.logo-brand-name').forEach(el => { el.textContent = s.store_name.toUpperCase(); });
  }
  if (s.store_tagline) {
    document.querySelectorAll('.site-store-tagline').forEach(el => { el.textContent = s.store_tagline; });
    document.querySelectorAll('.logo-brand-tag').forEach(el => { el.textContent = s.store_tagline; });
  }

  // 2. Phone
  if (s.store_phone) {
    const rawPhone = s.store_phone.replace(/[^\d+]/g, '');
    document.querySelectorAll('.site-store-phone, a[href^="tel:"]').forEach(el => {
      el.textContent = s.store_phone;
      if (el.tagName === 'A' || el.hasAttribute('href')) el.href = 'tel:' + rawPhone;
    });
    document.querySelectorAll('.site-store-phone-link').forEach(el => {
      el.href = 'tel:' + rawPhone;
    });
  }

  // 3. WhatsApp Number
  if (s.whatsapp_number) {
    const cleanWa = s.whatsapp_number.replace(/[^\d]/g, '');
    document.querySelectorAll('.site-whatsapp-link, .contact-wa-btn, a[href*="wa.me"]').forEach(el => {
      el.href = 'https://wa.me/' + cleanWa;
    });
  }

  // 4. Contact Email
  if (s.contact_email) {
    document.querySelectorAll('.site-contact-email, a[href^="mailto:"]').forEach(el => {
      el.textContent = s.contact_email;
      if (el.tagName === 'A' || el.hasAttribute('href')) el.href = 'mailto:' + s.contact_email;
    });
    document.querySelectorAll('.site-contact-email-link').forEach(el => {
      el.href = 'mailto:' + s.contact_email;
    });
  }

  // 5. Address & City
  if (s.store_address || s.store_city) {
    const address = s.store_address || '';
    const city = s.store_city || '';
    const fullAddress = (city && !address.toLowerCase().includes(city.toLowerCase()))
      ? (address ? `${address}, ${city}` : city)
      : (address || city);
    document.querySelectorAll('.site-footer-address, .site-store-address').forEach(el => {
      el.textContent = fullAddress;
    });
  }
  updateOrderStoreAddress(s);

  // 6. Opening Hours
  if (s.opening_hours && s.opening_hours.trim()) {
    document.querySelectorAll('.site-opening-hours').forEach(el => {
      el.textContent = s.opening_hours;
    });
    document.querySelectorAll('.site-opening-hours-item, .site-opening-hours-row').forEach(el => {
      el.style.display = '';
    });
  } else {
    document.querySelectorAll('.site-opening-hours-item, .site-opening-hours-row').forEach(el => {
      el.style.display = 'none';
    });
  }

  // 7. Footer Description
  if (s.footer_desc) {
    document.querySelectorAll('.site-footer-desc').forEach(el => {
      el.textContent = s.footer_desc;
    });
  }

  // 8. Home About Teaser
  const aboutTeaser = document.getElementById('site-home-about-teaser');
  if (aboutTeaser && s.home_about_teaser) {
    const paras = s.home_about_teaser.split(/\n\s*\n/).filter(Boolean);
    aboutTeaser.innerHTML = paras.map(p => `<p>${escHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
  }

  // 9. Containers (Featured & Best Sellers Titles/Subtitles)
  if (s.container_featured_title) {
    document.querySelectorAll('.site-container-featured-title, #featured .top-cat-header-text h2').forEach(el => {
      el.textContent = s.container_featured_title;
    });
  }
  if (s.container_featured_subtitle) {
    document.querySelectorAll('.site-container-featured-subtitle, #featured .top-cat-header-text .section-subtitle').forEach(el => {
      el.textContent = s.container_featured_subtitle;
    });
  }
  if (s.container_bestsellers_title) {
    document.querySelectorAll('.site-container-bestsellers-title, #best-sellers .top-cat-header-text h2').forEach(el => {
      el.textContent = s.container_bestsellers_title;
    });
  }
  if (s.container_bestsellers_subtitle) {
    document.querySelectorAll('.site-container-bestsellers-subtitle, #best-sellers .top-cat-header-text .section-subtitle').forEach(el => {
      el.textContent = s.container_bestsellers_subtitle;
    });
  }

  // 10. How to Order Section (Titles & Subtitles)
  if (s.order_section_title) {
    document.querySelectorAll('.site-order-section-title, .how-to-order-section .section-header h2').forEach(el => {
      el.textContent = s.order_section_title;
    });
  }
  if (s.order_section_subtitle) {
    document.querySelectorAll('.site-order-section-subtitle, .how-to-order-section .section-header .section-subtitle').forEach(el => {
      el.textContent = s.order_section_subtitle;
    });
  }
  if (s.order_step_1_title) {
    document.querySelectorAll('.site-order-step-1-title, .order-steps .order-step:nth-child(1) h3').forEach(el => {
      el.textContent = s.order_step_1_title;
    });
  }
  if (s.order_step_1_subtitle) {
    document.querySelectorAll('.site-order-step-1-subtitle, .order-steps .order-step:nth-child(1) p').forEach(el => {
      el.textContent = s.order_step_1_subtitle;
    });
  }
  if (s.order_step_2_title) {
    document.querySelectorAll('.site-order-step-2-title, .order-steps .order-step:nth-child(2) h3').forEach(el => {
      el.textContent = s.order_step_2_title;
    });
  }
  if (s.order_step_2_subtitle) {
    document.querySelectorAll('.site-order-step-2-subtitle, .order-steps .order-step:nth-child(2) p').forEach(el => {
      el.textContent = s.order_step_2_subtitle;
    });
  }
  if (s.order_step_3_title) {
    document.querySelectorAll('.site-order-step-3-title, .order-steps .order-step:nth-child(3) h3').forEach(el => {
      el.textContent = s.order_step_3_title;
    });
  }
  if (s.order_step_3_subtitle) {
    document.querySelectorAll('.site-order-step-3-subtitle, .order-steps .order-step:nth-child(3) p').forEach(el => {
      el.textContent = s.order_step_3_subtitle;
    });
  }
  if (s.order_step_4_title) {
    document.querySelectorAll('.site-order-step-4-title, .order-steps .order-step:nth-child(4) h3').forEach(el => {
      el.textContent = s.order_step_4_title;
    });
  }
  if (s.order_step_4_subtitle) {
    document.querySelectorAll('.site-order-step-4-subtitle, .order-steps .order-step:nth-child(4) p').forEach(el => {
      el.textContent = s.order_step_4_subtitle;
    });
  }

  // 11. Homepage Highlight Stats
  if (s.home_stat_1_val != null) { const el = document.getElementById('teaser-stat-1-val'); if (el) el.textContent = s.home_stat_1_val; }
  if (s.home_stat_1_lbl != null) { const el = document.getElementById('teaser-stat-1-lbl'); if (el) el.textContent = s.home_stat_1_lbl; }
  if (s.home_stat_2_val != null) { const el = document.getElementById('teaser-stat-2-val'); if (el) el.textContent = s.home_stat_2_val; }
  if (s.home_stat_2_lbl != null) { const el = document.getElementById('teaser-stat-2-lbl'); if (el) el.textContent = s.home_stat_2_lbl; }
  if (s.home_stat_3_val != null) { const el = document.getElementById('teaser-stat-3-val'); if (el) el.textContent = s.home_stat_3_val; }
  if (s.home_stat_3_lbl != null) { const el = document.getElementById('teaser-stat-3-lbl'); if (el) el.textContent = s.home_stat_3_lbl; }
  if (s.home_stat_4_val != null) { const el = document.getElementById('teaser-stat-4-val'); if (el) el.textContent = s.home_stat_4_val; }
  if (s.home_stat_4_lbl != null) { const el = document.getElementById('teaser-stat-4-lbl'); if (el) el.textContent = s.home_stat_4_lbl; }

  // 12. About Us Text (About Page)
  const aboutBody = document.getElementById('about-us-text');
  if (aboutBody && s.about_us_text) {
    const paras = s.about_us_text.split(/\n\s*\n/).filter(Boolean);
    if (paras.length) {
      aboutBody.innerHTML = paras.map(p => `<p>${escHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
    }
  }

  // 13. Social Links (Facebook & Instagram)
  document.querySelectorAll('.site-social-fb').forEach(el => {
    if (s.social_facebook && s.social_facebook.trim()) {
      el.href = s.social_facebook.trim();
      el.style.display = 'inline-flex';
    } else {
      el.style.display = 'none';
    }
  });
  document.querySelectorAll('.site-social-ig').forEach(el => {
    if (s.social_instagram && s.social_instagram.trim()) {
      el.href = s.social_instagram.trim();
      el.style.display = 'inline-flex';
    } else {
      el.style.display = 'none';
    }
  });
}

function updateOrderStoreAddress(s) {
  const container = document.getElementById('order-store-address');
  if (!container || !s) return;

  const storeName = (s.store_name || 'Aarif Fragrances').trim();
  const rawAddress = (s.store_address != null ? String(s.store_address) : '').trim();
  const rawCity = (s.store_city != null ? String(s.store_city) : '').trim();

  let line1 = '';
  let line2 = '';

  if (rawAddress && rawCity) {
    line1 = rawAddress;
    line2 = rawCity;
  } else if (rawAddress) {
    if (rawAddress.includes('\n')) {
      const parts = rawAddress.split('\n').map(p => p.trim()).filter(Boolean);
      line1 = parts[0] || '';
      line2 = parts.slice(1).join(', ');
    } else {
      const match = rawAddress.match(/(.*?)(,\s*(?:Uthangudi|Madurai|Tamil Nadu).*)/i);
      if (match) {
        line1 = match[1].trim();
        line2 = match[2].replace(/^,\s*/, '').trim();
      } else {
        const parts = rawAddress.split(',').map(p => p.trim()).filter(Boolean);
        if (parts.length > 2) {
          const mid = Math.ceil(parts.length / 2);
          line1 = parts.slice(0, mid).join(', ');
          line2 = parts.slice(mid).join(', ');
        } else {
          line1 = rawAddress;
          line2 = '';
        }
      }
    }
  } else if (rawCity) {
    line1 = rawCity;
    line2 = '';
  } else {
    line1 = 'Main Road, Opp. Commando Fitness Center';
    line2 = 'Uthangudi, Madurai, Tamil Nadu – 625107';
  }

  const nameEl = container.querySelector('.order-store-name');
  if (nameEl) nameEl.textContent = storeName;

  const l1El = container.querySelector('.order-store-line1');
  if (l1El) {
    l1El.textContent = line1;
    l1El.style.display = line1 ? '' : 'none';
  }

  const l2El = container.querySelector('.order-store-line2');
  if (l2El) {
    l2El.textContent = line2;
    l2El.style.display = line2 ? '' : 'none';
  }
}

function getWhatsAppNumber() {
  return (typeof SITE_SETTINGS !== 'undefined' && SITE_SETTINGS && SITE_SETTINGS.whatsapp_number)
    ? SITE_SETTINGS.whatsapp_number
    : '919688498926';
}

async function refreshSiteSettingsFromServer() {
  try {
    const res = await fetch('/api/v1/catalog/metadata?t=' + Date.now(), { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.siteSettings) {
        applySiteSettings(data.siteSettings);
      }
    }
  } catch (_) {}
}

// 0ms instant hydration from LocalStorage cache
try {
  const cachedMeta = localStorage.getItem('aarif_meta_cache_v2');
  if (cachedMeta) {
    const parsed = JSON.parse(cachedMeta);
    if (parsed && parsed.siteSettings) {
      applySiteSettings(parsed.siteSettings);
    }
  }
} catch (_) {}

// Auto-bind event listeners for instant and reactive updates
document.addEventListener('aarif:metadata-ready', () => {
  if (typeof SITE_SETTINGS !== 'undefined') applySiteSettings(SITE_SETTINGS);
});
document.addEventListener('aarif:data-revalidated', () => {
  if (typeof SITE_SETTINGS !== 'undefined') applySiteSettings(SITE_SETTINGS);
});

// React immediately if admin saves settings in another tab/window
window.addEventListener('storage', (e) => {
  if (e.key === 'aarif_meta_cache_v2' || e.key === 'aarif_settings_sync') {
    refreshSiteSettingsFromServer();
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof SITE_SETTINGS !== 'undefined' && Object.keys(SITE_SETTINGS).length > 0) {
      applySiteSettings(SITE_SETTINGS);
    } else {
      refreshSiteSettingsFromServer();
    }
  });
} else {
  if (typeof SITE_SETTINGS !== 'undefined' && Object.keys(SITE_SETTINGS).length > 0) {
    applySiteSettings(SITE_SETTINGS);
  } else {
    refreshSiteSettingsFromServer();
  }
}

window.applySiteSettings = applySiteSettings;
window.refreshSiteSettings = refreshSiteSettingsFromServer;
window.getWhatsAppNumber = getWhatsAppNumber;
