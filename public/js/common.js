/* ═══════════════════════════════════════════════════════
   راوي — common.js  (Shared utilities for all pages)
   ═══════════════════════════════════════════════════════ */

// ─── API helper ──────────────────────────────────────────
const api = {
  async request(method, url, data) {
    const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include' };
    if (data !== undefined) opts.body = JSON.stringify(data);
    const res = await fetch(url, opts);
    if (res.status === 204) return null;
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'خطأ في الطلب');
    return json;
  },
  get: (url) => api.request('GET', url),
  post: (url, data) => api.request('POST', url, data),
  put: (url, data) => api.request('PUT', url, data),
  patch: (url, data) => api.request('PATCH', url, data),
  delete: (url) => api.request('DELETE', url),
};

// ─── Auth state ───────────────────────────────────────────
let _user = null;
let _userFetched = false;

async function getUser() {
  if (_userFetched) return _user;
  try { _user = await api.get('/api/auth/me'); } catch { _user = null; }
  _userFetched = true;
  return _user;
}

async function requireAuth() {
  const user = await getUser();
  if (!user) { window.location.href = '/auth.html'; return null; }
  return user;
}

async function logout() {
  try { await api.post('/api/auth/logout'); } catch {}
  _user = null; _userFetched = false;
  window.location.href = '/auth.html';
}

// ─── URL params ───────────────────────────────────────────
function params() {
  return Object.fromEntries(new URLSearchParams(window.location.search));
}

// ─── Toast ────────────────────────────────────────────────
function toast(message, type = 'success') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const el = document.createElement('div');
  el.className = 'toast-item ' + type;
  el.textContent = message;
  c.appendChild(el);
  requestAnimationFrame(() => { requestAnimationFrame(() => el.classList.add('visible')); });
  setTimeout(() => {
    el.classList.remove('visible');
    setTimeout(() => el.remove(), 400);
  }, 3200);
}

// ─── Confirm dialog ───────────────────────────────────────
function confirmDialog(msg) {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)';
    ov.innerHTML = `<div style="background:white;border-radius:20px;padding:28px;max-width:380px;width:100%;text-align:right;font-family:'Noto Sans Arabic',sans-serif">
      <p style="font-size:16px;margin-bottom:20px;line-height:1.7">${escHtml(msg)}</p>
      <div style="display:flex;gap:10px">
        <button id="_cd_ok" class="btn btn-danger">تأكيد الحذف</button>
        <button id="_cd_no" class="btn btn-secondary">إلغاء</button>
      </div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('#_cd_ok').onclick = () => { ov.remove(); resolve(true); };
    ov.querySelector('#_cd_no').onclick = () => { ov.remove(); resolve(false); };
    ov.onclick = e => { if (e.target === ov) { ov.remove(); resolve(false); } };
  });
}

// ─── Modal helpers ────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

// ─── Utility ──────────────────────────────────────────────
function escHtml(t) {
  return String(t || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('ar-SA', { year:'numeric', month:'long', day:'numeric' });
}

function avatarHtml(user, size = 40) {
  const s = `width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0`;
  if (user?.avatarUrl) return `<img src="${escHtml(user.avatarUrl)}" style="${s}" alt="">`;
  const letter = (user?.username || '?')[0];
  return `<div style="${s};background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${Math.floor(size*0.38)}px">${letter}</div>`;
}

function coverHtml(novel, cls = '') {
  if (novel?.coverUrl) return `<img src="${escHtml(novel.coverUrl)}" class="${cls}" style="width:100%;height:100%;object-fit:cover" alt="">`;
  return `<div class="${cls}" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:48px;background:linear-gradient(135deg,rgba(200,117,57,.18),rgba(200,117,57,.05))">📖</div>`;
}

function genreBadges(genre) {
  if (!genre) return '';
  return genre.split(/[,،]/).slice(0,3).map(g => `<span class="badge">${escHtml(g.trim())}</span>`).join(' ');
}

function statusBadge(s) {
  return s === 'published'
    ? '<span class="badge badge-green">منشورة</span>'
    : '<span class="badge badge-gray">مسودة</span>';
}

function setLoading(btn, loading, text = '') {
  if (loading) { btn.disabled = true; btn._origText = btn.textContent; btn.textContent = 'جارٍ...'; }
  else { btn.disabled = false; btn.textContent = text || btn._origText || 'حفظ'; }
}

// ─── Sidebar rendering ────────────────────────────────────
async function renderSidebar(active) {
  const el = document.getElementById('sidebar');
  if (!el) return;
  const user = await getUser();
  const profileHref = user ? `/profile.html?username=${encodeURIComponent(user.username)}` : '/auth.html';

  const navItems = [
    { id:'home', href:'/index.html', label:'روياتي', icon:'<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
    { id:'library', href:'/library.html', label:'المكتبة', icon:'<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>' },
    { id:'profile', href:profileHref, label:'ملفي', icon:'<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/>' },
    { id:'settings', href:'/settings.html', label:'الإعدادات', icon:'<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>' },
  ];

  const navHtml = navItems.map(item => `
    <a href="${item.href}" class="nav-link ${active === item.id ? 'active' : ''}">
      <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${item.icon}</svg>
      ${item.label}
    </a>`).join('');

  const userHtml = user
    ? `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;cursor:pointer" onclick="logout()">
        ${avatarHtml(user, 36)}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(user.username)}</div>
          <div style="font-size:12px;color:#999">تسجيل الخروج</div>
        </div>
      </div>`
    : `<a href="/auth.html" class="btn btn-primary btn-sm" style="width:100%;justify-content:center">تسجيل الدخول</a>`;

  el.innerHTML = `
    <a href="/index.html" class="sidebar-logo">
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C87539" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
      <span class="sidebar-logo-text">راوي</span>
    </a>
    <nav class="nav-links">${navHtml}</nav>
    <div class="sidebar-user">${userHtml}</div>`;
}

// ─── Mobile Bottom Nav ────────────────────────────────────
async function renderMobileNav(active) {
  const el = document.getElementById('mobile-nav');
  if (!el) return;
  const user = await getUser();
  const profileHref = user ? `/profile.html?username=${encodeURIComponent(user.username)}` : '/auth.html';

  const items = [
    { id:'home', href:'/index.html', label:'روياتي', icon:'<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
    { id:'library', href:'/library.html', label:'المكتبة', icon:'<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>' },
    { id:'profile', href:profileHref, label:'ملفي', icon:'<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/>' },
    { id:'settings', href:'/settings.html', label:'إعدادات', icon:'<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>' },
  ];

  el.innerHTML = items.map(item => `
    <a href="${item.href}" class="mobile-nav-item ${active === item.id ? 'active' : ''}">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${item.icon}</svg>
      <span>${item.label}</span>
    </a>`).join('');
}

// ─── Mobile Header ────────────────────────────────────────
async function renderMobileHeader() {
  const el = document.getElementById('mobile-user-menu');
  if (!el) return;
  const user = await getUser();
  if (user) {
    el.innerHTML = `<button onclick="logout()" style="background:none;border:none;cursor:pointer;padding:4px">${avatarHtml(user, 34)}</button>`;
  } else {
    el.innerHTML = `<a href="/auth.html" class="btn btn-primary btn-sm">دخول</a>`;
  }
}

// ─── Init (call on every page) ────────────────────────────
async function initPage(active) {
  await Promise.all([
    renderSidebar(active),
    renderMobileNav(active),
    renderMobileHeader(),
  ]);
}

// ─── Image upload helper ──────────────────────────────────
async function uploadFile(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: form, credentials: 'include' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'فشل الرفع');
  return json.url;
}
