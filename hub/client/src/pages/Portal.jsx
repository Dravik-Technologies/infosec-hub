import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Shield, ShieldCheck, FileText, BarChart3, Flame,
  Sun, Moon, LogOut, ExternalLink, ArrowRight,
  Search, Tag, ChevronRight, Loader2,
} from 'lucide-react';

const ICON_MAP = { ShieldCheck, FileText, BarChart3, Shield, Flame };

const APPS = [
  {
    id:      'scorva',
    name:    'SCORVA',
    tagline: 'Cyber Command Center',
    desc:    'NIST SP 800-53 Rev 5 compliance management — ATO tracking, continuous monitoring, POAM, asset inventory, and access governance.',
    url:     'http://localhost:3000',
    ssoPath: '/auth/sso',
    color:   'teal',
    icon:    'ShieldCheck',
    team:    'Cybersecurity',
    status:  'live',
    tags:    ['NIST 800-53', 'RMF', 'ATO', 'ConMon', 'POAM'],
    badge:   null,
  },
  {
    id:      'crater',
    name:    'CRATER',
    tagline: 'eMASS RMF Toolkit',
    desc:    'eMASS-aligned RMF package builder with SCTM, POAM management, vulnerability tracking, system diagrams, and compliance reporting.',
    url:     'http://localhost:3003',
    ssoPath: '/sso.html',
    color:   'indigo',
    icon:    'FileText',
    team:    'GRC',
    status:  'live',
    tags:    ['eMASS', 'RMF', 'SCTM', 'POAM', 'Vulnerabilities'],
    badge:   null,
  },
  {
    id:      'mash',
    name:    'MASH',
    tagline: 'MTSI Advanced Sentinel Hub',
    desc:    'DoD security compliance dashboard with live threat intelligence feeds, audit log analysis, and posture monitoring.',
    url:     'http://localhost:8080',
    ssoPath: '/auth/sso',
    color:   'gold',
    icon:    'BarChart3',
    team:    'Security Operations',
    status:  'live',
    tags:    ['Dashboard', 'Threat Intel', 'Compliance', 'DoD'],
    badge:   null,
  },
  {
    id:      'lava',
    name:    'LAVA',
    tagline: 'Network Access Portal',
    desc:    'Magmatic onboarding portal with digitized DD Form 2875 SAAR workflow, Vulcan approval command, and hardware asset provisioning.',
    url:     'http://localhost:3002',
    ssoPath: '/auth/sso',
    color:   'orange',
    icon:    'Flame',
    team:    'Network Administration',
    status:  'live',
    tags:    ['SAAR', 'DD Form 2875', 'Access Control', 'Hardware', 'YubiKey'],
    badge:   null,
  },
];

const COLOR_MAP = {
  teal: {
    border:  'border-teal-500/20 hover:border-teal-500/50',
    icon:    'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20',
    badge:   'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20',
    launch:  'bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/20',
    glow:    'group-hover:shadow-teal-500/10',
  },
  indigo: {
    border:  'border-indigo-500/20 hover:border-indigo-500/50',
    icon:    'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
    badge:   'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
    launch:  'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
    glow:    'group-hover:shadow-indigo-500/10',
  },
  gold: {
    border:  'border-scorva-gold/20 hover:border-scorva-gold/50',
    icon:    'bg-scorva-gold/10 text-scorva-gold border border-scorva-gold/20',
    badge:   'bg-scorva-gold/10 text-scorva-gold border border-scorva-gold/20',
    launch:  'bg-scorva-gold/10 hover:bg-scorva-gold/20 text-scorva-gold border border-scorva-gold/20',
    glow:    'group-hover:shadow-yellow-500/10',
  },
  cyan: {
    border:  'border-scorva-cyan/20 hover:border-scorva-cyan/50',
    icon:    'bg-scorva-cyan/10 text-scorva-cyan border border-scorva-cyan/20',
    badge:   'bg-scorva-cyan/10 text-scorva-cyan border border-scorva-cyan/20',
    launch:  'bg-scorva-cyan/10 hover:bg-scorva-cyan/20 text-scorva-cyan border border-scorva-cyan/20',
    glow:    'group-hover:shadow-cyan-500/10',
  },
  orange: {
    border:  'border-orange-500/20 hover:border-orange-500/50',
    icon:    'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20',
    badge:   'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20',
    launch:  'bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/20',
    glow:    'group-hover:shadow-orange-500/10',
  },
};

