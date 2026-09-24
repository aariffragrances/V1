'use strict';
/* Placeholder image rendering for perfume cards */
const PLACEHOLDER_COLORS = [
  {gradient:'linear-gradient(135deg,#1a0900,#4a2000)',icon:'fa-spray-can-sparkles'},
  {gradient:'linear-gradient(135deg,#004d66,#006680)',icon:'fa-wind'},
  {gradient:'linear-gradient(135deg,#4a0030,#800055)',icon:'fa-seedling'},
  {gradient:'linear-gradient(135deg,#0d2200,#2d5200)',icon:'fa-tree'},
  {gradient:'linear-gradient(135deg,#3d1a00,#7a3d00)',icon:'fa-candy-cane'},
  {gradient:'linear-gradient(135deg,#3d0000,#800000)',icon:'fa-fire'},
];

function getPerfumePlaceholder(perfume, idx) {
  const i = (typeof idx === 'number' ? idx : 0) % PLACEHOLDER_COLORS.length;
  return PLACEHOLDER_COLORS[i];
}

function renderProductImageArea(perfume, cls) {
  const url = perfume && perfume.primaryImageUrl;
  if (url) {
    return `<img src="${escStr(url)}" alt="${escStr(perfume.displayName||perfume.perfumeName||'')}" class="${cls}-img" loading="lazy" decoding="async">`;
  }
  const ph = getPerfumePlaceholder(perfume, 0);
  return `<div class="fp-placeholder" style="background:${ph.gradient}">
    <i class="fa-solid ${ph.icon}" style="font-size:40px;color:rgba(255,255,255,0.45)"></i>
  </div>`;
}

function escStr(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
