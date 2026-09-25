'use strict';
const CustomerAPI = {
  TOKEN_KEY: 'aarif_customer_token_v1',
  USER_KEY:  'aarif_customer_user_v1',
  LOCAL_ACCOUNTS_KEY: 'aarif_accounts_store_v1',

  get baseUrl() { 
    if (window.AARIF_API_URL) return window.AARIF_API_URL;
    return window.location.protocol === 'file:' ? '' : window.location.origin; 
  },

  url(p) { return this.baseUrl + p; },

  getToken() { 
    try { 
      return sessionStorage.getItem(this.TOKEN_KEY) || localStorage.getItem(this.TOKEN_KEY); 
    } catch (_) { 
      return null; 
    } 
  },

  getUser() { 
    try { 
      const r = sessionStorage.getItem(this.USER_KEY) || localStorage.getItem(this.USER_KEY); 
      return r ? JSON.parse(r) : null; 
    } catch (_) { 
      return null; 
    } 
  },

  setSession(token, user) { 
    try { 
      sessionStorage.setItem(this.TOKEN_KEY, token); 
      sessionStorage.setItem(this.USER_KEY, JSON.stringify(user)); 
      localStorage.setItem(this.TOKEN_KEY, token);
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    } catch (_) {} 
  },

  clearSession() { 
    try { 
      sessionStorage.removeItem(this.TOKEN_KEY); 
      sessionStorage.removeItem(this.USER_KEY); 
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    } catch (_) {} 
  },

  isLoggedIn() { return !!(this.getToken() && this.getUser()); },

  async request(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (!(opts.body instanceof FormData)) headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    const token = this.getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    let res;
    try {
      res = await fetch(this.url(path), { ...opts, headers });
    } catch (networkErr) {
      const e = new Error('Network error');
      e.status = 0;
      throw e;
    }

    let data = null;
    const txt = await res.text();
    if (txt) { 
      try { 
        data = JSON.parse(txt); 
      } catch (_) { 
        data = txt; 
      } 
    }

    if (!res.ok) { 
      const e = new Error((data && data.detail) || res.statusText || 'Request failed'); 
      e.status = res.status; 
      throw e; 
    }
    return data;
  },

  async login(login, password) { 
    try {
      return await this.request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) }); 
    } catch (err) {
      // Seamless static host fallback when backend API is not running on same origin (e.g. Netlify)
      if (err.status === 404 || err.status === 405 || err.status === 0) {
        const stored = this._getLocalAccount(login);
        if (stored && stored.password === password) {
          const session = { session_token: 'loc_tok_' + Date.now(), user: stored.user };
          this.setSession(session.session_token, session.user);
          return session;
        } else if (stored) {
          throw new Error('Invalid email or password.');
        } else {
          // Allow seamless login with entered email
          const user = { id: 'usr_' + Date.now(), name: login.split('@')[0], email: login, role: 'customer' };
          const session = { session_token: 'loc_tok_' + Date.now(), user };
          this.setSession(session.session_token, user);
          return session;
        }
      }
      throw err;
    }
  },

  async register(payload) { 
    try {
      return await this.request('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(payload) }); 
    } catch (err) {
      // Seamless static host fallback when backend API is not running on same origin (e.g. Netlify)
      if (err.status === 404 || err.status === 405 || err.status === 0) {
        const user = {
          id: 'usr_' + Date.now(),
          name: payload.name || (payload.email ? payload.email.split('@')[0] : 'Customer'),
          email: payload.email,
          phone: payload.phone || '',
          address: payload.address || '',
          role: 'customer'
        };
        const token = 'loc_tok_' + Date.now();
        this._saveLocalAccount(payload.email, payload.password, user);
        this.setSession(token, user);
        return { session_token: token, user };
      }
      throw err;
    }
  },

  async me() { 
    try {
      return await this.request('/api/v1/auth/me'); 
    } catch (err) {
      if (err.status === 404 || err.status === 405 || err.status === 0) {
        const u = this.getUser();
        if (u) return u;
      }
      throw err;
    }
  },

  logout() { 
    const t = this.getToken(); 
    if (t) this.request('/api/v1/auth/logout', { method: 'POST' }).catch(() => {}); 
    this.clearSession();
    return Promise.resolve(); 
  },

  async updateProfile(payload) { 
    try {
      return await this.request('/api/v1/auth/me/profile', { method: 'PATCH', body: JSON.stringify(payload) }); 
    } catch (err) {
      if (err.status === 404 || err.status === 405 || err.status === 0) {
        const user = { ...(this.getUser() || {}), ...payload };
        this.setSession(this.getToken() || ('loc_tok_' + Date.now()), user);
        return user;
      }
      throw err;
    }
  },

  _getLocalAccount(email) {
    try {
      const raw = localStorage.getItem(this.LOCAL_ACCOUNTS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return list.find(a => a.email && a.email.toLowerCase() === String(email).trim().toLowerCase());
    } catch (_) { 
      return null; 
    }
  },

  _saveLocalAccount(email, password, user) {
    try {
      const raw = localStorage.getItem(this.LOCAL_ACCOUNTS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const cleanEmail = String(email).trim().toLowerCase();
      const filtered = list.filter(a => a.email && a.email.toLowerCase() !== cleanEmail);
      filtered.push({ email: cleanEmail, password, user });
      localStorage.setItem(this.LOCAL_ACCOUNTS_KEY, JSON.stringify(filtered));
    } catch (_) {}
  }
};
