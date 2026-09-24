'use strict';
const CustomerAPI = {
  TOKEN_KEY: 'aarif_customer_token_v1',
  USER_KEY:  'aarif_customer_user_v1',
  get baseUrl() { return window.location.protocol === 'file:' ? '' : window.location.origin; },
  url(p) { return this.baseUrl + p; },
  getToken() { try { return sessionStorage.getItem(this.TOKEN_KEY); } catch(_){return null;} },
  getUser()  { try { const r=sessionStorage.getItem(this.USER_KEY); return r?JSON.parse(r):null; } catch(_){return null;} },
  setSession(token, user) { try { sessionStorage.setItem(this.TOKEN_KEY,token); sessionStorage.setItem(this.USER_KEY,JSON.stringify(user)); } catch(_){} },
  clearSession() { try { sessionStorage.removeItem(this.TOKEN_KEY); sessionStorage.removeItem(this.USER_KEY); } catch(_){} },
  isLoggedIn() { return !!(this.getToken()&&this.getUser()); },
  async request(path, opts={}) {
    const headers = { ...(opts.headers||{}) };
    if (!(opts.body instanceof FormData)) headers['Content-Type'] = headers['Content-Type']||'application/json';
    const token = this.getToken();
    if (token) headers['Authorization'] = 'Bearer '+token;
    const res = await fetch(this.url(path), {...opts, headers});
    let data = null;
    const txt = await res.text();
    if (txt) { try { data=JSON.parse(txt); } catch(_){ data=txt; } }
    if (!res.ok) { const e=new Error((data&&data.detail)||res.statusText||'Request failed'); e.status=res.status; throw e; }
    return data;
  },
  login(login, password) { return this.request('/api/v1/auth/login',{method:'POST',body:JSON.stringify({login,password})}); },
  register(payload)       { return this.request('/api/v1/auth/register',{method:'POST',body:JSON.stringify(payload)}); },
  me()                    { return this.request('/api/v1/auth/me'); },
  logout()                { const t=this.getToken(); if(t) return this.request('/api/v1/auth/logout',{method:'POST'}).catch(()=>{}); return Promise.resolve(); },
  updateProfile(payload)  { return this.request('/api/v1/auth/me/profile',{method:'PATCH',body:JSON.stringify(payload)}); },
};