export default function Portal() {
  const { user, logout, launchApp } = useAuth();
  const { dark, toggle } = useTheme();
  const [search,    setSearch]    = useState('');
  const [team,      setTeam]      = useState('All');
  const [launching, setLaunching] = useState(null);
  const [apps,      setApps]      = useState(APPS);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminRequests, setAdminRequests] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [createForm, setCreateForm] = useState({ id: '', name: '', username: '', email: '', password: '', role: 'Viewer', allowedApps: ['hub'] });
  const teams = ['All', ...new Set(apps.map(app => app.team))];
  const manageableApps = ['hub', ...APPS.map(app => app.id)];
  const isAdmin = user?.role === 'Corporate Admin';

  // Keep app list in sync with the server so ssoPath changes take effect
  // without a client rebuild.
  useEffect(() => {
    const BASE = import.meta.env.DEV ? 'http://localhost:3010' : '';
    fetch(`${BASE}/api/apps`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (Array.isArray(data) && data.length) setApps(data); })
      .catch(() => { /* keep local APPS on network failure */ });
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadAdminUsers();
    loadAccessRequests();
  }, [isAdmin]);

  const visible = apps.filter(app => {
    const matchTeam   = team === 'All' || app.team === team;
    const q           = search.toLowerCase();
    const matchSearch = !q
      || app.name.toLowerCase().includes(q)
      || app.tagline.toLowerCase().includes(q)
      || app.tags.some(t => t.toLowerCase().includes(q))
      || app.team.toLowerCase().includes(q);
    return matchTeam && matchSearch;
  });

  async function handleLaunch(app) {
    setLaunching(app.id);
    try {
      const url = await launchApp(app.id, app.url, app.ssoPath ?? null);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // SSO token failed — open without token (app may redirect to its own login)
      window.open(app.url, '_blank', 'noopener,noreferrer');
    } finally {
      setLaunching(null);
    }
  }

  async function loadAdminUsers() {
    const BASE = import.meta.env.DEV ? 'http://localhost:3010' : '';
    setAdminLoading(true); setAdminError('');
    try {
      const res = await fetch(`${BASE}/api/admin/users`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load users');
      setAdminUsers(data.users || []);
    } catch (err) {
      setAdminError(err.message);
    } finally {
      setAdminLoading(false);
    }
  }

  async function loadAccessRequests() {
    const BASE = import.meta.env.DEV ? 'http://localhost:3010' : '';
    setRequestLoading(true); setAdminError('');
    try {
      const res = await fetch(`${BASE}/api/admin/access-requests`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load access requests');
      setAdminRequests(data.requests || []);
    } catch (err) {
      setAdminError(err.message);
    } finally {
      setRequestLoading(false);
    }
  }

  function toggleUserApp(userId, appId) {
    setAdminUsers(current => current.map(entry => {
      if (entry.id !== userId) return entry;
      const allowedApps = entry.allowedApps.includes(appId)
        ? entry.allowedApps.filter(app => app !== appId)
        : entry.allowedApps.concat(appId);
      return { ...entry, allowedApps };
    }));
  }

  async function saveUserAccess(user) {
    const BASE = import.meta.env.DEV ? 'http://localhost:3010' : '';
    setAdminError(''); setAdminMessage('');
    try {
      const res = await fetch(`${BASE}/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: user.status,
          allowedApps: user.allowedApps,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to save user');
      setAdminUsers(current => current.map(entry => entry.id === user.id ? data.user : entry));
      setAdminMessage(`Saved access for ${user.username}.`);
    } catch (err) {
      setAdminError(err.message);
    }
  }

  async function createUser(e) {
    e.preventDefault();
    const BASE = import.meta.env.DEV ? 'http://localhost:3010' : '';
    setAdminError(''); setAdminMessage('');
    try {
      const res = await fetch(`${BASE}/api/admin/users`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to create user');
      setAdminUsers(current => [data.user, ...current]);
      if (Array.isArray(data.fulfilledRequests) && data.fulfilledRequests.length) {
        setAdminRequests(current => current.map(entry => {
          const matched = data.fulfilledRequests.find(request => request.id === entry.id);
          return matched || entry;
        }));
      }
      setCreateForm({ id: '', name: '', username: '', email: '', password: '', role: 'Viewer', allowedApps: ['hub'] });
      setAdminMessage(`Created ${data.user.username}.`);
    } catch (err) {
      setAdminError(err.message);
    }
  }

  function toggleCreateApp(appId) {
    setCreateForm(current => ({
      ...current,
      allowedApps: current.allowedApps.includes(appId)
        ? current.allowedApps.filter(app => app !== appId)
        : current.allowedApps.concat(appId),
    }));
  }

  async function reviewRequest(requestId, status) {
    const BASE = import.meta.env.DEV ? 'http://localhost:3010' : '';
    setAdminError(''); setAdminMessage('');
    try {
      const res = await fetch(`${BASE}/api/admin/access-requests/${encodeURIComponent(requestId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to review request');
      setAdminRequests(current => current.map(entry => entry.id === requestId ? data.request : entry));
      if (data.user) {
        setAdminUsers(current => current.map(entry => entry.id === data.user.id ? data.user : entry));
      }
      setAdminMessage(data.message || `Request ${status}.`);
    } catch (err) {
      setAdminError(err.message);
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-scorva-bg">

      {/* ── Header ── */}
      <header className="flex items-center justify-between h-14 px-4 md:px-6 bg-scorva-surface border-b border-scorva-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-scorva-accent/10 border border-scorva-accent/20">
            <Shield size={15} className="text-scorva-accent" />
          </div>
          <div>
            <div className="text-xs font-bold font-mono tracking-widest text-scorva-accent uppercase leading-none">MTSI Hub</div>
            <div className="text-[10px] text-scorva-muted font-mono leading-none mt-0.5">Security App Factory</div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggle}
            className="p-1.5 rounded-md text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover transition-colors"
            title="Toggle theme"
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <div className="flex items-center gap-2 pl-2 ml-1 border-l border-scorva-border">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-scorva-accent text-white dark:text-scorva-bg text-xs font-semibold shrink-0">
              {user?.initials}
            </div>
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-xs font-medium text-scorva-text">{user?.name}</span>
              <span className="text-[10px] text-scorva-muted">{user?.role}</span>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-md text-scorva-muted hover:text-red-500 hover:bg-scorva-hover transition-colors"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="flex-1 overflow-y-auto">

        {/* ── Hero banner ── */}
        <div className="relative overflow-hidden bg-scorva-surface border-b border-scorva-border px-6 md:px-10 py-10">
          <div className="absolute inset-0 cyber-grid pointer-events-none opacity-60" />
          <div className="absolute right-0 top-0 w-96 h-full bg-gradient-to-l from-scorva-accent/5 to-transparent pointer-events-none" />
          <div className="relative max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-scorva-accent/10 border border-scorva-accent/20 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-scorva-accent animate-pulse" />
                  <span className="text-[10px] font-mono text-scorva-accent tracking-widest uppercase">SSO Active</span>
                </div>
                <h1 className="text-2xl font-bold text-scorva-text font-mono tracking-wide">
                  App Factory
                </h1>
                <p className="text-sm text-scorva-muted mt-1">
                  Welcome back, <span className="text-scorva-text font-medium">{user?.name}</span>.
                  Launch any app with your active session.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-scorva-muted shrink-0">
                <span className="px-2 py-1 rounded bg-scorva-hover border border-scorva-border">
                  {apps.length} apps available
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="sticky top-0 z-10 bg-scorva-bg/90 backdrop-blur border-b border-scorva-border px-6 md:px-10 py-3">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-scorva-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Search apps, tags, teams…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-base pl-8 py-1.5 text-xs"
              />
            </div>
            {/* Team filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Tag size={12} className="text-scorva-muted shrink-0" />
              {teams.map(t => (
                <button
                  key={t}
                  onClick={() => setTeam(t)}
                  className={`text-[11px] font-mono px-2.5 py-1 rounded-md border transition-colors ${
                    team === t
                      ? 'bg-scorva-accent text-white dark:text-scorva-bg border-scorva-accent'
                      : 'bg-scorva-card border-scorva-border text-scorva-muted hover:border-scorva-accent/40 hover:text-scorva-text'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── App Grid ── */}
        <div className="max-w-5xl mx-auto px-6 md:px-10 py-8">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-scorva-muted gap-3">
              <Search size={32} className="opacity-30" />
              <p className="text-sm font-mono">No apps match your search</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {visible.map(app => {
                const Icon   = ICON_MAP[app.icon] || Shield;
                const colors = COLOR_MAP[app.color];
                const busy   = launching === app.id;
                return (
                  <div
                    key={app.id}
                    className={`card group flex flex-col transition-all duration-200 hover:shadow-lg ${colors.border} ${colors.glow}`}
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between p-5 pb-0">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${colors.icon}`}>
                          <Icon size={22} />
                        </div>
                        <div>
                          <h2 className="text-sm font-bold text-scorva-text font-mono tracking-widest uppercase">
                            {app.name}
                          </h2>
                          <p className="text-xs text-scorva-muted mt-0.5">{app.tagline}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-[10px] font-mono text-scorva-muted bg-scorva-hover px-2 py-0.5 rounded border border-scorva-border">
                          {app.team}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[9px] font-mono text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">Live</span>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-scorva-muted leading-relaxed px-5 pt-3 pb-0 flex-1">
                      {app.desc}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 px-5 pt-3">
                      {app.tags.map(tag => (
                        <span key={tag} className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${colors.badge}`}>
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Launch row */}
                    <div className="flex items-center justify-between px-5 py-4 mt-3 border-t border-scorva-border">
                      <a
                        href={app.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] font-mono text-scorva-muted hover:text-scorva-text transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink size={11} />
                        {app.url}
                      </a>
                      <button
                        onClick={() => handleLaunch(app)}
                        disabled={busy}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${colors.launch} disabled:opacity-60`}
                      >
                        {busy ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            Launching…
                          </>
                        ) : (
                          <>
                            Launch App
                            <ChevronRight size={13} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="max-w-5xl mx-auto px-6 md:px-10 pb-8 space-y-4">
            <div className="card p-5">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-sm font-bold text-scorva-text font-mono tracking-widest uppercase">Access Requests</h2>
                  <p className="text-xs text-scorva-muted mt-1">Requests from app landing pages queue here. Approval grants HUB plus the requested app when a matching user exists.</p>
                </div>
                <button onClick={loadAccessRequests} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-scorva-hover border border-scorva-border text-scorva-text hover:border-scorva-accent/40 transition-colors">
                  Refresh
                </button>
              </div>

              {requestLoading ? (
                <div className="text-xs font-mono text-scorva-muted">Loading requests...</div>
              ) : adminRequests.length === 0 ? (
                <div className="text-xs text-scorva-muted">No access requests yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-scorva-muted border-b border-scorva-border">
                        <th className="py-2 pr-3">User</th>
                        <th className="py-2 pr-3">App</th>
                        <th className="py-2 pr-3">Justification</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2">Review</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminRequests.map(entry => (
                        <tr key={entry.id} className="border-b border-scorva-border/60 align-top">
                          <td className="py-3 pr-3">
                            <div className="text-scorva-text font-medium">{entry.name}</div>
                            <div className="text-scorva-muted font-mono">{entry.username}</div>
                            <div className="text-scorva-muted">{entry.email}</div>
                          </td>
                          <td className="py-3 pr-3">
                            <div className="text-scorva-text font-medium">{entry.appLabel}</div>
                            <div className="text-scorva-muted">Submitted {new Date(entry.createdAt).toLocaleDateString()}</div>
                          </td>
                          <td className="py-3 pr-3 max-w-xs">
                            <div className="text-scorva-muted whitespace-pre-wrap">{entry.justification || 'No justification provided.'}</div>
                          </td>
                          <td className="py-3 pr-3">
                            <div className="text-scorva-text capitalize">{String(entry.status || '').replaceAll('_', ' ')}</div>
                            {entry.reviewedBy && (
                              <div className="text-scorva-muted">by {entry.reviewedBy}</div>
                            )}
                          </td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-2">
                              <button onClick={() => reviewRequest(entry.id, 'approved')} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                                Approve
                              </button>
                              <button onClick={() => reviewRequest(entry.id, 'denied')} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 border border-red-500/30 text-red-400">
                                Deny
                              </button>
                              {entry.status !== 'pending' && (
                                <button onClick={() => reviewRequest(entry.id, 'pending')} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-scorva-hover border border-scorva-border text-scorva-text">
                                  Re-open
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-sm font-bold text-scorva-text font-mono tracking-widest uppercase">Hub Access Admin</h2>
                  <p className="text-xs text-scorva-muted mt-1">HUB grants app launch rights. App-local roles still live in each application.</p>
                </div>
                <button onClick={loadAdminUsers} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-scorva-hover border border-scorva-border text-scorva-text hover:border-scorva-accent/40 transition-colors">
                  Refresh
                </button>
              </div>

              <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-5">
                <input className="input-base text-xs" placeholder="User ID" value={createForm.id} onChange={e => setCreateForm(f => ({ ...f, id: e.target.value }))} required />
                <input className="input-base text-xs" placeholder="Name" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} required />
                <input className="input-base text-xs" placeholder="Username" value={createForm.username} onChange={e => setCreateForm(f => ({ ...f, username: e.target.value.toLowerCase() }))} required />
                <input className="input-base text-xs" placeholder="Email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value.toLowerCase() }))} required />
                <input className="input-base text-xs" type="password" placeholder="Temporary password" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} required />
                <select className="input-base text-xs" value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}>
                  <option>Viewer</option>
                  <option>Site Admin</option>
                  <option>Corporate Admin</option>
                </select>
                <div className="md:col-span-6 flex flex-wrap gap-2">
                  {manageableApps.map(appId => (
                    <button
                      key={appId}
                      type="button"
                      onClick={() => toggleCreateApp(appId)}
                      className={`text-[11px] font-mono px-2.5 py-1 rounded-md border transition-colors ${
                        createForm.allowedApps.includes(appId)
                          ? 'bg-scorva-accent text-white dark:text-scorva-bg border-scorva-accent'
                          : 'bg-scorva-card border-scorva-border text-scorva-muted hover:border-scorva-accent/40 hover:text-scorva-text'
                      }`}
                    >
                      {appId}
                    </button>
                  ))}
                  <button type="submit" className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold bg-scorva-accent text-white dark:text-scorva-bg">
                    Create User
                  </button>
                </div>
              </form>

              {adminMessage && <div className="text-xs text-emerald-400 mb-3">{adminMessage}</div>}
              {adminError && <div className="text-xs text-red-400 mb-3">{adminError}</div>}

              {adminLoading ? (
                <div className="text-xs font-mono text-scorva-muted">Loading users...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-scorva-muted border-b border-scorva-border">
                        <th className="py-2 pr-3">User</th>
                        <th className="py-2 pr-3">Role</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">App Access</th>
                        <th className="py-2">Save</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsers.map(entry => (
                        <tr key={entry.id} className="border-b border-scorva-border/60 align-top">
                          <td className="py-3 pr-3">
                            <div className="text-scorva-text font-medium">{entry.name}</div>
                            <div className="text-scorva-muted font-mono">{entry.username}</div>
                          </td>
                          <td className="py-3 pr-3">
                            <div className="text-scorva-text">{entry.role}</div>
                            <div className="text-scorva-muted">{entry.email}</div>
                          </td>
                          <td className="py-3 pr-3">
                            <select
                              className="input-base text-xs"
                              value={entry.status}
                              onChange={e => setAdminUsers(current => current.map(userRow => userRow.id === entry.id ? { ...userRow, status: e.target.value } : userRow))}
                            >
                              <option>Active</option>
                              <option>Inactive</option>
                            </select>
                          </td>
                          <td className="py-3 pr-3">
                            <div className="flex flex-wrap gap-2">
                              {manageableApps.map(appId => (
                                <label key={appId} className="flex items-center gap-1.5 text-scorva-muted">
                                  <input
                                    type="checkbox"
                                    checked={entry.allowedApps.includes(appId)}
                                    onChange={() => toggleUserApp(entry.id, appId)}
                                  />
                                  <span className="font-mono">{appId}</span>
                                </label>
                              ))}
                            </div>
                          </td>
                          <td className="py-3">
                            <button
                              onClick={() => saveUserAccess(entry)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-scorva-hover border border-scorva-border text-scorva-text hover:border-scorva-accent/40 transition-colors"
                            >
                              Save
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SSO info footer ── */}
        <div className="max-w-5xl mx-auto px-6 md:px-10 pb-10">
          <div className="card p-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-scorva-accent/5 border-scorva-accent/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-scorva-accent/10 border border-scorva-accent/20">
                <Shield size={14} className="text-scorva-accent" />
              </div>
              <div>
                <p className="text-xs font-semibold text-scorva-text">SSO Session Active</p>
                <p className="text-[10px] text-scorva-muted mt-0.5">
                  Your hub credentials automatically authenticate you into supported apps.
                  Tokens expire after 60 seconds — a new one is issued on each launch.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono text-scorva-muted shrink-0">
              <ArrowRight size={10} />
              SSO via one-time token
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
