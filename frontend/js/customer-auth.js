'use strict';
/* Customer auth header, login, signup, account pages */

function initCustomerHeaderAuth() {
  _paintHeaderFromCache();
  const token = CustomerAPI.getToken();
  if (!token) return;
  CustomerAPI.me().then(profile => {
    CustomerAPI.setSession(token, profile);
    _paintHeader(profile);
  }).catch(() => { CustomerAPI.clearSession(); _paintHeader(null); });
}

function _paintHeaderFromCache() {
  const user = CustomerAPI.getUser();
  _paintHeader(user);
}

function _paintHeader(user) {
  ensureAccountShell();
  const label  = document.getElementById('header-account-label');
  const dropdown = document.getElementById('header-account-dropdown');
  const adminLink = document.getElementById('header-admin-link');
  if (!label) return;
  if (user) {
    label.textContent = (user.name||user.username||'Account').split(' ')[0].slice(0,12);
    if (adminLink) adminLink.hidden = user.role !== 'admin';
  } else {
    label.textContent = 'Sign In';
    dropdown?.setAttribute('hidden','');
    if (adminLink) adminLink.hidden = true;
  }
}

function ensureAccountShell() {
  if (document.getElementById('header-account-wrap')) return;
  const actions = document.querySelector('.header-actions');
  if (!actions) return;
  const wrap = document.createElement('div');
  wrap.id = 'header-account-wrap';
  wrap.className = 'header-account-wrap';
  wrap.style.cssText = 'position:relative';
  wrap.innerHTML = `
    <button type="button" id="header-account-btn" class="header-action header-action--account" title="Account"
      aria-expanded="false" aria-haspopup="true">
      <i class="fa-solid fa-circle-user"></i>
      <span class="header-action-label" id="header-account-label">Sign In</span>
    </button>
    <div id="header-account-dropdown" class="header-account-dropdown" hidden>
      <a href="account.html"><i class="fa-solid fa-id-card"></i> My Profile</a>
      <a href="/admin" id="header-admin-link" hidden><i class="fa-solid fa-gauge-high"></i> Admin Panel</a>
      <button type="button" id="header-account-logout"><i class="fa-solid fa-right-from-bracket"></i> Sign Out</button>
    </div>`;
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  if (mobileToggle) actions.insertBefore(wrap, mobileToggle);
  else actions.appendChild(wrap);

  // bind
  const btn = document.getElementById('header-account-btn');
  const ddrop = document.getElementById('header-account-dropdown');
  btn?.addEventListener('click', e => {
    e.stopPropagation();
    if (!CustomerAPI.isLoggedIn()) { window.location.href='login.html'; return; }
    const open = ddrop?.hasAttribute('hidden');
    open ? ddrop.removeAttribute('hidden') : ddrop?.setAttribute('hidden','');
    btn.setAttribute('aria-expanded', open ? 'true':'false');
  });
  document.addEventListener('click', () => { ddrop?.setAttribute('hidden',''); });
  document.getElementById('header-account-logout')?.addEventListener('click', () => {
    CustomerAPI.logout().finally(() => { CustomerAPI.clearSession(); window.location.href='index.html'; });
  });
}

/* Login page */
function initLoginPage() {
  const form    = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  if (!form) return;
  if (CustomerAPI.isLoggedIn()) { window.location.replace('index.html'); return; }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (errorEl) { errorEl.textContent=''; errorEl.className='auth-error hidden'; }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const res = await CustomerAPI.login(form.login.value.trim(), form.password.value);
      CustomerAPI.setSession(res.session_token, res.user);
      window.location.href = 'index.html';
    } catch (err) {
      if (errorEl) { errorEl.textContent=err.message||'Sign in failed.'; errorEl.className='auth-error'; }
      btn.disabled = false;
    }
  });
}

/* Signup page */
function initSignupPage() {
  const form    = document.getElementById('signup-form');
  const errorEl = document.getElementById('signup-error');
  if (!form) return;
  if (CustomerAPI.isLoggedIn()) { window.location.replace('index.html'); return; }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (errorEl) { errorEl.textContent=''; errorEl.className='auth-error hidden'; }
    const btn = form.querySelector('button[type="submit"]');
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating…';
    try {
      const res = await CustomerAPI.register({
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        phone_country: 'IN',
        phone: form.phone.value.trim(),
        address: form.address?.value?.trim()||'India',
        password: form.password.value,
      });
      CustomerAPI.setSession(res.session_token, res.user);
      window.location.href = 'index.html';
    } catch (err) {
      if (errorEl) { errorEl.textContent=err.message||'Sign up failed.'; errorEl.className='auth-error'; }
      btn.disabled=false; btn.innerHTML=orig;
    }
  });
}

/* Account page */
function initAccountPage() {
  if (!CustomerAPI.isLoggedIn()) { window.location.href='login.html?next=account.html'; return; }
  const form    = document.getElementById('profile-form');
  const successEl = document.getElementById('profile-success');
  const errorEl   = document.getElementById('profile-error');
  const user = CustomerAPI.getUser();
  if (form && user) {
    form.name.value  = user.name  || '';
    form.email.value = user.email || '';
    if (form.phone) form.phone.value = user.phone || '';
  }
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const updated = await CustomerAPI.updateProfile({ name: form.name.value.trim(), phone: form.phone?.value.trim() });
      CustomerAPI.setSession(CustomerAPI.getToken(), updated);
      if (successEl) { successEl.textContent='Profile updated.'; successEl.className=''; }
    } catch (err) {
      if (errorEl) { errorEl.textContent=err.message||'Update failed.'; errorEl.className='auth-error'; }
    } finally { btn.disabled=false; }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if      (page === 'login')   initLoginPage();
  else if (page === 'signup')  initSignupPage();
  else if (page === 'account') { initCustomerHeaderAuth(); initAccountPage(); }
  else initCustomerHeaderAuth();
});
