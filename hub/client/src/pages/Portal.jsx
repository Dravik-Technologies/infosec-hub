import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Shield, ShieldCheck, FileText, BarChart3, Flame,
  Sun, Moon, LogOut, ArrowRight, Settings2, Command,
  Search, Tag, ChevronRight, Loader2, MapPin,
} from 'lucide-react';

const ICON_MAP = { ShieldCheck, FileText, BarChart3, Shield, Flame, Command };

const APPS = [
  {
    id: 'scorva', name: 'SCORVA', tagline: 'Cyber Command Center',
    desc: 'NIST SP 800-53 Rev 5 compliance management — ATO tracking, continuous monitoring, POAM, asset inventory, and access governance.',
    url: 'http://localhost:3000', ssoPath: '/auth/sso',
    color: 'teal', icon: 'ShieldCheck', team: 'Cybersecurity', status: 'live',
    tags: ['NIST 800-53', 'RMF', 'ATO', 'ConMon', 'POAM'],
  },
  {
    id: 'crater', name: 'CRATER', tagline: 'eMASS RMF Toolkit',
    desc: 'eMASS-aligned RMF package builder with SCTM, POAM management, vulnerability tracking, system diagrams, and compliance reporting.',
    url: 'http://localhost:3003', ssoPath: '/sso.html',
    color: 'indigo', icon: 'FileText', team: 'GRC', status: 'live',
    tags: ['eMASS', 'RMF', 'SCTM', 'POAM', 'Vulnerabilities'],
  },
  {
    id: 'mash', name: 'MASH', tagline: 'MTSI Advanced Sentinel Hub',
    desc: 'Security Managers Workspace shell for the upcoming facility, personnel, and activities-security rebuild that will feed NEXUS.',
    url: 'http://localhost:8080', ssoPath: '/auth/sso',
    color: 'gold', icon: 'BarChart3', team: 'Security Operations', status: 'transition',
    tags: ['Facility Security', 'Personnel Security', 'Activities Security'],
  },
  {
    id: 'lava', name: 'LAVA', tagline: 'Network Access Portal',
    desc: 'Magmatic onboarding portal with digitized DD Form 2875 SAAR workflow, Vulcan approval command, and hardware asset provisioning.',
    url: 'http://localhost:3002', ssoPath: '/auth/sso',
    color: 'orange', icon: 'Flame', team: 'Network Administration', status: 'live',
    tags: ['SAAR', 'DD Form 2875', 'Access Control', 'Hardware', 'YubiKey'],
  },
  {
    id: 'nexus', name: 'NEXUS', tagline: 'Program Mission Command',
    desc: 'Executive command surface for program management, program security, and SCORVA-fed IT and cybersecurity rollups.',
    url: 'http://localhost:8090', ssoPath: '/auth/sso',
    color: 'cyan', icon: 'Command', team: 'Program Management', status: 'live',
    tags: ['Real Estate', 'Construction', 'Accreditation', 'Budget', 'Cyber Rollup'],
  },
];

const COLOR_MAP = {
  teal: {
    border:  'border-teal-500/20 hover:border-teal-500/50',
    icon:    'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20',
    badge:   'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20',
    launch:  'bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/20 hover:border-teal-500/50',
    top:     'bg-teal-500',
    glow:    'hover:shadow-[0_4px_32px_rgb(20_184_166/0.12)]',
  },
  indigo: {
    border:  'border-indigo-500/20 hover:border-indigo-500/50',
    icon:    'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
    badge:   'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
    launch:  'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:border-indigo-500/50',
    top:     'bg-indigo-500',
    glow:    'hover:shadow-[0_4px_32px_rgb(99_102_241/0.12)]',
  },
  gold: {
    border:  'border-yellow-500/20 hover:border-yellow-500/50',
    icon:    'bg-scorva-gold/10 text-scorva-gold border border-scorva-gold/20',
    badge:   'bg-scorva-gold/10 text-scorva-gold border border-scorva-gold/20',
    launch:  'bg-scorva-gold/10 hover:bg-scorva-gold/20 text-scorva-gold border border-scorva-gold/20 hover:border-yellow-500/50',
    top:     'bg-yellow-500',
    glow:    'hover:shadow-[0_4px_32px_rgb(234_179_8/0.12)]',
  },
  orange: {
    border:  'border-orange-500/20 hover:border-orange-500/50',
    icon:    'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20',
    badge:   'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20',
    launch:  'bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/20 hover:border-orange-500/50',
    top:     'bg-orange-500',
    glow:    'hover:shadow-[0_4px_32px_rgb(249_115_22/0.12)]',
  },
  cyan: {
    border:  'border-cyan-500/20 hover:border-cyan-500/50',
    icon:    'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20',
    badge:   'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20',
    launch:  'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 hover:border-cyan-500/50',
    top:     'bg-cyan-500',
    glow:    'hover:shadow-[0_4px_32px_rgb(6_182_212/0.12)]',
  },
};

