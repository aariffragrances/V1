'use strict';
/* Live search dropdown */
function initSearch() {
  const input    = document.getElementById('header-search');
  const dropdown = document.getElementById('search-dropdown');
  const clearBtn = document.getElementById('search-clear');
  if (!input || !dropdown) return;

  let debounceTimer;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    clearBtn && (clearBtn.style.display = q ? 'block' : 'none');
    if (!q) { dropdown.hidden = true; return; }
    debounceTimer = setTimeout(() => showSuggestions(q), 180);
  });

  clearBtn?.addEventListener('click', () => {
    input.value = '';
    clearBtn.style.display = 'none';
    dropdown.hidden = true;
    input.focus();
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.hidden = true;
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      if (q) { window.location.href = `products.html?search=${encodeURIComponent(q)}`; }
    }
  });

  function showSuggestions(q) {
    if (typeof ALL_PERFUMES === 'undefined' || !ALL_PERFUMES.length) {
      whenCatalogReady().then(() => showSuggestions(q)).catch(() => {});
      return;
    }
    const lower = q.toLowerCase();
    const results = ALL_PERFUMES
      .filter(p => (p.displayName||p.perfumeName||'').toLowerCase().includes(lower) ||
                   (p.fragranceTypeName||'').toLowerCase().includes(lower))
      .slice(0, 8);

    if (!results.length) { dropdown.hidden = true; return; }
    dropdown.innerHTML = results.map(p => `
      <div class="search-result-item" role="option" data-name="${escS(p.perfumeName||p.productName)}"
           style="display:flex;align-items:center;gap:10px">
        <div style="width:34px;height:34px;background:#141414;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">
          <img src="${escS(typeof getProductImageUrl === 'function' ? getProductImageUrl(p) : 'assets/bottle-blue.png?v=1')}"
               alt="" style="width:34px;height:34px;object-fit:contain" loading="lazy"
               onerror="this.onerror=null;this.src='assets/bottle-blue.png?v=1'">
        </div>
        <div>
          <div style="font-size:13.5px;font-weight:600;color:#2d2d2d">${escS(p.displayName||p.perfumeName)}</div>
          <div style="font-size:11px;color:#888">${escS(p.fragranceTypeName||'')}</div>
        </div>
      </div>`).join('');

    dropdown.hidden = false;
    dropdown.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const name = item.dataset.name;
        const perfume = (typeof resolveStoredProductKey==='function') ? resolveStoredProductKey(name) : null;
        if (perfume && typeof openProductModal === 'function') {
          openProductModal(perfume);
          dropdown.hidden = true;
          input.value = '';
        } else {
          window.location.href = `products.html?search=${encodeURIComponent(name)}`;
        }
      });
    });
  }
}

function escS(s) { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
