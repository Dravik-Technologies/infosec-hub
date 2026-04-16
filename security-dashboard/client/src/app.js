import { useState, useEffect } from 'react';

/* ── Auth token store ── */
export const AUTH = {
  getToken : ()  => localStorage.getItem('mash-token'),
  setToken : t   => localStorage.setItem('mash-token', t),
  getUser  : ()  => { try { return JSON.parse(localStorage.getItem('mash-user')); } catch { return null; } },
  setUser  : u   => localStorage.setItem('mash-user', JSON.stringify(u)),
  clearAll : ()  => { localStorage.removeItem('mash-token'); localStorage.removeItem('mash-user'); },
  hdrs     : ()  => {
    const t = localStorage.getItem('mash-token');
    const base = { 'Content-Type': 'application/json' };
    return t ? { ...base, Authorization: `Bearer ${t}` } : base;
  },
};

/* ── API ── */
function _on401() { AUTH.clearAll(); window.location.reload(); }
export const API = {
  async get(c)        { try { const r = await fetch(`/api/${c}`, { headers: AUTH.hdrs() }); if (r.status === 401) { _on401(); return null; } return r.json(); } catch { return null; } },
  async put(c, d)     { const r = await fetch(`/api/${c}`,       { method: 'PUT',    headers: AUTH.hdrs(), body: JSON.stringify(d) }); if (r.status === 401) _on401(); return r.json(); },
  async post(c, d)    { const r = await fetch(`/api/${c}`,       { method: 'POST',   headers: AUTH.hdrs(), body: JSON.stringify(d) }); if (r.status === 401) _on401(); return r.json(); },
  async patch(c, id, d) { const r = await fetch(`/api/${c}/${id}`, { method: 'PATCH',  headers: AUTH.hdrs(), body: JSON.stringify(d) }); if (r.status === 401) _on401(); return r.json(); },
  async del(c, id)    { const r = await fetch(`/api/${c}/${id}`, { method: 'DELETE', headers: AUTH.hdrs() }); if (r.status === 401) _on401(); return r.json(); },
};

/* ── Helpers ── */
export const fmtDate   = d => { if (!d) return '—'; return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
export const fmtShort  = d => { if (!d) return '—'; return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
export const daysUntil = d => { if (!d) return null; return Math.ceil((new Date(d + 'T12:00:00Z') - new Date()) / 864e5); };
export const uid       = () => 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
export const today     = new Date();

export const pctColor = v => v >= 95 ? '#10B981' : v >= 82 ? 'var(--gold)' : '#F59E0B';
export const pctBar   = v => v >= 95 ? 'p-g' : v >= 82 ? 'p-gold' : 'p-a';
export const sevCls   = s => ({ critical: 'b-r', high: 'b-r', medium: 'b-a', low: 'b-g' }[s] || 'b-b');

/* ── Business-friendly compliance labels ── */
export const COMP = {
  nispom:  { label: 'Personnel & Operational Security', sub: 'NISPOM',  icon: 'fa-users-gear',      color: 'var(--gold)'    },
  daapm:   { label: 'Audit Readiness',                  sub: 'DAAPM',   icon: 'fa-clipboard-check', color: 'var(--gold-lt)' },
  icd705:  { label: 'SCIF Technical Controls',          sub: 'ICD 705', icon: 'fa-building-lock',   color: '#93C5FD'        },
  tempest: { label: 'Emanations Security',              sub: 'TEMPEST', icon: 'fa-tower-broadcast', color: '#C4B5FD'        },
};

/* ── Clock hook ── */
export function useClock() {
  const [t, setT] = useState('');
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString('en-US', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

/* ── MASH global utilities ── */
export const MASH = {
  toast(msg, type = 'success') {
    const C = { success: 'border-emerald-400 text-emerald-400', error: 'border-red-400 text-red-400', info: 'border-yellow-500 text-yellow-400', warning: 'border-amber-400 text-amber-400' };
    const I = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };
    const d = document.createElement('div');
    d.className = `toast-item ${C[type]}`;
    d.innerHTML = `<i class="fa-solid ${I[type]} shrink-0"></i><span>${msg}</span>`;
    document.getElementById('toasts').appendChild(d);
    setTimeout(() => { d.style.animation = 't-out .3s ease forwards'; setTimeout(() => d.remove(), 300); }, 3500);
  },

  openModal(title, body, footer = '') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal-footer').innerHTML = footer;
    document.getElementById('modal-back').classList.add('open');
  },

  closeModal() { document.getElementById('modal-back').classList.remove('open'); },

  toggleNotif() {
    const d = document.getElementById('notif-drw');
    const o = document.getElementById('notif-overlay');
    const open = d.classList.toggle('open');
    o.classList.toggle('hidden', !open);
  },

  initTilt() {
    document.querySelectorAll('.card-tilt').forEach(c => {
      c.addEventListener('mousemove', e => {
        const r = c.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        c.style.transition = 'none';
        c.style.transform = `perspective(800px) rotateX(${y * -7}deg) rotateY(${x * 7}deg) translateZ(5px)`;
      });
      c.addEventListener('mouseleave', () => {
        c.style.transition = 'transform .5s ease';
        c.style.transform = 'none';
      });
    });
  },

  // set by App component
  openSiteModal: null,
  _saveSite: null,
  _saveFinding: null,
  _saveRisk: null,
};

/* make globally accessible for inline onclick handlers in modal HTML strings */
window.MASH = MASH;

/* ── Wire up DOM event listeners (called from main.jsx after DOM ready) ── */
export function initMASHDom() {
  const modalClose   = document.getElementById('modal-close');
  const modalBack    = document.getElementById('modal-back');
  const notifClose   = document.getElementById('notif-close');
  const notifOverlay = document.getElementById('notif-overlay');
  const notifMark    = document.getElementById('notif-mark-read');

  if (modalClose)   modalClose.onclick = () => MASH.closeModal();
  if (modalBack)    modalBack.addEventListener('click', e => { if (e.target === modalBack) MASH.closeModal(); });
  if (notifClose)   notifClose.onclick = () => MASH.toggleNotif();
  if (notifOverlay) notifOverlay.onclick = () => MASH.toggleNotif();
  if (notifMark)    notifMark.onclick = () => {
    const bb = document.getElementById('bell-badge');
    const nc = document.getElementById('notif-count');
    if (bb) bb.style.display = 'none';
    if (nc) nc.textContent = '0';
    MASH.toast('All alerts marked as read', 'success');
  };

  document.addEventListener('keydown', e => { if (e.key === 'Escape') MASH.closeModal(); });
}