export default function Portal() {
  const { user, logout, launchApp } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [search,    setSearch]    = useState('');
  const [team,      setTeam]      = useState('All');
  const [launching, setLaunching] = useState(null);
  const [apps,      setApps]      = useState(APPS);

  const teams    = ['All', ...new Set(apps.map(a => a.team))];
  const canAdmin = user?.role === 'Corporate Admin' || user?.role === 'Access Admin';
  const siteLabel = user?.siteId || (Array.isArray(user?.siteIds) && user.siteIds.length > 1
    ? `${user.siteIds.length} sites` : null);

  useEffect(() => {
    const BASE = import.meta.env.DEV ? 'http://localhost:3010' : '';
    fetch(`${BASE}/api/apps`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (Array.isArray(data) && data.length) setApps(data); })
      .catch(() => {});
  }, []);

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
      window.open(app.url, '_blank', 'noopener,noreferrer');
    } finally {
      setLaunching(null);
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-scorva-bg">

      {/* ── Header ── */}
      <header className="flex items-center justify-between h-14 px-4 md:px-6 bg-scorva-surface/80 backdrop-blur-xl border-b border-scorva-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-scorva-accent/10 border border-scorva-accent/30 glow-border">
            <Shield size={15} className="text-scorva-accent" />
          </div>
          <div>
            <div className="text-xs font-black font-mono tracking-[0.2em] text-scorva-accent uppercase leading-none text-glow">MTSI Hub</div>
            <div className="text-[10px] text-scorva-muted font-mono leading-none mt-0.5 tracking-wide">Security App Factory</div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {canAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono text-scorva-muted hover:text-scorva-accent hover:bg-scorva-hover transition-colors mr-1"
            >
              <Settings2 size={13} />
              Admin
            </button>
          )}
          <button onClick={toggle} className="p-1.5 rounded-md text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover transition-colors">
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <div className="flex items-center gap-2 pl-2 ml-1 border-l border-scorva-border">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-scorva-accent text-white dark:text-scorva-bg text-xs font-black shrink-0">
              {user?.initials}
            </div>
            <div className="hidden sm:flex flex-col leading-none gap-0.5">
              <span className="text-xs font-semibold text-scorva-text">{user?.name}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-scorva-muted font-mono">{user?.role}</span>
                {siteLabel && (
                  <>
                    <span className="text-scorva-border">·</span>
                    <span className="flex items-center gap-0.5 text-[10px] text-scorva-muted font-mono">
                      <MapPin size={9} />
                      {siteLabel}
                    </span>
                  </>
                )}
              </div>
            </div>
            <button onClick={logout} className="p-1.5 rounded-md text-scorva-muted hover:text-red-500 hover:bg-scorva-hover transition-colors" title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="flex-1 overflow-y-auto">

        {/* ── Hero banner ── */}
        <div className="relative overflow-hidden bg-scorva-surface border-b border-scorva-border px-6 md:px-10 py-8">
          <div className="absolute inset-0 cyber-grid-dense pointer-events-none opacity-50" />
          <div className="absolute inset-0 scanlines pointer-events-none opacity-60" />
          <div className="absolute right-0 top-0 w-96 h-full bg-gradient-to-l from-scorva-accent/5 to-transparent pointer-events-none" />
          <div className="relative max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-scorva-accent/10 border border-scorva-accent/20 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-scorva-accent animate-pulse" />
                  <span className="text-[10px] font-mono text-scorva-accent tracking-[0.3em] uppercase">SSO Active</span>
                </div>
                <h1 className="text-xl font-black text-scorva-text font-mono tracking-wide text-glow">
                  Mission App Factory
                </h1>
                <p className="text-sm text-scorva-muted mt-1 mb-3">
                  Welcome back, <span className="text-scorva-text font-semibold">{user?.name}</span>.
                </p>
                {/* Identity context strip */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-scorva-accent/10 border border-scorva-accent/20 text-[10px] font-mono text-scorva-accent">
                    HUB: {user?.role}
                  </span>
                  {user?.securityRole && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-500/10 border border-teal-500/20 text-[10px] font-mono text-teal-500 dark:text-teal-400">
                      {user.securityRole}
                    </span>
                  )}
                  {siteLabel && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-scorva-hover border border-scorva-border text-[10px] font-mono text-scorva-muted">
                      <MapPin size={8} /> {siteLabel}
                    </span>
                  )}
                  {Array.isArray(user?.allowedApps) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-500 dark:text-emerald-400">
                      {user.allowedApps.length} apps authorized
                    </span>
                  )}
                </div>
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
        <div className="sticky top-0 z-10 bg-scorva-bg/95 backdrop-blur-xl border-b border-scorva-border px-6 md:px-10 py-3 relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-scorva-accent/25 to-transparent pointer-events-none" />
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-scorva-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Search apps, tags, teams…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-base pl-8 py-1.5 text-xs font-mono"
              />
            </div>
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
                    className={`relative card group flex flex-col transition-all duration-300 overflow-hidden ${colors.border} ${colors.glow}`}
                  >
                    {/* Color top bar */}
                    <div className={`absolute top-0 left-0 right-0 h-[3px] ${colors.top} opacity-60 group-hover:opacity-100 transition-opacity`} />

                    <div className="flex items-start justify-between p-5 pb-0 pt-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${colors.icon}`}>
                          <Icon size={22} />
                        </div>
                        <div>
                          <h2 className="text-sm font-black text-scorva-text font-mono tracking-widest uppercase">
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

                    <p className="text-xs text-scorva-muted leading-relaxed px-5 pt-3 pb-0 flex-1">
                      {app.desc}
                    </p>

                    <div className="flex flex-wrap gap-1.5 px-5 pt-3">
                      {app.tags.map(tag => (
                        <span key={tag} className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${colors.badge}`}>
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between px-5 py-3 mt-3 border-t border-scorva-border/60">
                      <div className="flex items-center gap-3 text-[9px] font-mono text-scorva-muted">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          READY
                        </span>
                        <span className="text-scorva-border">·</span>
                        <span>AUTH:SSO</span>
                      </div>
                      <button
                        onClick={() => handleLaunch(app)}
                        disabled={busy}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold font-mono transition-all ${colors.launch} disabled:opacity-60`}
                      >
                        {busy ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            Launching…
                          </>
                        ) : (
                          <>
                            Launch Module
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

        {/* ── SSO info footer ── */}
        <div className="max-w-5xl mx-auto px-6 md:px-10 pb-10">
          <div className="glass border border-scorva-accent/20 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-scorva-accent/10 border border-scorva-accent/20">
                <Shield size={14} className="text-scorva-accent" />
              </div>
              <div>
                <p className="text-xs font-bold text-scorva-text font-mono tracking-wide">SSO Session Active</p>
                <p className="text-[10px] text-scorva-muted mt-0.5">
                  Hub credentials automatically authenticate you into supported apps.
                  Tokens expire after 60 s — a new one is issued on each launch.
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
