'use strict';
/* Apply site settings from API to DOM elements */
function applySiteSettings(s) {
  if (!s) return;
  document.querySelectorAll('.site-store-name').forEach(el => { if (s.store_name) el.textContent = s.store_name; });
  document.querySelectorAll('.site-store-tagline').forEach(el => { if (s.store_tagline) el.textContent = s.store_tagline; });
  document.querySelectorAll('.site-store-phone').forEach(el => { if (s.store_phone) { el.textContent = s.store_phone; el.href = 'tel:' + s.store_phone.replace(/\s/g,''); } });
  document.querySelectorAll('.site-footer-address').forEach(el => { if (s.store_address) el.textContent = s.store_address + (s.store_city ? ', ' + s.store_city : ''); });
  document.querySelectorAll('.site-footer-desc').forEach(el => { if (s.footer_desc) el.textContent = s.footer_desc; });
  document.querySelectorAll('.site-whatsapp-link').forEach(el => { if (s.whatsapp_number) el.href = 'https://wa.me/' + s.whatsapp_number; });
  const about = document.getElementById('site-home-about-teaser');
  if (about && s.home_about_teaser) {
    about.innerHTML = '<p>' + s.home_about_teaser + '</p>' + (s.home_about_teaser_extra ? '<p>' + s.home_about_teaser_extra + '</p>' : '');
  }

  // Homepage Highlight Stats
  if (s.home_stat_1_val != null) { const el = document.getElementById('teaser-stat-1-val'); if (el) el.textContent = s.home_stat_1_val; }
  if (s.home_stat_1_lbl != null) { const el = document.getElementById('teaser-stat-1-lbl'); if (el) el.textContent = s.home_stat_1_lbl; }
  if (s.home_stat_2_val != null) { const el = document.getElementById('teaser-stat-2-val'); if (el) el.textContent = s.home_stat_2_val; }
  if (s.home_stat_2_lbl != null) { const el = document.getElementById('teaser-stat-2-lbl'); if (el) el.textContent = s.home_stat_2_lbl; }
  if (s.home_stat_3_val != null) { const el = document.getElementById('teaser-stat-3-val'); if (el) el.textContent = s.home_stat_3_val; }
  if (s.home_stat_3_lbl != null) { const el = document.getElementById('teaser-stat-3-lbl'); if (el) el.textContent = s.home_stat_3_lbl; }
  if (s.home_stat_4_val != null) { const el = document.getElementById('teaser-stat-4-val'); if (el) el.textContent = s.home_stat_4_val; }
  if (s.home_stat_4_lbl != null) { const el = document.getElementById('teaser-stat-4-lbl'); if (el) el.textContent = s.home_stat_4_lbl; }
}
function getWhatsAppNumber() { return (SITE_SETTINGS && SITE_SETTINGS.whatsapp_number) ? SITE_SETTINGS.whatsapp_number : '919688498926'; }
