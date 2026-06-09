import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth }  from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../api';
import DonutChart from '../components/ui/DonutChart';
import {
  Shield, ShieldCheck, Activity, Monitor, Users, Globe,
  Clock, Zap, ArrowRight, RefreshCw, ExternalLink,
  AlertTriangle, CheckSquare, BookOpen,
  Bell, Sun, Moon, LogOut, Upload, X, FileText,
} from 'lucide-react';

/* ── Helpers ── */
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
  5: { label: 'INFOCON 5', sub: 'Normal',   color: 'text-emerald-400', dot: 'bg-emerald-400', ring: 'ring-emerald-500/30', bg: 'bg-emerald-500/10' },
  4: { label: 'INFOCON 4', sub: 'Increased',color: 'text-blue-400',    dot: 'bg-blue-400',    ring: 'ring-blue-500/30',    bg: 'bg-blue-500/10' },
  3: { label: 'INFOCON 3', sub: 'Enhanced', color: 'text-yellow-400',  dot: 'bg-yellow-400',  ring: 'ring-yellow-500/30',  bg: 'bg-yellow-500/10' },
  2: { label: 'INFOCON 2', sub: 'Greater',  color: 'text-orange-400',  dot: 'bg-orange-400',  ring: 'ring-orange-500/30',  bg: 'bg-orange-500/10' },
  1: { label: 'INFOCON 1', sub: 'Maximum',  color: 'text-red-400',     dot: 'bg-red-400',     ring: 'ring-red-500/30',     bg: 'bg-red-500/10' },
};

function sevClass(s = '') {
  const u = s.toUpperCase();
  if (u === 'CRITICAL') return 'sev-critical';
  if (u === 'HIGH')     return 'sev-high';
  if (u === 'MEDIUM')   return 'sev-medium';
  if (u === 'LOW')      return 'sev-low';
  return 'sev-none';
}

/* ── ATO classification ── */
function classifyAto(ato) {
  if (ato.status === 'Expired') return 'expired';
  if (ato.status !== 'Authorized') return 'other';
  if (!ato.expires) return 'current';
  const exp  = new Date(ato.expires);
  const now  = new Date();
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  if (exp < now)  return 'expired';
  if (exp < in90) return 'expiring';
  return 'current';
}

/* ── Log helpers ── */
function detectLogSeverity(entry) {
  const FIELDS = ['severity','level','priority','sev','risk','Severity','Level','Risk','finding_severity'];
  for (const f of FIELDS) {
    const v = (entry[f] || '').toUpperCase();
    if (v.includes('CRITICAL'))                       return 'critical';
    if (v.includes('HIGH'))                           return 'high';
    if (v.includes('MEDIUM') || v.includes('MOD'))   return 'medium';
    if (v.includes('LOW'))                            return 'low';
    if (v.includes('INFO') || v.includes('NOTICE'))  return 'info';
  }
  return 'info';
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('Must have a header row and at least one data row');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).filter(l => l.trim()).map((line, i) => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = { _rowIdx: i };
    headers.forEach((h, j) => { obj[h] = vals[j] ?? ''; });
    return obj;
  });
}

function normalizeLogEntry(raw, idx) {
  return {
    _id:       raw.id || raw._id || raw._rowIdx || idx,
    timestamp: raw.timestamp || raw.time || raw.date || raw.Date || raw.Time || '',
    source:    raw.source || raw.host || raw.system || raw.System || raw.Source || raw.hostname || 'Unknown',
    message:   raw.message || raw.msg || raw.description || raw.Description || raw.finding || raw.event || JSON.stringify(raw),
    severity:  detectLogSeverity(raw),
  };
}

const SEV_BADGE = {
  critical: 'sev-critical',
  high:     'sev-high',
  medium:   'sev-medium',
  low:      'sev-low',
  info:     'sev-none',
};

const SEV_BORDER = {
  critical: 'border-l-2 border-red-500/60 bg-red-500/5',
  high:     'border-l-2 border-orange-500/60 bg-orange-500/5',
  medium:   '',
  low:      '',
  info:     '',
};

