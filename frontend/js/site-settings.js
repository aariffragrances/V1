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

  // 9. Homepage Highlight Stats
  if (s.home_stat_1_val != null) { const el = document.getElementById('teaser-stat-1-val'); if (el) el.textContent = s.home_stat_1_val; }
  if (s.home_stat_1_lbl != null) { const el = document.getElementById('teaser-stat-1-lbl'); if (el) el.textContent = s.home_stat_1_lbl; }
  if (s.home_stat_2_val != null) { const el = document.getElementById('teaser-stat-2-val'); if (el) el.textContent = s.home_stat_2_val; }
  if (s.home_stat_2_lbl != null) { const el = document.getElementById('teaser-stat-2-lbl'); if (el) el.textContent = s.home_stat_2_lbl; }
  if (s.home_stat_3_val != null) { const el = document.getElementById('teaser-stat-3-val'); if (el) el.textContent = s.home_stat_3_val; }
  if (s.home_stat_3_lbl != null) { const el = document.getElementById('teaser-stat-3-lbl'); if (el) el.textContent = s.home_stat_3_lbl; }
  if (s.home_stat_4_val != null) { const el = document.getElementById('teaser-stat-4-val'); if (el) el.textContent = s.home_stat_4_val; }
  if (s.home_stat_4_lbl != null) { const el = document.getElementById('teaser-stat-4-lbl'); if (el) el.textContent = s.home_stat_4_lbl; }

  // 10. About Us Text (About Page)
  const aboutBody = document.getElementById('about-us-text');
  if (aboutBody && s.about_us_text) {
    const paras = s.about_us_text.split(/\n\s*\n/).filter(Boolean);
    if (paras.length) {
      aboutBody.innerHTML = paras.map(p => `<p>${escHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
    }
  }

  // 11. Social Links (Facebook & Instagram)
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

function getWhatsAppNumber() {
  return (typeof SITE_SETTINGS !== 'undefined' && SITE_SETTINGS && SITE_SETTINGS.whatsapp_number)
    ? SITE_SETTINGS.whatsapp_number
    : '919688498926';
}

async function refreshSiteSettingsFromServer() {
  try {
    const res = await fetch('/api/v1/catalog/metadata');
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
