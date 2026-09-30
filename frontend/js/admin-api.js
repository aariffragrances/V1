'use strict';
const AdminAPI = {
  TOKEN_KEY: 'aarif_admin_token_v1',
  USER_KEY:  'aarif_admin_user_v1',
  get baseUrl() { return window.location.protocol === 'file:' ? '' : window.location.origin; },
  url(p) { return this.baseUrl + p; },
  getToken() { try { return sessionStorage.getItem(this.TOKEN_KEY); } catch(_){return null;} },
  getUser()  { try { const r=sessionStorage.getItem(this.USER_KEY); return r?JSON.parse(r):null; } catch(_){return null;} },
  setSession(t,u) { try { sessionStorage.setItem(this.TOKEN_KEY,t); sessionStorage.setItem(this.USER_KEY,JSON.stringify(u)); } catch(_){} },
  clearSession()  {
    try {
      sessionStorage.removeItem(this.TOKEN_KEY);
      sessionStorage.removeItem(this.USER_KEY);
      sessionStorage.removeItem('aarif_admin_stats');
      sessionStorage.removeItem('aarif_admin_types');
    } catch(_){}
  },

  _fallbackData: null,
  async _getBootstrap() {
    if (this._fallbackData) return this._fallbackData;
    try {
      const res = await fetch('data/bootstrap.json');
      if (res.ok) {
        this._fallbackData = await res.json();
        return this._fallbackData;
      }
    } catch (_) {}
    return null;
  },

  async _getFallback(path) {
    const bs = await this._getBootstrap();
    const perfumes = (bs && bs.perfumes) || [];
    const types = (bs && bs.fragranceTypes) || [];
    const banners = (bs && bs.banners) || [];
    const testimonials = (bs && bs.testimonials) || [];

    if (path.startsWith('/api/v1/auth/me')) {
      const cached = this.getUser();
      if (cached) return cached;
      return { id: 'admin-fallback', email: 'admin@aarifragrances.local', role: 'admin', name: 'Admin' };
    }

    if (path.startsWith('/api/v1/admin/stats')) {
      return {
        total_perfumes: perfumes.length || 49,
        total_fragrance_types: types.length || 8,
        featured_count: perfumes.filter(p => p.isFeatured).length || 7,
        best_seller_count: perfumes.filter(p => p.isBestSeller).length || 6,
        low_stock_count: perfumes.filter(p => Number(p.stockQuantity ?? 50) <= 10).length || 0,
        new_orders_count: 0,
      };
    }

    if (path.startsWith('/api/v1/admin/fragrance-types')) {
      return types.map(t => ({
        type_id: t.type_id,
        type_name: t.type_name,
        description: t.description || '',
        slug: t.slug || '',
        icon_image_url: t.icon_image_url || null,
        is_active: true,
        display_order: t.display_order || 0,
        item_count: t.product_count || 0
      }));
    }

    if (path.startsWith('/api/v1/admin/low-stock')) {
      const low = perfumes.filter(p => Number(p.stockQuantity ?? 50) <= 10);
      return {
        threshold: 10,
        count: low.length,
        items: low.map(p => ({
          perfumeId: p.perfumeId,
          perfumeName: p.perfumeName,
          stockQuantity: p.stockQuantity ?? 0,
          fragranceTypeId: p.fragranceTypeId
        }))
      };
    }

    if (path.startsWith('/api/v1/admin/perfumes/next-id')) {
      let maxNum = 0;
      perfumes.forEach(p => {
        const m = String(p.perfumeId || p.perfume_id || '').match(/\d+/);
        if (m) {
          const n = parseInt(m[0], 10);
          if (n > maxNum) maxNum = n;
        }
      });
      const nextNum = Math.max(maxNum, 52) + 1;
      return { next_id: `PF${String(nextNum).padStart(3, '0')}` };
    }

    const singlePerfumeMatch = path.match(/^\/api\/v1\/admin\/perfumes\/([^/?#]+)/);
    if (singlePerfumeMatch) {
      const pid = decodeURIComponent(singlePerfumeMatch[1]);
      const found = perfumes.find(p => (p.perfumeId || p.perfume_id) === pid);
      if (found) return found;
    }

    if (path.startsWith('/api/v1/admin/perfumes')) {
      try {
        const url = new URL(path, 'http://dummy.local');
        const search = (url.searchParams.get('search') || '').toLowerCase().trim();
        const ftype = url.searchParams.get('fragrance_type_id') || '';
        let list = perfumes;
        if (ftype) list = list.filter(p => p.fragranceTypeId === ftype);
        if (search) list = list.filter(p => (p.perfumeName || '').toLowerCase().includes(search) || (p.brand || '').toLowerCase().includes(search));
        return {
          items: list,
          total_count: list.length,
          total_pages: 1,
          current_page: 1,
          per_page: 500
        };
      } catch (_) {
        return { items: perfumes, total_count: perfumes.length, total_pages: 1, current_page: 1, per_page: 500 };
      }
    }

    if (path.startsWith('/api/v1/admin/banners')) return banners;
    if (path.startsWith('/api/v1/admin/testimonials')) return testimonials;
    if (path.startsWith('/api/v1/admin/spotlight')) {
      const feat = perfumes.filter(p => p.isFeatured || p.is_featured);
      const best = perfumes.filter(p => p.isBestSeller || p.is_best_seller);
      const nw = perfumes.filter(p => p.isNewArrival || p.is_new_arrival);
      const featTest = testimonials.filter(t => t.isFeatured || t.is_featured);
      const fmt = (p) => ({
        perfumeId: p.perfumeId || p.perfume_id,
        productId: p.perfumeId || p.perfume_id,
        perfumeName: p.perfumeName || p.name,
        productName: p.perfumeName || p.name,
        categoryName: p.categoryName || p.fragranceTypeId || '',
        primaryImageUrl: p.primaryImageUrl || p.primary_image_url || '/images/products/placeholder.webp',
        price: p.price_30ml || p.price || 0,
        stock: p.stockQuantity ?? 50,
        isFeatured: !!(p.isFeatured || p.is_featured),
        isBestSeller: !!(p.isBestSeller || p.is_best_seller),
        isNewArrival: !!(p.isNewArrival || p.is_new_arrival),
        isActive: p.isActive !== false
      });
      return {
        counts: {
          featured: feat.length,
          bestSellers: best.length,
          newArrivals: nw.length,
          testimonials: featTest.length
        },
        sections: {
          featured: feat.map(fmt),
          bestSellers: best.map(fmt),
          newArrivals: nw.map(fmt)
        },
        testimonials: featTest.map(t => ({
          id: t.id,
          customerName: t.customerName || t.customer_name,
          customerInitial: (t.customerName || t.customer_name || '?')[0],
          rating: t.rating || 5,
          quote: t.reviewText || t.quote || '',
          isFeatured: true
        }))
      };
    }
    return null;
  },

  async request(path, opts={}) {
    const headers = {...(opts.headers||{})};
    if (!(opts.body instanceof FormData)) headers['Content-Type']=headers['Content-Type']||'application/json';
    const token = this.getToken();
    if (token) headers['Authorization']='Bearer '+token;

    const controller = new AbortController();
    const timeoutMs = (opts.body instanceof FormData) ? 90000 : 30000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(this.url(path), {
        ...opts,
        headers,
        signal: opts.signal || controller.signal,
      });
      clearTimeout(timer);
      let data = null;
      const txt = await res.text();
      if (txt) { try { data = JSON.parse(txt); } catch(_) { data = txt; } }
      if (!res.ok) {
        const e = new Error((data && data.detail) || res.statusText || 'Request failed');
        e.status = res.status;
        throw e;
      }
      return data;
    } catch (err) {
      clearTimeout(timer);
      const isGet = !opts.method || opts.method.toUpperCase() === 'GET';
      if (isGet) {
        try {
          const fallback = await this._getFallback(path);
          if (fallback !== null) return fallback;
        } catch (_) {}
      }
      if (err.name === 'AbortError') {
        throw new Error('Request timed out. Please verify your connection.');
      }
      throw err;
    }
  },

  login(login,password){ return this.request('/api/v1/auth/login',{method:'POST',body:JSON.stringify({login,password})}); },
  me()           { return this.request('/api/v1/auth/me'); },
  logout()       { const t=this.getToken();if(t)return this.request('/api/v1/auth/logout',{method:'POST'}).catch(()=>{});return Promise.resolve(); },
  stats()        { return this.request('/api/v1/admin/stats'); },

  // Fragrance types
  fragranceTypes() { return this.request('/api/v1/admin/fragrance-types'); },
  createFragranceType(b)    { return this.request('/api/v1/admin/fragrance-types',{method:'POST',body:JSON.stringify(b)}); },
  updateFragranceType(id,b) { return this.request(`/api/v1/admin/fragrance-types/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(b)}); },
  deleteFragranceType(id)   { return this.request(`/api/v1/admin/fragrance-types/${encodeURIComponent(id)}`,{method:'DELETE'}); },

  // Perfumes
  perfumes(p={}) { const q=new URLSearchParams(p).toString(); return this.request('/api/v1/admin/perfumes'+(q?'?'+q:'')); },
  getPerfume(id) { return this.request(`/api/v1/admin/perfumes/${encodeURIComponent(id)}`); },
  nextPerfumeId() { return this.request('/api/v1/admin/perfumes/next-id'); },
  createPerfume(b)    { return this.request('/api/v1/admin/perfumes',{method:'POST',body:JSON.stringify(b)}); },
  updatePerfume(id,b) { return this.request(`/api/v1/admin/perfumes/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(b)}); },
  deletePerfume(id)   { return this.request(`/api/v1/admin/perfumes/${encodeURIComponent(id)}`,{method:'DELETE'}); },
  uploadPerfumeImage(id,files){ const fd=new FormData();files.forEach(f=>fd.append('files',f));return this.request(`/api/v1/admin/perfumes/${encodeURIComponent(id)}/images/upload`,{method:'POST',body:fd}); },
  deletePerfumeImage(perfumeId,imageId){ return this.request(`/api/v1/admin/perfumes/${encodeURIComponent(perfumeId)}/images/${imageId}`,{method:'DELETE'}); },

  // Spotlight
  spotlight()    { return this.request('/api/v1/admin/spotlight'); },

  // Banners
  banners()      { return this.request('/api/v1/admin/banners'); },
  createBanner(b)    { return this.request('/api/v1/admin/banners',{method:'POST',body:JSON.stringify(b)}); },
  updateBanner(id,b) { return this.request(`/api/v1/admin/banners/${id}`,{method:'PUT',body:JSON.stringify(b)}); },
  deleteBanner(id)   { return this.request(`/api/v1/admin/banners/${id}`,{method:'DELETE'}); },
  moveBanner(id,direction){ return this.request(`/api/v1/admin/banners/${id}`,{method:'PUT',body:JSON.stringify({direction})}); },
  uploadBannerImage(file){ const fd=new FormData();fd.append('file',file);return this.request('/api/v1/admin/banners/upload',{method:'POST',body:fd}); },

  // Testimonials
  testimonials()      { return this.request('/api/v1/admin/testimonials'); },
  createTestimonial(b)    { return this.request('/api/v1/admin/testimonials',{method:'POST',body:JSON.stringify(b)}); },
  updateTestimonial(id,b) { return this.request(`/api/v1/admin/testimonials/${id}`,{method:'PUT',body:JSON.stringify(b)}); },
  deleteTestimonial(id)   { return this.request(`/api/v1/admin/testimonials/${id}`,{method:'DELETE'}); },

  // Settings
  settings()     { return this.request('/api/v1/admin/settings'); },
  saveSettings(b){ return this.request('/api/v1/admin/settings',{method:'PUT',body:JSON.stringify(b)}); },

  // Contact submissions
  contactSubmissions(){ return this.request('/api/v1/admin/contact-submissions'); },
  markContactRead(id){ return this.request(`/api/v1/admin/contact-submissions/${id}/read`,{method:'PUT'}); },
  deleteContactSubmission(id){ return this.request(`/api/v1/admin/contact-submissions/${id}`,{method:'DELETE'}); },

  // Orders
  orders(p={}){ const q=new URLSearchParams(p).toString(); return this.request('/api/v1/admin/orders'+(q?'?'+q:'')); },
  getOrder(id){ return this.request(`/api/v1/admin/orders/${id}`); },
  updateOrder(id,b){ return this.request(`/api/v1/admin/orders/${id}`,{method:'PUT',body:JSON.stringify(b)}); },
  deleteOrder(id){ return this.request(`/api/v1/admin/orders/${id}`,{method:'DELETE'}); },

  // Coupons
  coupons() { return this.request('/api/v1/admin/coupons'); },
  saveCoupons(b) { return this.request('/api/v1/admin/coupons', { method: 'PUT', body: JSON.stringify(b) }); },

  // Stock / bulk
  lowStock(threshold=10){ return this.request('/api/v1/admin/low-stock?threshold='+threshold); },
  bulkPrices(b){ return this.request('/api/v1/admin/perfumes/bulk-prices',{method:'POST',body:JSON.stringify(b)}); },
  saveSheetPrices(updates){ return this.request('/api/v1/admin/perfumes/sheet-save',{method:'POST',body:JSON.stringify({updates})}); },
};