/* ── Mission Apps ── */
const APPS = [
  {
    label: 'Authorization',
    sub: 'ATO · Controls · POAM',
    desc: 'Manage Authority to Operate packages, NIST 800-53 control library, and Plan of Action & Milestones.',
    to: '/authorization',
    icon: ShieldCheck,
    color: 'indigo',
  },
  {
    label: 'Monitoring',
    sub: 'ConMon · Tasks · Trackers · Events · Self-Inspection',
    desc: 'Continuous monitoring, remediation tracking, security events, and DCSA self-inspection campaigns.',
    to: '/monitoring',
    icon: Activity,
    color: 'cyan',
  },
  {
    label: 'Assets',
    sub: 'Devices · YubiKeys · Licenses',
    desc: 'Endpoint inventory, hardware token management, and software license tracking.',
    to: '/assets',
    icon: Monitor,
    color: 'teal',
  },
  {
    label: 'Administration',
    sub: 'Users · Sites · Documents · Audit · Notifications · Program View',
    desc: 'Administrative controls, auditability, notifications, and leadership-level cross-site oversight.',
    to: '/admin',
    icon: Users,
    color: 'blue',
  },
];

const APP_COLOR_MAP = {
  indigo: 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border-indigo-500/20 hover:border-indigo-500/50',
  cyan:   'bg-cyan-500/10   text-cyan-600   dark:text-cyan-400   border-cyan-500/20   hover:border-cyan-500/50',
  teal:   'bg-teal-500/10   text-teal-600   dark:text-teal-400   border-teal-500/20   hover:border-teal-500/50',
  blue:   'bg-blue-500/10   text-blue-600   dark:text-blue-400   border-blue-500/20   hover:border-blue-500/50',
};

