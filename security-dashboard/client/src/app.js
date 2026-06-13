import { useState, useEffect } from 'react';

/* ── Auth token store ── */
export const AUTH = {
  getToken : ()  => localStorage.getItem('smw-token') || localStorage.getItem('mash-token'),
  setToken : t   => { localStorage.setItem('smw-token', t); localStorage.removeItem('mash-token'); },
  getUser  : ()  => {
    try {
      return JSON.parse(localStorage.getItem('smw-user') || localStorage.getItem('mash-user'));
    } catch { return null; }
  },
  setUser  : u   => { localStorage.setItem('smw-user', JSON.stringify(u)); localStorage.removeItem('mash-user'); },
  clearAll : ()  => {
    ['smw-token','smw-user','mash-token','mash-user'].forEach(k => localStorage.removeItem(k));
  },
  hdrs     : ()  => {
    const t = localStorage.getItem('smw-token') || localStorage.getItem('mash-token');
    return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
  },
};

/* ── 401 handler ── */
function on401() { AUTH.clearAll(); window.location.reload(); }

/* ── Workspace API ── */
export const WS = {
  async getSites() {
    try {
      const r = await fetch('/api/sites', { headers: AUTH.hdrs(), credentials: 'include' });
      if (r.status === 401) { on401(); return null; }
      const body = await r.json();
      if (!r.ok) return { _wsError: true, status: r.status, message: body?.error || 'Request failed' };
      return body;
    } catch { return null; }
  },
  async get(collection, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = `/api/ws/${collection}${qs ? '?' + qs : ''}`;
    try {
      const r = await fetch(url, { headers: AUTH.hdrs(), credentials: 'include' });
      if (r.status === 401) { on401(); return null; }
      const body = await r.json();
      // Return a discriminated error object so pages can show a real error state
      // instead of silently collapsing to an empty list.
      if (!r.ok) return { _wsError: true, status: r.status, message: body?.error || 'Request failed' };
      return body;
    } catch { return null; }
  },
  async post(collection, data) {
    const r = await fetch(`/api/ws/${collection}`, { method: 'POST', headers: AUTH.hdrs(), credentials: 'include', body: JSON.stringify(data) });
    if (r.status === 401) { on401(); return null; }
    const body = await r.json();
    if (!r.ok) return { _wsError: true, status: r.status, message: body?.error || 'Save failed' };
    return body;
  },
  async patch(collection, id, data) {
    const r = await fetch(`/api/ws/${collection}/${id}`, { method: 'PATCH', headers: AUTH.hdrs(), credentials: 'include', body: JSON.stringify(data) });
    if (r.status === 401) { on401(); return null; }
    const body = await r.json();
    if (!r.ok) return { _wsError: true, status: r.status, message: body?.error || 'Update failed' };
    return body;
  },
  async del(collection, id) {
    const r = await fetch(`/api/ws/${collection}/${id}`, { method: 'DELETE', headers: AUTH.hdrs(), credentials: 'include' });
    if (r.status === 401) { on401(); return null; }
    const body = await r.json();
    if (!r.ok) return { _wsError: true, status: r.status, message: body?.error || 'Delete failed' };
    return body;
  },
};

/* ── Legacy API (fallback) ── */
export const API = {
  async get(c) { try { const r = await fetch(`/api/${c}`, { headers: AUTH.hdrs(), credentials: 'include' }); if (r.status === 401) { on401(); return null; } return r.json(); } catch { return null; } },
  async post(c, d) { const r = await fetch(`/api/${c}`, { method: 'POST', headers: AUTH.hdrs(), credentials: 'include', body: JSON.stringify(d) }); return r.json(); },
  async patch(c, id, d) { const r = await fetch(`/api/${c}/${id}`, { method: 'PATCH', headers: AUTH.hdrs(), credentials: 'include', body: JSON.stringify(d) }); return r.json(); },
  async del(c, id) { const r = await fetch(`/api/${c}/${id}`, { method: 'DELETE', headers: AUTH.hdrs(), credentials: 'include' }); return r.json(); },
};

/* ── Date helpers ── */
export const fmtDate  = d => { if (!d) return '—'; try { return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return d; } };
export const fmtShort = d => { if (!d) return '—'; try { return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return d; } };
export const daysUntil = d => { if (!d) return null; return Math.ceil((new Date(d + 'T12:00:00Z') - new Date()) / 864e5); };
export const uid = () => 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

/* ── Status badge class helpers ── */
export function trainingBadge(status) {
  if (!status) return 'badge-gray';
  const s = status.toLowerCase();
  if (s === 'current') return 'badge-green';
  if (s === 'overdue') return 'badge-red';
  if (s === 'due soon') return 'badge-amber';
  return 'badge-gray';
}

export function statusBadge(status) {
  if (!status) return 'badge-gray';
  const s = status.toLowerCase();
  if (/active|current|approved|operational|completed|closed|enrolled/.test(s)) return 'badge-green';
  if (/overdue|critical|expired|high|failed|suspended|rejected/.test(s)) return 'badge-red';
  if (/pending|review|in.progress|due.soon|degraded|watch|mitigated|initiated|planned|upcoming/.test(s)) return 'badge-amber';
  if (/scheduled|submitted|processing/.test(s)) return 'badge-blue';
  return 'badge-gray';
}

export function sevBadge(severity) {
  const s = (severity || '').toLowerCase();
  if (s === 'high' || s === 'critical') return 'badge-red';
  if (s === 'medium') return 'badge-amber';
  if (s === 'low') return 'badge-blue';
  return 'badge-gray';
}

/* ── Clock ── */
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
