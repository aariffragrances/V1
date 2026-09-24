'use strict';
const AdminAPI = {
  TOKEN_KEY: 'aarif_admin_token_v1',
  USER_KEY:  'aarif_admin_user_v1',
  get baseUrl() { return window.location.protocol === 'file:' ? '' : window.location.origin; },
  url(p) { return this.baseUrl + p; },
  getToken() { try { return sessionStorage.getItem(this.TOKEN_KEY); } catch(_){return null;} },
  getUser()  { try { const r=sessionStorage.getItem(this.USER_KEY); return r?JSON.parse(r):null; } catch(_){return null;} },
  setSession(t,u) { try { sessionStorage.setItem(this.TOKEN_KEY,t); sessionStorage.setItem(this.USER_KEY,JSON.stringify(u)); } catch(_){} },
  clearSession()  { try { sessionStorage.removeItem(this.TOKEN_KEY); sessionStorage.removeItem(this.USER_KEY); } catch(_){} },
  async request(path, opts={}) {
    const headers = {...(opts.headers||{})};
    if (!(opts.body instanceof FormData)) headers['Content-Type']=headers['Content-Type']||'application/json';
    const token = this.getToken();
    if (token) headers['Authorization']='Bearer '+token;
    const res = await fetch(this.url(path),{...opts,headers});
    let data=null; const txt=await res.text();
    if (txt) { try{data=JSON.parse(txt);}catch(_){data=txt;} }
    if (!res.ok){const e=new Error((data&&data.detail)||res.statusText);e.status=res.status;throw e;}
    return data;
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
  createPerfume(b)    { return this.request('/api/v1/admin/perfumes',{method:'POST',body:JSON.stringify(b)}); },
  updatePerfume(id,b) { return this.request(`/api/v1/admin/perfumes/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(b)}); },
  deletePerfume(id)   { return this.request(`/api/v1/admin/perfumes/${encodeURIComponent(id)}`,{method:'DELETE'}); },
  uploadPerfumeImage(id,files){ const fd=new FormData();files.forEach(f=>fd.append('files',f));return this.request(`/api/v1/admin/perfumes/${encodeURIComponent(id)}/images/upload`,{method:'POST',body:fd}); },
  deletePerfumeImage(perfumeId,imageId){ return this.request(`/api/v1/admin/perfumes/${encodeURIComponent(perfumeId)}/images/${imageId}`,{method:'DELETE'}); },

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

  // Stock / bulk
  lowStock(threshold=10){ return this.request('/api/v1/admin/low-stock?threshold='+threshold); },
  bulkPrices(b){ return this.request('/api/v1/admin/perfumes/bulk-prices',{method:'POST',body:JSON.stringify(b)}); },
};
