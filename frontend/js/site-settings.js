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
}
function getWhatsAppNumber() { return (SITE_SETTINGS && SITE_SETTINGS.whatsapp_number) ? SITE_SETTINGS.whatsapp_number : '919688498926'; }
