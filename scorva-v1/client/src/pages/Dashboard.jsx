import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck, Activity, AlertTriangle, CheckSquare,
  BookOpen, Users, Monitor, Key, ArrowRight, Shield,
  Clock, Zap, ExternalLink, RefreshCw, FileText, Package,
  LayoutGrid, ClipboardList, Bell, Building2, TrendingUp,
} from 'lucide-react';

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function utcClock() {
  return new Date().toUTCString().slice(5, 25) + ' UTC';
}

function calcInfocon(poams) {
  const critical = poams.filter(p => p.status === 'Open' && /critical/i.test(p.severity || '')).length;
  const high     = poams.filter(p => p.status === 'Open' && /high/i.test(p.severity || '')).length;
  const open     = poams.filter(p => p.status === 'Open').length;
  if (critical >= 3 || open >= 20) return 2;
  if (critical >= 1 || high >= 5)  return 3;
  if (high >= 1    || open >= 5)   return 4;
  return 5;
}

const INFOCON_META = {
  5: { label: 'INFOCON 5', sub: 'Normal',           color: 'text-emerald-400', dot: 'bg-emerald-400', ring: 'ring-emerald-500/30', bg: 'bg-emerald-500/10' },
  4: { label: 'INFOCON 4', sub: 'Increased',        color: 'text-blue-400',    dot: 'bg-blue-400',    ring: 'ring-blue-500/30',    bg: 'bg-blue-500/10' },
  3: { label: 'INFOCON 3', sub: 'Enhanced',         color: 'text-yellow-400',  dot: 'bg-yellow-400',  ring: 'ring-yellow-500/30',  bg: 'bg-yellow-500/10' },
  2: { label: 'INFOCON 2', sub: 'Greater',          color: 'text-orange-400',  dot: 'bg-orange-400',  ring: 'ring-orange-500/30',  bg: 'bg-orange-500/10' },
  1: { label: 'INFOCON 1', sub: 'Maximum',          color: 'text-red-400',     dot: 'bg-red-400',     ring: 'ring-red-500/30',     bg: 'bg-red-500/10' },
};

function sevClass(s = '') {
  const u = s.toUpperCase();
  if (u === 'CRITICAL') return 'sev-critical';
  if (u === 'HIGH')     return 'sev-high';
  if (u === 'MEDIUM')   return 'sev-medium';
  if (u === 'LOW')      return 'sev-low';
  return 'sev-none';
}

/* ── Module definitions ──────────────────────────────────────────────────── */
const MODULES = [
  { label: 'ATO',           desc: 'Authority to Operate tracking',    to: '/ato',          icon: ShieldCheck,   color: 'indigo' },
  { label: 'ConMon',        desc: 'Continuous monitoring tasks',       to: '/conmon',       icon: Activity,      color: 'cyan' },
  { label: 'Controls',      desc: 'NIST 800-53 control library',       to: '/controls',     icon: BookOpen,      color: 'violet' },
  { label: 'POAM',          desc: 'Plan of action & milestones',       to: '/poam',         icon: AlertTriangle, color: 'orange' },
  { label: 'Tasks',         desc: 'Findings & remediation tasks',      to: '/tasks',        icon: CheckSquare,   color: 'emerald' },
  { label: 'Users',         desc: 'Access management',                 to: '/users',        icon: Users,         color: 'blue' },
  { label: 'Devices',       desc: 'Endpoint compliance inventory',     to: '/workstations', icon: Monitor,       color: 'teal' },
  { label: 'YubiKeys',      desc: 'Hardware token management',         to: '/yubikeys',     icon: Key,           color: 'yellow' },
  { label: 'Documents',     desc: 'Memorandums, letters & agreements', to: '/agreements',   icon: FileText,      color: 'pink' },
  { label: 'Licenses',      desc: 'Software license inventory',        to: '/licenses',     icon: Package,       color: 'lime' },
  { label: 'Trackers',      desc: 'Custom compliance trackers',        to: '/trackers',     icon: LayoutGrid,    color: 'purple' },
  { label: 'Audit Log',     desc: 'System-wide audit trail',           to: '/audit',        icon: ClipboardList, color: 'slate' },
  { label: 'Notifications', desc: 'Alerts & system messages',          to: '/notifications',icon: Bell,          color: 'rose' },
  { label: 'Sites',         desc: 'Site & location management',        to: '/sites',        icon: Building2,     color: 'sky' },
];

