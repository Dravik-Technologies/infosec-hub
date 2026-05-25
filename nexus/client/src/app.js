import { useEffect, useState } from 'react';

export const AUTH = {
  getToken: () => localStorage.getItem('nexus-token'),
  setToken: token => localStorage.setItem('nexus-token', token),
  getUser: () => { try { return JSON.parse(localStorage.getItem('nexus-user')); } catch { return null; } },
  setUser: user => localStorage.setItem('nexus-user', JSON.stringify(user)),
  clearAll: () => {
    localStorage.removeItem('nexus-token');
    localStorage.removeItem('nexus-user');
  },
  hdrs: () => {
    const token = localStorage.getItem('nexus-token');
    const base = { 'Content-Type': 'application/json' };
    return token ? { ...base, Authorization: `Bearer ${token}` } : base;
  },
};

function on401() {
  AUTH.clearAll();
  window.location.reload();
}

// Returns discriminated error { _apiError: true, status, message } on non-200.
// Returns null on network failure.
export const API = {
  async get(path) {
    try {
      const res = await fetch(`/api/${path}`, { headers: AUTH.hdrs() });
      if (res.status === 401) { on401(); return null; }
      const body = await res.json();
      if (!res.ok) return { _apiError: true, status: res.status, message: body?.error || 'Request failed' };
      return body;
    } catch { return null; }
  },

  async put(path, data) {
    try {
      const res = await fetch(`/api/${path}`, { method: 'PUT', headers: AUTH.hdrs(), body: JSON.stringify(data) });
      if (res.status === 401) { on401(); return null; }
      const body = await res.json();
      if (!res.ok) return { _apiError: true, status: res.status, message: body?.error || 'Save failed' };
      return body;
    } catch { return null; }
  },

  async post(path, data) {
    try {
      const res = await fetch(`/api/${path}`, { method: 'POST', headers: AUTH.hdrs(), body: JSON.stringify(data) });
      if (res.status === 401) { on401(); return null; }
      const body = await res.json();
      if (!res.ok) return { _apiError: true, status: res.status, message: body?.error || 'Create failed' };
      return body;
    } catch { return null; }
  },

  async del(path) {
    try {
      const res = await fetch(`/api/${path}`, { method: 'DELETE', headers: AUTH.hdrs() });
      if (res.status === 401) { on401(); return null; }
      const body = await res.json();
      if (!res.ok) return { _apiError: true, status: res.status, message: body?.error || 'Delete failed' };
      return body;
    } catch { return null; }
  },
};

export function useClock() {
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return clock;
}

export const fmtDate = value => {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00Z`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const pctClass = value => {
  if (value >= 80) return 'is-good';
  if (value >= 60) return 'is-watch';
  return 'is-risk';
};

export function isAdminRole(user) {
  return user?.role === 'Corporate Admin'
    || user?.role === 'Program Manager'
    || user?.securityRole === 'Program Manager';
}