export default function Portal() {
  const navigate = useNavigate();
  const { user, logout, selectedSite } = useAuth();
  const { dark, toggle } = useTheme();
  const [clock, setClock] = useState(utcClock());
  const siteScopeKey = selectedSite || user?.siteID || 'active-site';

  /* ── System Audit Log state ── */
  const [systemLogs, setSystemLogs] = useState([]);
  const [logFileName, setLogFileName] = useState('');
  const [logError, setLogError]     = useState('');
  const [logFilter, setLogFilter]   = useState('all');
  const [dragOver, setDragOver]     = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setClock(utcClock()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ── Data queries ── */
  const { data: atos     = [] } = useQuery({ queryKey: ['ato', siteScopeKey],      queryFn: api.ato.list,      refetchInterval: 60_000 });
  const { data: controls = [] } = useQuery({ queryKey: ['controls', siteScopeKey], queryFn: api.controls.list, refetchInterval: 60_000 });
  const { data: poams    = [] } = useQuery({ queryKey: ['poam', siteScopeKey],     queryFn: api.poam.list,     refetchInterval: 60_000 });
  const { data: tasks    = [] } = useQuery({ queryKey: ['tasks', siteScopeKey],    queryFn: api.tasks.list,    refetchInterval: 60_000 });
  const { data: notifs   = [] } = useQuery({ queryKey: ['notifications', siteScopeKey], queryFn: api.notifications.list, refetchInterval: 60_000 });

  const {
    data: threats = [],
    isFetching: threatsFetching,
    refetch: refetchThreats,
    dataUpdatedAt: threatsUpdatedAt,
  } = useQuery({
    queryKey: ['threats'],
    queryFn: api.threats.latest,
    staleTime: 0,
    refetchInterval: 5 * 60 * 1000,
  });

  // Auto-refetch threats on page load
  useEffect(() => {
    refetchThreats();
  }, []);

  /* ── Derived: ATOs ── */
  const atoClasses   = atos.map(classifyAto);
  const atoCurrentN  = atoClasses.filter(c => c === 'current').length;
  const atoExpiringN = atoClasses.filter(c => c === 'expiring').length;
  const atoExpiredN  = atoClasses.filter(c => c === 'expired').length;
  const atoOtherN    = atoClasses.filter(c => c === 'other').length;

  /* ── Derived: POAMs ── */
  const openPoams    = poams.filter(p => p.status === 'Open');
  const poamCritical = openPoams.filter(p => /critical/i.test(p.severity || '')).length;
  const poamHigh     = openPoams.filter(p => /^high$/i.test(p.severity || '')).length;
  const poamMedium   = openPoams.filter(p => /medium/i.test(p.severity || '')).length;
  const poamLow      = openPoams.filter(p => /^low$/i.test(p.severity || '')).length;
  const poamOther    = openPoams.length - poamCritical - poamHigh - poamMedium - poamLow;

  /* ── Derived: Tasks ── */
  const completedTasks = tasks.filter(t => t.status === 'Completed' || t.status === 'Closed').length;
  const inProgTasks    = tasks.filter(t => t.status === 'In Progress').length;
  const openTasks      = tasks.filter(t => t.status === 'Open').length;

  /* ── Derived: Controls ── */
  const implControls    = controls.filter(c => c.status === 'Implemented').length;
  const partialControls = controls.filter(c => c.status === 'Partially Implemented').length;
  const notImplControls = controls.filter(c => c.status === 'Not Implemented').length;
  const implPct         = controls.length > 0 ? Math.round((implControls / controls.length) * 100) : 0;

  /* ── Misc ── */
  const unread      = notifs.filter(n => !n.read).length;
  const infocon     = calcInfocon(poams);
  const ic          = INFOCON_META[infocon];
  const threatsTime = threatsUpdatedAt
    ? new Date(threatsUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  /* ── Log upload handlers ── */
  function handleFilePicked(file) {
    if (!file) return;
    setLogError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        let rows;
        if (file.name.toLowerCase().endsWith('.json')) {
          const parsed = JSON.parse(text);
          rows = Array.isArray(parsed) ? parsed : [parsed];
        } else {
          rows = parseCSV(text);
        }
        setSystemLogs(rows.map(normalizeLogEntry));
        setLogFileName(file.name);
      } catch (err) {
        setLogError(`Could not parse file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  function clearLogs() {
    setSystemLogs([]);
    setLogFileName('');
    setLogError('');
    setLogFilter('all');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const displayedLogs = systemLogs.filter(l => {
    if (logFilter === 'critical') return l.severity === 'critical';
    if (logFilter === 'high')     return l.severity === 'high';
    if (logFilter === 'crithi')   return l.severity === 'critical' || l.severity === 'high';
    return true;
  });

  const critHighCount = systemLogs.filter(l => l.severity === 'critical' || l.severity === 'high').length;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-scorva-bg relative">
      <div className="sc-landing-grid absolute inset-0 pointer-events-none opacity-50" />

      {/* ── Portal Header ── */}
      <header className="sc-app-header justify-between">
        <div className="flex items-center gap-2.5">
          <div className="sc-app-header-mark">
            <Shield size={15} className="text-scorva-accent" />
          </div>
          <div>
            <div className="text-xs font-bold font-mono tracking-widest text-scorva-accent uppercase leading-none">SCORVA</div>
            <div className="text-[10px] text-scorva-muted font-mono leading-none mt-0.5">Command Center</div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={toggle} className="p-1.5 rounded-md text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover transition-colors">
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button onClick={() => navigate('/admin/notifications')} className="p-1.5 rounded-md text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover transition-colors" title="Notifications">
            <Bell size={15} />
          </button>
          <div className="flex items-center gap-2 pl-2 ml-1 border-l border-scorva-border">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-scorva-accent text-white dark:text-scorva-bg text-xs font-semibold">
              {user?.initials}
            </div>
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-xs font-medium text-scorva-text">{user?.name}</span>
              <span className="text-[10px] text-scorva-muted">{user?.role}</span>
            </div>
            <button onClick={logout} className="p-1.5 rounded-md text-scorva-muted hover:text-red-500 hover:bg-scorva-hover transition-colors" title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10">

        {/* ── Title + INFOCON ── */}
        <div className="sc-command-hero">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Globe size={18} className="text-scorva-accent shrink-0" />
            <div>
              <h1 className="text-base font-bold text-scorva-text font-mono tracking-widest uppercase">Cyber Command Center</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-scorva-muted">
              <Clock size={12} className="text-scorva-accent" />
              {clock}
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md ring-1 ${ic.ring} ${ic.bg}`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 animate-pulse ${ic.dot}`} />
              <span className={`text-[11px] font-mono font-bold ${ic.color}`}>{ic.label}</span>
              <span className="text-[9px] font-mono text-scorva-muted">{ic.sub}</span>
            </div>
          </div>
        </div>
        </div>

        {/* ── Alert banner ── */}
        {unread > 0 && (
          <button
            onClick={() => navigate('/admin/notifications')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-scorva-gold/10 border border-scorva-gold/30 text-xs font-mono text-scorva-gold hover:bg-scorva-gold/15 transition-colors"
          >
            <span className="flex items-center gap-2"><Zap size={12} />{unread} unread notification{unread !== 1 ? 's' : ''}</span>
            <ArrowRight size={12} />
          </button>
        )}

        {/* ── Chart Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

          {/* Active ATOs */}
          <ChartCard icon={ShieldCheck} label="Active ATOs" sublabel={`${atos.length} system${atos.length !== 1 ? 's' : ''} total`} accent>
            <DonutChart
              size={96} thickness={12}
              label={String(atos.length)} sublabel="systems"
              segments={[
                { label: 'Up to Date',    value: atoCurrentN,  color: 'green'  },
                { label: 'Expiring Soon', value: atoExpiringN, color: 'yellow' },
                { label: 'Expired',       value: atoExpiredN,  color: 'red'    },
                { label: 'Pending',       value: atoOtherN,    color: 'muted'  },
              ].filter(s => s.value > 0)}
            />
          </ChartCard>

          {/* Open POAMs */}
          <ChartCard icon={AlertTriangle} label="Open POAMs" sublabel={`${openPoams.length} open findings`} warn={openPoams.length > 0}>
            <DonutChart
              size={96} thickness={12}
              label={String(openPoams.length)} sublabel="open"
              segments={[
                { label: 'Critical', value: poamCritical, color: 'red'    },
                { label: 'High',     value: poamHigh,     color: 'orange' },
                { label: 'Medium',   value: poamMedium,   color: 'yellow' },
                { label: 'Low',      value: poamLow,      color: 'blue'   },
                { label: 'Other',    value: poamOther > 0 ? poamOther : 0, color: 'muted' },
              ].filter(s => s.value > 0)}
            />
          </ChartCard>

          {/* Tasks */}
          <ChartCard icon={CheckSquare} label="Tasks" sublabel={`${tasks.length} total`} warn>
            <DonutChart
              size={96} thickness={12}
              label={String(tasks.length)} sublabel="tasks"
              segments={[
                { label: 'Completed',   value: completedTasks, color: 'green'  },
                { label: 'In Progress', value: inProgTasks,    color: 'blue'   },
                { label: 'Open',        value: openTasks,      color: 'orange' },
              ].filter(s => s.value > 0)}
            />
          </ChartCard>

          {/* Controls */}
          <ChartCard icon={BookOpen} label="Controls" sublabel={`${controls.length} required`} warn>
            <DonutChart
              size={96} thickness={12}
              label={`${implPct}%`} sublabel="impl."
              segments={[
                { label: 'Implemented', value: implControls,    color: 'green'  },
                { label: 'Partial',     value: partialControls, color: 'yellow' },
                { label: 'Not Impl.',   value: notImplControls, color: 'red'    },
              ].filter(s => s.value > 0)}
            />
          </ChartCard>
        </div>

        {/* ── Mission Apps ── */}
        <div>
          <SectionLabel>Mission Apps</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {APPS.map(({ label, sub, desc, to, icon: Icon, color }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className={`sc-portal-app-card p-5 text-left transition-all group flex flex-col gap-3 border-2 ${APP_COLOR_MAP[color]}`}
              >
                <div className="flex items-start justify-between">
                  <div className={`inline-flex p-2.5 rounded-xl border ${APP_COLOR_MAP[color]}`}>
                    <Icon size={20} />
                  </div>
                  <ArrowRight size={14} className="text-scorva-muted group-hover:text-scorva-accent transition-colors mt-1" />
                </div>
                <div>
                  <div className="text-sm font-bold text-scorva-text group-hover:text-scorva-accent transition-colors">{label}</div>
                  <div className="text-[10px] font-mono text-scorva-muted mt-0.5 uppercase tracking-wide">{sub}</div>
                  <div className="text-xs text-scorva-muted mt-2 leading-relaxed line-clamp-2">{desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Threat Feed + System Audit Log ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Live CVE Feed */}
          <div className="sc-portal-feed-card flex flex-col" style={{ maxHeight: '340px' }}>
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-scorva-border shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="text-[10px] font-mono font-semibold text-scorva-text uppercase tracking-widest">Live Threat Intel</span>
                <span className="text-[9px] font-mono text-scorva-muted bg-scorva-border/60 px-1.5 py-0.5 rounded">NVD · Last 30 days</span>
              </div>
              <div className="flex items-center gap-2">
                {threatsTime && <span className="text-[9px] font-mono text-scorva-muted">{threatsTime}</span>}
                <button
                  onClick={() => refetchThreats()}
                  className="p-1 rounded text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover transition-colors"
                  title="Refresh"
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
                <div className="flex items-center justify-center py-8 text-scorva-muted text-xs font-mono">No data available</div>
              ) : threats.map(cve => (
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
              ))}
            </div>
          </div>

          {/* System Audit Log */}
          <div className="sc-portal-feed-card flex flex-col" style={{ maxHeight: '340px' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-scorva-border shrink-0 gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={13} className="text-scorva-cyan shrink-0" />
                <span className="text-[10px] font-mono font-semibold text-scorva-text uppercase tracking-widest">System Audit Log</span>
                {critHighCount > 0 && (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded sev-high shrink-0">
                    {critHighCount} Critical/High
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {systemLogs.length > 0 && (
                  <select
                    value={logFilter}
                    onChange={e => setLogFilter(e.target.value)}
                    className="text-[10px] font-mono bg-scorva-hover border border-scorva-border rounded px-1.5 py-0.5 text-scorva-text"
                  >
                    <option value="all">All</option>
                    <option value="crithi">Critical & High</option>
                    <option value="critical">Critical only</option>
                    <option value="high">High only</option>
                  </select>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv,.log,.txt"
                  className="hidden"
                  onChange={e => handleFilePicked(e.target.files[0])}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono bg-scorva-accent/10 text-scorva-accent border border-scorva-accent/20 hover:bg-scorva-accent/20 transition-colors"
                  title="Upload log file"
                >
                  <Upload size={10} /> Upload
                </button>
                {systemLogs.length > 0 && (
                  <button
                    onClick={clearLogs}
                    className="p-1 rounded text-scorva-muted hover:text-red-400 hover:bg-scorva-hover transition-colors"
                    title="Clear logs"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1">
              {logError ? (
                <div className="p-4 text-xs text-red-400 font-mono">{logError}</div>
              ) : systemLogs.length === 0 ? (
                /* Drop zone */
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); handleFilePicked(e.dataTransfer.files[0]); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center h-full gap-3 cursor-pointer transition-colors ${dragOver ? 'bg-scorva-accent/5' : 'hover:bg-scorva-hover/50'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 border-dashed transition-colors ${dragOver ? 'border-scorva-accent text-scorva-accent' : 'border-scorva-border text-scorva-muted'}`}>
                    <Upload size={18} />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-mono text-scorva-muted">Upload external log file</div>
                    <div className="text-[10px] text-scorva-muted/60 mt-0.5">JSON · CSV · LOG · TXT</div>
                    <div className="text-[9px] text-scorva-muted/40 mt-1">Critical &amp; High findings auto-flagged</div>
                  </div>
                </div>
              ) : displayedLogs.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-scorva-muted text-xs font-mono">
                  No entries match filter
                </div>
              ) : (
                <div className="divide-y divide-scorva-border">
                  {logFileName && (
                    <div className="px-3 py-1.5 flex items-center gap-1.5 text-[9px] font-mono text-scorva-muted/60 bg-scorva-hover/30">
                      <FileText size={9} />
                      {logFileName} · {systemLogs.length} entries
                      {critHighCount > 0 && <span className="text-orange-400 font-semibold">· {critHighCount} flagged</span>}
                    </div>
                  )}
                  {displayedLogs.map((entry, i) => (
                    <div key={entry._id ?? i} className={`px-3 py-2 hover:bg-scorva-hover transition-colors ${SEV_BORDER[entry.severity] || ''}`}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${SEV_BADGE[entry.severity] || 'sev-none'}`}>
                          {entry.severity.toUpperCase()}
                        </span>
                        <span className="text-[10px] font-mono font-semibold text-scorva-text truncate flex-1">
                          {entry.source}
                        </span>
                        {entry.timestamp && (
                          <span className="text-[9px] font-mono text-scorva-muted shrink-0">
                            {(() => {
                              try {
                                return new Date(entry.timestamp).toLocaleString([], {
                                  month: 'short', day: 'numeric',
                                  hour: '2-digit', minute: '2-digit',
                                });
                              } catch { return entry.timestamp; }
                            })()}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-scorva-muted leading-relaxed line-clamp-2">{entry.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

/* ── Sub-components ── */
function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[10px] font-mono font-semibold text-scorva-muted uppercase tracking-widest">{children}</span>
      <div className="flex-1 h-px bg-scorva-border" />
    </div>
  );
}

function ChartCard({ icon: Icon, label, sublabel, accent = false, warn = false, children }) {
  return (
    <div className={`sc-chart-card p-4 flex flex-col gap-3 ${accent ? 'border-scorva-accent/30' : warn ? 'border-orange-500/25' : ''}`}>
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg shrink-0 ${accent ? 'bg-scorva-accent/15 text-scorva-accent' : warn ? 'bg-orange-500/15 text-orange-400' : 'bg-scorva-hover text-scorva-muted'}`}>
          <Icon size={13} />
        </div>
        <div className="min-w-0">
          <div className={`text-[11px] font-mono font-semibold uppercase tracking-wide leading-none ${accent ? 'text-scorva-accent' : warn ? 'text-orange-400' : 'text-scorva-text'}`}>
            {label}
          </div>
          <div className="text-[9px] text-scorva-muted mt-0.5">{sublabel}</div>
        </div>
      </div>
      {children}
    </div>
  );
}