const COLOR_MAP = {
  indigo:  'bg-indigo-500/10  text-indigo-400  border-indigo-500/25',
  cyan:    'bg-cyan-500/10    text-cyan-400    border-cyan-500/25',
  violet:  'bg-violet-500/10  text-violet-400  border-violet-500/25',
  orange:  'bg-orange-500/10  text-orange-400  border-orange-500/25',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  blue:    'bg-blue-500/10    text-blue-400    border-blue-500/25',
  teal:    'bg-teal-500/10    text-teal-400    border-teal-500/25',
  yellow:  'bg-yellow-500/10  text-yellow-400  border-yellow-500/25',
  pink:    'bg-pink-500/10    text-pink-400    border-pink-500/25',
  lime:    'bg-lime-500/10    text-lime-400    border-lime-500/25',
  purple:  'bg-purple-500/10  text-purple-400  border-purple-500/25',
  slate:   'bg-slate-500/10   text-slate-400   border-slate-500/25',
  rose:    'bg-rose-500/10    text-rose-400    border-rose-500/25',
  sky:     'bg-sky-500/10     text-sky-400     border-sky-500/25',
};

/* ── Dashboard ───────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate();
  const { user, selectedSite } = useAuth();
  const [clock, setClock] = useState(utcClock());
  const siteScopeKey = selectedSite || user?.siteID || 'all-sites';

  useEffect(() => {
    const t = setInterval(() => setClock(utcClock()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: atos     = [] } = useQuery({ queryKey: ['ato', siteScopeKey],      queryFn: api.ato.list,      refetchInterval: 60_000 });
  const { data: controls = [] } = useQuery({ queryKey: ['controls', siteScopeKey], queryFn: api.controls.list, refetchInterval: 60_000 });
  const { data: poams    = [] } = useQuery({ queryKey: ['poam', siteScopeKey],     queryFn: api.poam.list,     refetchInterval: 60_000 });
  const { data: tasks    = [] } = useQuery({ queryKey: ['tasks', siteScopeKey],    queryFn: api.tasks.list,    refetchInterval: 60_000 });
  const { data: notifs   = [] } = useQuery({ queryKey: ['notifications', siteScopeKey], queryFn: api.notifications.list, refetchInterval: 60_000 });
  const { data: auditResp }     = useQuery({ queryKey: ['audit', siteScopeKey],    queryFn: () => api.audit.list({ limit: 6 }), refetchInterval: 30_000 });
  const auditLog = auditResp?.rows ?? [];

  const {
    data: threats = [],
    isFetching: threatsFetching,
    refetch: refetchThreats,
    dataUpdatedAt: threatsUpdatedAt,
  } = useQuery({
    queryKey: ['threats'],
    queryFn: api.threats.latest,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const activeAtos   = atos.filter(a => a.status === 'Authorized').length;
  const openPoams    = poams.filter(p => p.status === 'Open').length;
  const openTasks    = tasks.filter(t => t.status === 'Open').length;
  const implControls = controls.filter(c => c.status === 'Implemented').length;
  const unread       = notifs.filter(n => !n.read).length;
  const infocon      = calcInfocon(poams);
  const ic           = INFOCON_META[infocon];

  const threatsTime = threatsUpdatedAt
    ? new Date(threatsUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="space-y-5">

      {/* ── Top bar: title + clock + INFOCON ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Shield size={18} className="text-scorva-accent shrink-0" />
          <div>
            <h1 className="text-base font-bold text-scorva-text font-mono tracking-widest uppercase">Cyber Command Center</h1>
            <p className="text-[10px] text-scorva-muted font-mono">NIST SP 800-53 Rev 5 · Compliance Posture</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-scorva-muted">
            <Clock size={12} className="text-scorva-accent" />
            {clock}
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md ring-1 ${ic.ring} ${ic.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 animate-pulse-slow ${ic.dot}`} />
            <span className={`text-[11px] font-mono font-bold ${ic.color}`}>{ic.label}</span>
            <span className="text-[9px] font-mono text-scorva-muted">{ic.sub}</span>
          </div>
        </div>
      </div>

      {/* ── Alert banner ── */}
      {unread > 0 && (
        <button
          onClick={() => navigate('/notifications')}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-scorva-gold/10 border border-scorva-gold/30 text-xs font-mono text-scorva-gold hover:bg-scorva-gold/15 transition-colors"
        >
          <span className="flex items-center gap-2"><Zap size={12} />{unread} unread notification{unread !== 1 ? 's' : ''}</span>
          <ArrowRight size={12} />
        </button>
      )}

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Active ATOs"        value={activeAtos}   total={atos.length}     icon={ShieldCheck}   accent />
        <StatTile label="Open POAMs"         value={openPoams}    total={poams.length}    icon={AlertTriangle} warn={openPoams > 0} />
        <StatTile label="Open Tasks"         value={openTasks}    total={tasks.length}    icon={CheckSquare} />
        <StatTile label="Controls Impl."     value={implControls} total={controls.length} icon={BookOpen}      showPct />
      </div>

      {/* ── Module grid — PRIMARY NAVIGATION ── */}
      <div>
        <SectionLabel>Mission Modules</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {MODULES.map(({ label, desc, to, icon: Icon, color }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="card p-3.5 text-left hover:border-scorva-accent/40 hover:bg-scorva-hover transition-all group flex flex-col gap-2.5"
            >
              <div className={`inline-flex p-2 rounded-lg border ${COLOR_MAP[color]}`}>
                <Icon size={15} />
              </div>
              <div>
                <div className="text-xs font-semibold text-scorva-text group-hover:text-scorva-accent transition-colors leading-tight">
                  {label}
                </div>
                <div className="text-[10px] text-scorva-muted leading-tight mt-0.5 line-clamp-2">{desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Bottom row: Threat Feed (compact/scrollable) + Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Live CVE Threat Feed */}
        <div className="card flex flex-col" style={{ maxHeight: '320px' }}>
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-scorva-border shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[10px] font-mono font-semibold text-scorva-text uppercase tracking-widest">
                Live Threat Intel
              </span>
              <span className="text-[9px] font-mono text-scorva-muted bg-scorva-border/60 px-1.5 py-0.5 rounded">NVD · Last 30 days</span>
            </div>
            <div className="flex items-center gap-2">
              {threatsTime && (
                <span className="text-[9px] font-mono text-scorva-muted">{threatsTime}</span>
              )}
              <button
                onClick={() => refetchThreats()}
                className="p-1 rounded text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover transition-colors"
                title="Refresh CVE feed"
              >
                <RefreshCw size={11} className={threatsFetching ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto divide-y divide-scorva-border flex-1">
            {threatsFetching && threats.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-scorva-muted text-xs font-mono gap-2">
                <RefreshCw size={12} className="animate-spin" /> Fetching...
              </div>
            ) : threats.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-scorva-muted text-xs font-mono">
                No data available
              </div>
            ) : (
              threats.map(cve => (
                <div key={cve.id} className="px-3 py-2.5 hover:bg-scorva-hover transition-colors group">
                  <div className="flex items-center gap-2 mb-0.5">
                    <a
                      href={`https://nvd.nist.gov/vuln/detail/${cve.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[11px] font-semibold text-scorva-accent hover:underline shrink-0"
                      onClick={e => e.stopPropagation()}
                    >
                      {cve.id}
                    </a>
                    {cve.severity && (
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${sevClass(cve.severity)}`}>
                        {cve.severity}
                      </span>
                    )}
                    {cve.score > 0 && (
                      <span className="ml-auto text-[10px] font-mono font-semibold text-scorva-muted shrink-0">
                        {cve.score.toFixed(1)}
                      </span>
                    )}
                    <a
                      href={`https://nvd.nist.gov/vuln/detail/${cve.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-scorva-muted hover:text-scorva-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      <ExternalLink size={10} />
                    </a>
                  </div>
                  <p className="text-[10px] text-scorva-muted leading-relaxed line-clamp-2">{cve.description}</p>
                  <div className="text-[9px] font-mono text-scorva-muted/60 mt-1">
                    {new Date(cve.published).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card flex flex-col" style={{ maxHeight: '320px' }}>
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-scorva-border shrink-0">
            <div className="flex items-center gap-2">
              <TrendingUp size={13} className="text-scorva-cyan" />
              <span className="text-[10px] font-mono font-semibold text-scorva-text uppercase tracking-widest">
                Recent Activity
              </span>
            </div>
            <button onClick={() => navigate('/audit')} className="text-[9px] font-mono text-scorva-accent hover:underline">
              Full log →
            </button>
          </div>

          <div className="overflow-y-auto divide-y divide-scorva-border flex-1">
            {auditLog.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-scorva-muted text-xs font-mono">
                No activity yet
              </div>
            ) : (
              auditLog.map((entry, i) => (
                <div key={entry.id || i} className="px-3 py-2.5 hover:bg-scorva-hover transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-1 h-1 rounded-full bg-scorva-accent shrink-0" />
                      <span className="text-[11px] font-mono font-semibold text-scorva-accent shrink-0">{entry.user}</span>
                      <span className="text-[11px] text-scorva-muted truncate">{entry.action} · {entry.resource}</span>
                    </div>
                    <span className="text-[9px] font-mono text-scorva-muted shrink-0">
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  {entry.detail && (
                    <p className="text-[10px] text-scorva-muted/70 pl-4 mt-0.5 truncate">{entry.detail}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[10px] font-mono font-semibold text-scorva-muted uppercase tracking-widest">{children}</span>
      <div className="flex-1 h-px bg-scorva-border" />
    </div>
  );
}

function StatTile({ label, value, total, icon: Icon, accent = false, warn = false, showPct = false }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const isWarn = warn && value > 0;

  return (
    <div className={`card p-4 flex gap-3 items-start ${accent ? 'border-scorva-accent/30' : isWarn ? 'border-orange-500/25' : ''}`}>
      <div className={`p-2 rounded-lg shrink-0 ${accent ? 'bg-scorva-accent/15 text-scorva-accent' : isWarn ? 'bg-orange-500/15 text-orange-400' : 'bg-scorva-hover text-scorva-muted'}`}>
        <Icon size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-2xl font-bold font-mono leading-none ${accent ? 'text-scorva-accent' : isWarn ? 'text-orange-400' : 'text-scorva-text'}`}>
          {value ?? '—'}
        </div>
        <div className="text-[10px] text-scorva-muted mt-0.5 truncate">{label}</div>
        {total > 0 && (
          <div className="mt-2 h-1 rounded-full bg-scorva-border overflow-hidden">
            <div
              className={`h-full rounded-full ${accent ? 'bg-scorva-accent' : isWarn ? 'bg-orange-400' : 'bg-scorva-muted'}`}
              style={{ width: `${showPct ? pct : Math.round((value / total) * 100)}%` }}
            />
          </div>
        )}
        {total > 0 && (
          <div className="text-[9px] font-mono text-scorva-muted/60 mt-0.5">
            {showPct ? `${pct}%` : `${value}/${total}`}
          </div>
        )}
      </div>
    </div>
  );
}
