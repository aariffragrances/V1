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
    const pass = form.password.value;
    const confirm = form.password_confirm ? form.password_confirm.value : pass;
    if (pass !== confirm) {
      if (errorEl) { errorEl.textContent='Passwords do not match.'; errorEl.className='auth-error'; }
      return;
    }
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
  if (!CustomerAPI.isLoggedIn()) { window.location.href = 'login.html?next=account.html'; return; }

  let user = CustomerAPI.getUser();
  const form = document.getElementById('profile-form');
  const successEl = document.getElementById('profile-success');
  const errorEl = document.getElementById('profile-error');
  const viewMode = document.getElementById('profile-view-mode');
  const editMode = document.getElementById('profile-edit-mode');
  const toggleBtn = document.getElementById('btn-toggle-profile-edit');
  const cancelTopBtn = document.getElementById('btn-cancel-profile-edit-top');
  const cancelBtn = document.getElementById('btn-cancel-profile-edit');

  function parseAddress(addr) {
    if (!addr) return { street: '', city: '', postcode: '' };
    const parts = addr.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 3) {
      return { street: parts.slice(0, -2).join(', '), city: parts[parts.length - 2], postcode: parts[parts.length - 1] };
    } else if (parts.length === 2) {
      return { street: parts[0], city: parts[1], postcode: '' };
    }
    return { street: addr, city: '', postcode: '' };
  }

  function paintProfile(u) {
    if (!u) return;
    user = u;
    const name = u.name || '';
    const email = u.email || '';
    const username = u.username || (email ? email.split('@')[0] : '');
    const phone = u.phone || '';
    const addr = parseAddress(u.address || '');

    // Initials
    const initialsEl = document.getElementById('profile-avatar-initials');
    if (initialsEl) {
      const char = (name || username || email || 'U').trim()[0].toUpperCase();
      initialsEl.textContent = char;
    }

    // Welcome & Role
    const welcomeEl = document.getElementById('profile-welcome');
    if (welcomeEl) welcomeEl.textContent = name || username || 'My Profile';

    const roleEl = document.getElementById('profile-display-role');
    if (roleEl) {
      if (u.role === 'admin') {
        roleEl.textContent = 'Store Administrator';
      } else {
        roleEl.textContent = 'Customer';
      }
    }

    // Email hero
    const emailHeroEl = document.getElementById('profile-display-email-hero');
    if (emailHeroEl) emailHeroEl.textContent = email || '—';

    // Manage Store button (admin only)
    const manageStore = document.getElementById('profile-manage-store');
    if (manageStore) {
      if (u.role === 'admin') {
        manageStore.removeAttribute('hidden');
        manageStore.style.display = 'inline-flex';
      } else {
        manageStore.setAttribute('hidden', '');
        manageStore.style.display = 'none';
      }
    }

    // Column 1
    const nameEl = document.getElementById('profile-display-name');
    if (nameEl) nameEl.textContent = name || 'Not provided';
    const userEl = document.getElementById('profile-display-username');
    if (userEl) userEl.textContent = username ? ('@' + username.replace(/^@/, '')) : 'Not provided';
    const emailEl = document.getElementById('profile-display-email');
    if (emailEl) emailEl.textContent = email || 'Not provided';

    // Column 2
    const phoneEl = document.getElementById('profile-display-phone');
    if (phoneEl) phoneEl.textContent = phone || 'Not provided';

    // Column 3
    const streetEl = document.getElementById('profile-display-address');
    if (streetEl) streetEl.textContent = addr.street || 'Not provided';
    const cityEl = document.getElementById('profile-display-city');
    if (cityEl) cityEl.textContent = addr.city || 'Not provided';
    const postEl = document.getElementById('profile-display-postcode');
    if (postEl) postEl.textContent = addr.postcode || 'Not provided';
  }

  function fillEditForm() {
    if (!form || !user) return;
    const addr = parseAddress(user.address || '');
    if (form.elements['name']) form.elements['name'].value = user.name || '';
    if (form.elements['username']) form.elements['username'].value = user.username || (user.email ? user.email.split('@')[0] : '');
    if (form.elements['email']) form.elements['email'].value = user.email || '';
    if (form.elements['phone']) form.elements['phone'].value = user.phone || '';
    if (form.elements['address']) form.elements['address'].value = addr.street || user.address || '';
    if (form.elements['city']) form.elements['city'].value = addr.city || '';
    if (form.elements['postcode']) form.elements['postcode'].value = addr.postcode || '';
  }

  function showEditMode() {
    fillEditForm();
    if (viewMode) viewMode.style.display = 'none';
    if (editMode) editMode.style.display = 'block';
    if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }
    if (successEl) { successEl.hidden = true; successEl.textContent = ''; }
    form?.elements['name']?.focus();
  }

  function showViewMode() {
    if (editMode) editMode.style.display = 'none';
    if (viewMode) viewMode.style.display = 'block';
  }

  toggleBtn?.addEventListener('click', () => {
    if (editMode && editMode.style.display !== 'none') showViewMode();
    else showEditMode();
  });
  cancelTopBtn?.addEventListener('click', showViewMode);
  cancelBtn?.addEventListener('click', showViewMode);

  // Paint immediate cache
  paintProfile(user);

  // Fetch freshest profile
  CustomerAPI.me().then(fresh => {
    if (fresh) {
      CustomerAPI.setSession(CustomerAPI.getToken(), fresh);
      paintProfile(fresh);
    }
  }).catch(() => {});

  // Form submit
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }
    if (successEl) { successEl.hidden = true; successEl.textContent = ''; }
    const btn = document.getElementById('profile-save-btn');
    if (btn) btn.disabled = true;

    const name = (form.elements['name']?.value || '').trim();
    const phone = (form.elements['phone']?.value || '').trim();
    const street = (form.elements['address']?.value || '').trim();
    const city = (form.elements['city']?.value || '').trim();
    const postcode = (form.elements['postcode']?.value || '').trim();

    const fullAddress = [street, city, postcode].filter(Boolean).join(', ');

    try {
      const payload = { name };
      if (phone) payload.phone = phone;
      if (fullAddress) payload.address = fullAddress;
      const updated = await CustomerAPI.updateProfile(payload);
      CustomerAPI.setSession(CustomerAPI.getToken(), updated);
      paintProfile(updated);
      showViewMode();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message || 'Update failed.';
        errorEl.hidden = false;
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if      (page === 'login')   initLoginPage();
  else if (page === 'signup')  initSignupPage();
  else if (page === 'account') { initCustomerHeaderAuth(); initAccountPage(); }
  else initCustomerHeaderAuth();
});
