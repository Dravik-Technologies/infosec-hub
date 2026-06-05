import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Shield, Users, Sun, Moon, LogOut, ArrowLeft,
  RefreshCw, UserPlus, ClipboardList, ChevronDown, ChevronUp,
  MapPin,
} from 'lucide-react';

const BASE = import.meta.env.DEV ? 'http://localhost:3010' : '';

const STATUS_BADGE = {
  pending:              'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  approved:             'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  denied:               'bg-red-500/10    text-red-400    border-red-500/30',
  approved_pending_user:'bg-blue-500/10   text-blue-400   border-blue-500/30',
};

const TABS = [
  { id: 'requests', label: 'Access Requests', icon: ClipboardList },
  { id: 'users',    label: 'Users',           icon: Users },
];

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h2 className="text-sm font-black text-scorva-text font-mono tracking-widest uppercase">{title}</h2>
        {subtitle && <p className="text-xs text-scorva-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function FieldLabel({ children }) {
  return <label className="block text-[10px] font-mono font-medium text-scorva-muted mb-1 tracking-widest uppercase">{children}</label>;
}

export default function AccessAdmin() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();

  const currentHubRole = user?.hubRole || user?.role;
  const isHubAdmin = currentHubRole === 'Hub Admin';
  const canAdmin   = isHubAdmin;

  const [tab,          setTab]          = useState('requests');
  const [users,        setUsers]        = useState([]);
  const [requests,     setRequests]     = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [reqLoading,   setReqLoading]   = useState(false);
  const [message,      setMessage]      = useState('');
  const [error,        setError]        = useState('');
  const [expandedUser, setExpandedUser] = useState(null);
  const [expandedSites, setExpandedSites] = useState({});
  const [expandedRoles, setExpandedRoles] = useState({});

  const [meta, setMeta] = useState({
    platformRoles: [], securityRoles: [], securityRoleTitles: {},
    securityRoleApps: {}, allApps: [], sites: [],
  });

  const blankCreate = {
    id: '', name: '', username: '', email: '', password: '',
    role: 'Hub Viewer', securityRole: '', siteId: '', siteIds: [], allowedApps: ['hub'],
  };
  const [createForm, setCreateForm] = useState(blankCreate);

  useEffect(() => {
    if (!canAdmin) { navigate('/portal', { replace: true }); return; }
    loadMeta();
    loadUsers();
    loadRequests();
  }, [canAdmin]);

  async function loadMeta() {
    try {
      const res  = await fetch(`${BASE}/api/admin/identity-meta`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setMeta(data);
    } catch {}
  }

  async function loadUsers() {
    setUsersLoading(true); setError('');
    try {
      const res  = await fetch(`${BASE}/api/admin/users`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load users');
      setUsers(data.users || []);
    } catch (err) { setError(err.message); }
    finally { setUsersLoading(false); }
  }

  async function loadRequests() {
    setReqLoading(true); setError('');
    try {
      const res  = await fetch(`${BASE}/api/admin/access-requests`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load access requests');
      setRequests(data.requests || []);
    } catch (err) { setError(err.message); }
    finally { setReqLoading(false); }
  }

  async function saveUser(entry) {
    setError(''); setMessage('');
    try {
      const payload = {
        status:       entry.status,
        securityRole: entry.securityRole || null,
        siteId:       entry.siteId || null,
        siteIds:      Array.isArray(entry.siteIds) ? entry.siteIds.filter(Boolean) : [],
        allowedApps:  Array.isArray(entry.allowedApps) ? entry.allowedApps.filter(Boolean) : [],
      };
      if (isHubAdmin) payload.role = entry.role;
      const res  = await fetch(`${BASE}/api/admin/users/${encodeURIComponent(entry.id)}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to save user');
      setUsers(cur => cur.map(u => u.id === entry.id ? data.user : u));
      setMessage(`Saved ${entry.username}.`);
    } catch (err) { setError(err.message); }
  }

  async function createUser(e) {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      const payload = {
        ...createForm,
        siteId:       createForm.siteId || null,
        siteIds:      createForm.siteId ? [...new Set([createForm.siteId, ...createForm.siteIds].filter(Boolean))] : createForm.siteIds,
        securityRole: createForm.securityRole || null,
        allowedApps:  Array.isArray(createForm.allowedApps) ? createForm.allowedApps.filter(Boolean) : [],
      };
      const res  = await fetch(`${BASE}/api/admin/users`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to create user');
      setUsers(cur => [data.user, ...cur]);
      if (Array.isArray(data.fulfilledRequests) && data.fulfilledRequests.length) {
        setRequests(cur => cur.map(r => {
          const match = data.fulfilledRequests.find(f => f.id === r.id);
          return match || r;
        }));
      }
      setCreateForm(blankCreate);
      setMessage(`Created ${data.user.username}.`);
    } catch (err) { setError(err.message); }
  }

  async function reviewRequest(id, status) {
    setError(''); setMessage('');
    try {
      const res  = await fetch(`${BASE}/api/admin/access-requests/${encodeURIComponent(id)}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to review request');
      setRequests(cur => cur.map(r => r.id === id ? data.request : r));
      if (data.user) setUsers(cur => cur.map(u => u.id === data.user.id ? data.user : u));
      setMessage(data.message || `Request ${status}.`);
    } catch (err) { setError(err.message); }
  }

  function patchUser(userId, patch) {
    setUsers(cur => cur.map(u => u.id !== userId ? u : { ...u, ...patch }));
  }

  function toggleSiteAccess(userId, siteId, checked) {
    setUsers(cur => cur.map(u => {
      if (u.id !== userId) return u;
      const next = checked
        ? [...new Set([...(u.siteIds || []), siteId])]
        : (u.siteIds || []).filter(s => s !== siteId);
      return { ...u, siteIds: next };
    }));
  }

  function toggleCreateSite(siteId, checked) {
    setCreateForm(f => {
      const next = checked
        ? [...new Set([...(f.siteIds || []), siteId])]
        : (f.siteIds || []).filter(s => s !== siteId);
      return { ...f, siteIds: next };
    });
  }

  function toggleUserApp(userId, appId, checked) {
    setUsers(cur => cur.map(u => {
      if (u.id !== userId) return u;
      const next = checked
        ? [...new Set([...(u.allowedApps || []), appId])]
        : (u.allowedApps || []).filter(a => a !== appId);
      return { ...u, allowedApps: next.includes('hub') ? next : ['hub', ...next] };
    }));
  }

  function toggleCreateApp(appId, checked) {
    setCreateForm(f => {
      const next = checked
        ? [...new Set([...(f.allowedApps || []), appId])]
        : (f.allowedApps || []).filter(a => a !== appId);
      return { ...f, allowedApps: next.includes('hub') ? next : ['hub', ...next] };
    });
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const { platformRoles, securityRoles, securityRoleTitles, securityRoleApps, sites, allApps } = meta;

  function derivedTitle(securityRole) {
    return securityRoleTitles[securityRole] || securityRole || '';
  }

  function suggestedApps(securityRole) {
    const apps = securityRoleApps[securityRole] || ['hub'];
    return apps.includes('hub') ? apps : ['hub', ...apps];
  }

  function applyRoleDefaultsToUser(entry) {
    patchUser(entry.id, {
      allowedApps: suggestedApps(entry.securityRole),
    });
  }

  function applyRoleDefaultsToCreate() {
    setCreateForm(f => ({
      ...f,
      allowedApps: suggestedApps(f.securityRole),
    }));
  }

  const groupedUsers = useMemo(() => {
    const siteLabelById = Object.fromEntries(sites.map(s => [s.id, s.label]));
    const groups = new Map();
    for (const entry of users) {
      const siteKey = entry.siteId || 'UNASSIGNED';
      const siteLabel = entry.siteId ? `${entry.siteId} — ${siteLabelById[entry.siteId] || entry.siteId}` : 'Unassigned Users';
      if (!groups.has(siteKey)) {
        groups.set(siteKey, { siteKey, siteLabel, roles: new Map(), count: 0 });
      }
      const siteGroup = groups.get(siteKey);
      const roleKey = entry.role || 'Hub Viewer';
      if (!siteGroup.roles.has(roleKey)) siteGroup.roles.set(roleKey, []);
      siteGroup.roles.get(roleKey).push(entry);
      siteGroup.count += 1;
    }
    return [...groups.values()]
      .sort((a, b) => a.siteLabel.localeCompare(b.siteLabel))
      .map(group => ({
        ...group,
        roles: [...group.roles.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([roleKey, members]) => ({ roleKey, members })),
      }));
  }, [users, sites]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-scorva-bg">

      {/* ── Header ── */}
      <header className="flex items-center justify-between h-14 px-4 md:px-6 bg-scorva-surface/80 backdrop-blur-xl border-b border-scorva-border shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/portal')} className="flex items-center gap-1.5 text-xs font-mono text-scorva-muted hover:text-scorva-accent transition-colors mr-1">
            <ArrowLeft size={13} /> Portal
          </button>
          <div className="w-px h-4 bg-scorva-border" />
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-scorva-accent/10 border border-scorva-accent/30 glow-border">
              <Shield size={13} className="text-scorva-accent" />
            </div>
            <div>
              <div className="text-xs font-black font-mono tracking-[0.2em] text-scorva-accent uppercase leading-none text-glow">Hub Admin Console</div>
              <div className="text-[10px] text-scorva-muted font-mono leading-none mt-0.5">MTSI Hub</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggle} className="p-1.5 rounded-md text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover transition-colors">
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <div className="flex items-center gap-2 pl-2 ml-1 border-l border-scorva-border">
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-xs font-semibold text-scorva-text">{user?.name}</span>
              <span className="text-[10px] text-scorva-muted font-mono">{currentHubRole}</span>
            </div>
            <button onClick={logout} className="p-1.5 rounded-md text-scorva-muted hover:text-red-500 hover:bg-scorva-hover transition-colors">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-8">

          {/* Page title */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-5 h-[2px] bg-scorva-accent" />
              <span className="text-[10px] font-mono text-scorva-accent uppercase tracking-[0.35em]">Administration</span>
            </div>
                <h1 className="text-2xl font-black text-scorva-text font-mono tracking-wide text-glow">Identity Control Plane</h1>
            <p className="text-sm text-scorva-muted mt-1 mb-5">Manage access requests, users, site assignments, and job roles from a single control surface.</p>

            {/* Identity model legend */}
            <div className="glass border border-scorva-border rounded-xl p-4 glow-border-strong">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-px bg-scorva-accent" />
                <span className="text-[9px] font-mono text-scorva-accent uppercase tracking-[0.3em] font-semibold">Identity Model — Managed Fields</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {[
                  { label: 'HUB Role',        desc: 'Hub admin authority',           color: 'text-scorva-accent border-scorva-accent/20 bg-scorva-accent/10' },
                  { label: 'Job Role',        desc: 'Operational role & title',      color: 'text-teal-400 border-teal-500/20 bg-teal-500/10' },
                  { label: 'Status',          desc: 'Account active state',          color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' },
                  { label: 'Allowed Apps',    desc: 'Explicit user app grants',      color: 'text-scorva-muted border-scorva-border bg-scorva-hover' },
                  { label: 'Primary Site',    desc: 'Default site context',          color: 'text-scorva-muted border-scorva-border bg-scorva-hover' },
                  { label: 'Site Access',     desc: 'All assigned site memberships', color: 'text-scorva-muted border-scorva-border bg-scorva-hover' },
                ].map(({ label, desc, color }) => (
                  <div key={label} className={`rounded-lg border px-2.5 py-2 ${color}`}>
                    <div className="text-[9px] font-mono font-semibold tracking-widest uppercase">{label}</div>
                    <div className="text-[9px] text-scorva-muted mt-0.5">{desc}</div>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-scorva-muted font-mono mt-2.5">
                HUB Role controls admin authority. Job Role describes the mission function. App access is explicitly granted per user. Only Hub Admin can see all sites.
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-scorva-border mb-6">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              const count  = id === 'requests' ? pendingCount : 0;
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold font-mono transition-colors border-b-2 -mb-px tracking-wide ${
                    active ? 'border-scorva-accent text-scorva-accent' : 'border-transparent text-scorva-muted hover:text-scorva-text'
                  }`}
                >
                  <Icon size={13} />
                  {label}
                  {count > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-scorva-accent text-white dark:text-scorva-bg text-[10px] font-black">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
            {isHubAdmin && (
              <button
                onClick={() => setTab('create')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold font-mono transition-colors border-b-2 -mb-px tracking-wide ${
                  tab === 'create' ? 'border-scorva-accent text-scorva-accent' : 'border-transparent text-scorva-muted hover:text-scorva-text'
                }`}
              >
                <UserPlus size={13} /> Create User
              </button>
            )}
          </div>

          {/* Feedback */}
          {message && (
            <div className="mb-4 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 font-mono">
              {message}
            </div>
          )}
          {error && (
            <div className="mb-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 font-mono">
              {error}
            </div>
          )}

          {/* ── Access Requests ── */}
          {tab === 'requests' && (
            <div className="card p-5">
              <SectionHeader
                title="Access Requests"
                subtitle="Requests from app landing pages. Approval grants the requested application directly to the selected user account."
                action={
                  <button onClick={loadRequests} disabled={reqLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-scorva-hover border border-scorva-border text-scorva-text hover:border-scorva-accent/40 transition-colors disabled:opacity-60">
                    <RefreshCw size={12} className={reqLoading ? 'animate-spin' : ''} /> Refresh
                  </button>
                }
              />

              {reqLoading ? (
                <p className="text-xs font-mono text-scorva-muted py-4">Loading requests…</p>
              ) : requests.length === 0 ? (
                <p className="text-xs text-scorva-muted py-4">No access requests yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left border-b border-scorva-border">
                        {['Requestor', 'App', 'Justification', 'Status', 'Review'].map(h => (
                          <th key={h} className="py-2 pr-4 text-[10px] font-mono text-scorva-muted uppercase tracking-widest font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map(entry => (
                        <tr key={entry.id} className="border-b border-scorva-border/50 align-top hover:bg-scorva-hover/30 transition-colors">
                          <td className="py-3 pr-4">
                            <div className="text-scorva-text font-semibold">{entry.name}</div>
                            <div className="text-scorva-muted font-mono text-[10px]">{entry.username}</div>
                            <div className="text-scorva-muted text-[10px]">{entry.email}</div>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="text-scorva-text font-semibold">{entry.appLabel}</div>
                            <div className="text-scorva-muted text-[10px]">{new Date(entry.createdAt).toLocaleDateString()}</div>
                          </td>
                          <td className="py-3 pr-4 max-w-xs">
                            <p className="text-scorva-muted whitespace-pre-wrap text-[11px] leading-relaxed">
                              {entry.justification || 'No justification provided.'}
                            </p>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-mono font-semibold capitalize ${STATUS_BADGE[entry.status] || 'bg-scorva-hover text-scorva-muted border-scorva-border'}`}>
                              {String(entry.status || '').replaceAll('_', ' ')}
                            </span>
                            {entry.reviewedBy && <div className="text-scorva-muted text-[10px] mt-1">by {entry.reviewedBy}</div>}
                          </td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-2">
                              <button onClick={() => reviewRequest(entry.id, 'approved')} className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors">Approve</button>
                              <button onClick={() => reviewRequest(entry.id, 'denied')} className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors">Deny</button>
                              {entry.status !== 'pending' && (
                                <button onClick={() => reviewRequest(entry.id, 'pending')} className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-scorva-hover border border-scorva-border text-scorva-text hover:border-scorva-accent/40 transition-colors">Re-open</button>
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
          )}

          {/* ── Users ── */}
          {tab === 'users' && (
            <div className="space-y-3">
              <div className="card p-5">
                <SectionHeader
                  title="Users"
                  subtitle="Manage HUB role, job role, app access, and site assignments in a site-first hierarchy."
                  action={
                    <button onClick={loadUsers} disabled={usersLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-scorva-hover border border-scorva-border text-scorva-text hover:border-scorva-accent/40 transition-colors disabled:opacity-60">
                      <RefreshCw size={12} className={usersLoading ? 'animate-spin' : ''} /> Refresh
                    </button>
                  }
                />

                {usersLoading ? (
                  <p className="text-xs font-mono text-scorva-muted py-4">Loading users…</p>
                ) : (
                  <div className="space-y-3">
                    {groupedUsers.map(siteGroup => {
                      const siteOpen = expandedSites[siteGroup.siteKey] ?? true;
                      return (
                        <div key={siteGroup.siteKey} className="border border-scorva-border rounded-xl overflow-hidden">
                          <button
                            onClick={() => setExpandedSites(cur => ({ ...cur, [siteGroup.siteKey]: !siteOpen }))}
                            className="w-full flex items-center justify-between px-4 py-3 bg-scorva-hover/30 hover:bg-scorva-hover/50 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border bg-scorva-accent/10 text-scorva-accent border-scorva-accent/20">
                                <MapPin size={10} /> {siteGroup.siteLabel}
                              </span>
                              <span className="text-[10px] font-mono text-scorva-muted">{siteGroup.count} users</span>
                            </div>
                            {siteOpen ? <ChevronUp size={14} className="text-scorva-muted" /> : <ChevronDown size={14} className="text-scorva-muted" />}
                          </button>

                          {siteOpen && (
                            <div className="p-3 space-y-3">
                              {siteGroup.roles.map(roleGroup => {
                                const rolePath = `${siteGroup.siteKey}:${roleGroup.roleKey}`;
                                const roleOpen = expandedRoles[rolePath] ?? true;
                                return (
                                  <div key={rolePath} className="border border-scorva-border/70 rounded-xl overflow-hidden">
                                    <button
                                      onClick={() => setExpandedRoles(cur => ({ ...cur, [rolePath]: !roleOpen }))}
                                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-scorva-hover/30 transition-colors"
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-scorva-hover text-scorva-text border-scorva-border">
                                          {roleGroup.roleKey}
                                        </span>
                                        <span className="text-[10px] font-mono text-scorva-muted">{roleGroup.members.length} users</span>
                                      </div>
                                      {roleOpen ? <ChevronUp size={14} className="text-scorva-muted" /> : <ChevronDown size={14} className="text-scorva-muted" />}
                                    </button>

                                    {roleOpen && (
                                      <div className="space-y-2 p-2">
                                        {roleGroup.members.map(entry => {
                                          const isExpanded = expandedUser === entry.id;
                                          return (
                                            <div key={entry.id} className="border border-scorva-border rounded-xl overflow-hidden hover:border-scorva-accent/20 transition-colors">
                                              <button
                                                onClick={() => setExpandedUser(isExpanded ? null : entry.id)}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-scorva-hover/40 transition-colors"
                                              >
                                                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-scorva-accent/10 border border-scorva-accent/20 text-xs font-black text-scorva-accent font-mono shrink-0">
                                                  {entry.name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="w-44 shrink-0 min-w-0">
                                                  <div className="text-sm font-semibold text-scorva-text truncate">{entry.name}</div>
                                                  <div className="text-[10px] font-mono text-scorva-muted truncate">@{entry.username}</div>
                                                  {entry.title && <div className="text-[10px] text-teal-400 truncate">{entry.title}</div>}
                                                </div>
                                                <div className="flex-1 hidden sm:flex items-center gap-1.5 flex-wrap min-w-0">
                                                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${entry.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                                    {entry.status}
                                                  </span>
                                                  {entry.securityRole ? (
                                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-teal-500/10 text-teal-400 border-teal-500/20 shrink-0">
                                                      {entry.securityRole}
                                                    </span>
                                                  ) : (
                                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-scorva-hover text-scorva-border border-scorva-border/50 shrink-0">
                                                      No Job Role
                                                    </span>
                                                  )}
                                                  {(entry.allowedApps || []).map(appId => (
                                                    <span key={appId} className={`text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${appId === 'hub' ? 'bg-scorva-accent/10 text-scorva-accent border-scorva-accent/20' : 'bg-scorva-hover border-scorva-border text-scorva-muted'}`}>
                                                      {appId}
                                                    </span>
                                                  ))}
                                                  {entry.canSeeAllSites && (
                                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-yellow-500/10 text-yellow-400 border-yellow-500/20 shrink-0">All Sites</span>
                                                  )}
                                                </div>
                                                <div className="shrink-0 ml-auto">
                                                  {isExpanded ? <ChevronUp size={14} className="text-scorva-muted" /> : <ChevronDown size={14} className="text-scorva-muted" />}
                                                </div>
                                              </button>

                                              {isExpanded && (
                                                <div className="px-4 pb-5 pt-3 border-t border-scorva-accent/15 bg-scorva-bg/60">
                                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                                                    <div className="space-y-3">
                                                      <div className="flex items-center gap-2 pb-1.5 border-b border-scorva-border/60 mb-3">
                                                        <div className="w-2 h-px bg-scorva-accent" />
                                                        <span className="text-[9px] font-mono text-scorva-accent uppercase tracking-[0.3em] font-medium">Hub Access</span>
                                                      </div>
                                                      <div>
                                                        <FieldLabel>HUB Role</FieldLabel>
                                                        <select className="input-base text-xs" value={entry.role} onChange={e => patchUser(entry.id, { role: e.target.value })}>
                                                          {platformRoles.map(r => <option key={r}>{r}</option>)}
                                                        </select>
                                                      </div>
                                                      <div>
                                                        <FieldLabel>Status</FieldLabel>
                                                        <select className="input-base text-xs" value={entry.status} onChange={e => patchUser(entry.id, { status: e.target.value })}>
                                                          <option>Active</option>
                                                          <option>Inactive</option>
                                                        </select>
                                                      </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                      <div className="flex items-center gap-2 pb-1.5 border-b border-scorva-border/60 mb-3">
                                                        <div className="w-2 h-px bg-teal-400" />
                                                        <span className="text-[9px] font-mono text-teal-400 uppercase tracking-[0.3em] font-medium">Job Role</span>
                                                      </div>
                                                      <div>
                                                        <FieldLabel>Job Role</FieldLabel>
                                                        <select
                                                          className="input-base text-xs"
                                                          value={entry.securityRole || ''}
                                                          onChange={e => patchUser(entry.id, {
                                                            securityRole: e.target.value || null,
                                                            defaultAllowedApps: suggestedApps(e.target.value || null),
                                                          })}
                                                        >
                                                          <option value="">— None —</option>
                                                          {securityRoles.map(r => <option key={r} value={r}>{r}</option>)}
                                                        </select>
                                                      </div>
                                                      <button onClick={() => applyRoleDefaultsToUser(entry)} className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-teal-500/10 border border-teal-500/30 text-teal-400 hover:bg-teal-500/20 transition-colors">
                                                        Apply Suggested Apps
                                                      </button>
                                                    </div>

                                                    <div className="space-y-3">
                                                      <div className="flex items-center gap-2 pb-1.5 border-b border-scorva-border/60 mb-3">
                                                        <div className="w-2 h-px bg-scorva-accent" />
                                                        <span className="text-[9px] font-mono text-scorva-accent uppercase tracking-[0.3em] font-medium">Site Access</span>
                                                      </div>
                                                      <div>
                                                        <FieldLabel>Primary Site</FieldLabel>
                                                        <select
                                                          className="input-base text-xs font-mono"
                                                          value={entry.siteId || ''}
                                                          onChange={e => {
                                                            const val = e.target.value;
                                                            patchUser(entry.id, {
                                                              siteId: val || null,
                                                              siteIds: val ? [...new Set([val, ...(entry.siteIds || [])])] : entry.siteIds,
                                                            });
                                                          }}
                                                        >
                                                          <option value="">— None —</option>
                                                          {sites.map(s => <option key={s.id} value={s.id}>{s.id} — {s.label}</option>)}
                                                        </select>
                                                      </div>
                                                      <div>
                                                        <FieldLabel>Site Membership</FieldLabel>
                                                        <div className="space-y-1.5 mt-1 max-h-32 overflow-y-auto pr-1">
                                                          {sites.map(s => (
                                                            <label key={s.id} className="flex items-center gap-2 cursor-pointer hover:text-scorva-text transition-colors">
                                                              <input
                                                                type="checkbox"
                                                                checked={(entry.siteIds || []).includes(s.id)}
                                                                onChange={e => toggleSiteAccess(entry.id, s.id, e.target.checked)}
                                                                className="rounded"
                                                              />
                                                              <span className="text-xs font-mono text-scorva-muted">{s.id}</span>
                                                              <span className="text-[10px] text-scorva-border">{s.label}</span>
                                                            </label>
                                                          ))}
                                                        </div>
                                                      </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                      <div className="flex items-center gap-2 pb-1.5 border-b border-scorva-border/60 mb-3">
                                                        <div className="w-2 h-px bg-scorva-accent" />
                                                        <span className="text-[9px] font-mono text-scorva-accent uppercase tracking-[0.3em] font-medium">App Access</span>
                                                      </div>
                                                      <p className="text-[9px] text-scorva-muted font-mono">Highlight the apps this user can access. HUB stays enabled.</p>
                                                      <div className="flex flex-wrap gap-1.5">
                                                        {allApps.map(appId => {
                                                          const selected = (entry.allowedApps || []).includes(appId);
                                                          const suggested = (entry.defaultAllowedApps || []).includes(appId);
                                                          return (
                                                            <label
                                                              key={appId}
                                                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-mono cursor-pointer transition-colors ${
                                                                selected
                                                                  ? 'bg-scorva-accent/10 text-scorva-accent border-scorva-accent/30'
                                                                  : suggested
                                                                    ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                                                                    : 'bg-scorva-hover text-scorva-muted border-scorva-border'
                                                              }`}
                                                            >
                                                              <input
                                                                type="checkbox"
                                                                checked={selected}
                                                                disabled={appId === 'hub'}
                                                                onChange={e => toggleUserApp(entry.id, appId, e.target.checked)}
                                                              />
                                                              {appId}
                                                            </label>
                                                          );
                                                        })}
                                                      </div>
                                                      <div className="pt-2">
                                                        <button onClick={() => saveUser(entry)} className="btn-primary text-xs glow-border">
                                                          Save Changes
                                                        </button>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Create User (Hub Admin only) ── */}
          {tab === 'create' && isHubAdmin && (
            <div className="card p-5">
              <SectionHeader
                title="Create User"
                subtitle="Provision a new HUB account, assign sites, job role, and explicit application access."
              />

              <form onSubmit={createUser} className="space-y-6 max-w-3xl">

                {/* Identity */}
                <div>
                  <div className="flex items-center gap-2 pb-1.5 border-b border-scorva-border/60 mb-3">
                    <div className="w-2 h-px bg-scorva-accent" />
                    <span className="text-[9px] font-mono text-scorva-accent uppercase tracking-[0.3em] font-medium">Identity</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>User ID</FieldLabel>
                      <input className="input-base text-xs font-mono" placeholder="jdoe-001" value={createForm.id} onChange={e => setCreateForm(f => ({ ...f, id: e.target.value }))} required />
                    </div>
                    <div>
                      <FieldLabel>Full Name</FieldLabel>
                      <input className="input-base text-xs" placeholder="Jane Doe" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} required />
                    </div>
                    <div>
                      <FieldLabel>Username</FieldLabel>
                      <input className="input-base text-xs font-mono" placeholder="jdoe" value={createForm.username} onChange={e => setCreateForm(f => ({ ...f, username: e.target.value.toLowerCase() }))} required />
                    </div>
                    <div>
                      <FieldLabel>Email</FieldLabel>
                      <input className="input-base text-xs" type="email" placeholder="jdoe@example.com" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value.toLowerCase() }))} required />
                    </div>
                    <div>
                      <FieldLabel>Temporary Password</FieldLabel>
                      <input className="input-base text-xs font-mono" type="password" placeholder="••••••••" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} required />
                    </div>
                  </div>
                </div>

                {/* Platform + Job Role */}
                <div>
                  <div className="flex items-center gap-2 pb-1.5 border-b border-scorva-border/60 mb-3">
                    <div className="w-2 h-px bg-scorva-accent" />
                    <span className="text-[9px] font-mono text-scorva-accent uppercase tracking-[0.3em] font-medium">Roles</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>HUB Role</FieldLabel>
                      <select className="input-base text-xs" value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}>
                        {platformRoles.map(r => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <FieldLabel>Job Role</FieldLabel>
                      <select className="input-base text-xs" value={createForm.securityRole} onChange={e => setCreateForm(f => ({ ...f, securityRole: e.target.value }))}>
                        <option value="">— None —</option>
                        {securityRoles.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2 flex items-center gap-2">
                      <button type="button" onClick={applyRoleDefaultsToCreate} className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-teal-500/10 border border-teal-500/30 text-teal-400 hover:bg-teal-500/20 transition-colors">
                        Apply Suggested Apps
                      </button>
                      {createForm.securityRole && (
                        <span className="text-[10px] font-mono text-scorva-muted">Display title: {derivedTitle(createForm.securityRole)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Site Access */}
                <div>
                  <div className="flex items-center gap-2 pb-1.5 border-b border-scorva-border/60 mb-3">
                    <div className="w-2 h-px bg-scorva-accent" />
                    <span className="text-[9px] font-mono text-scorva-accent uppercase tracking-[0.3em] font-medium">Site Access</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>Primary Site</FieldLabel>
                      <select
                        className="input-base text-xs font-mono"
                        value={createForm.siteId}
                        onChange={e => setCreateForm(f => ({
                          ...f,
                          siteId: e.target.value,
                          siteIds: e.target.value ? [...new Set([e.target.value, ...f.siteIds].filter(Boolean))] : f.siteIds,
                        }))}
                      >
                        <option value="">— None —</option>
                        {sites.map(s => <option key={s.id} value={s.id}>{s.id} — {s.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <FieldLabel>Site Membership</FieldLabel>
                      <div className="space-y-1.5 mt-1">
                        {sites.map(s => (
                          <label key={s.id} className="flex items-center gap-2 cursor-pointer hover:text-scorva-text transition-colors">
                            <input
                              type="checkbox"
                              checked={createForm.siteIds.includes(s.id)}
                              onChange={e => toggleCreateSite(s.id, e.target.checked)}
                              className="rounded"
                            />
                            <span className="text-xs font-mono text-scorva-muted">{s.id}</span>
                            <span className="text-[10px] text-scorva-border">{s.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 pb-1.5 border-b border-scorva-border/60 mb-3">
                    <div className="w-2 h-px bg-scorva-accent" />
                    <span className="text-[9px] font-mono text-scorva-accent uppercase tracking-[0.3em] font-medium">App Access</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {allApps.map(appId => {
                      const selected = createForm.allowedApps.includes(appId);
                      const suggested = suggestedApps(createForm.securityRole).includes(appId);
                      return (
                        <label
                          key={appId}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-mono cursor-pointer transition-colors ${
                            selected
                              ? 'bg-scorva-accent/10 text-scorva-accent border-scorva-accent/30'
                              : suggested
                                ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                                : 'bg-scorva-hover text-scorva-muted border-scorva-border'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={appId === 'hub'}
                            onChange={e => toggleCreateApp(appId, e.target.checked)}
                          />
                          {appId}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2">
                  <button type="submit" className="btn-primary glow-border">
                    <UserPlus size={14} /> Create User
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
