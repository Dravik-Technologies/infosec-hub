import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useEffect } from 'react';
import {
  Shield, ShieldCheck, FileText, BarChart3,
  ArrowRight, Lock, Sun, Moon, Zap, Globe, Users, Activity,
} from 'lucide-react';

const ICON_MAP = {
  ShieldCheck, FileText, BarChart3, Shield,
};

const APPS = [
  {
    id:      'scorva',
    name:    'SCORVA',
    tagline: 'Cyber Command Center',
    desc:    'NIST SP 800-53 Rev 5 compliance management — ATO tracking, continuous monitoring, POAM, asset inventory, and access governance.',
    color:   'teal',
    icon:    'ShieldCheck',
    team:    'Cybersecurity',
    tags:    ['NIST 800-53', 'RMF', 'ATO', 'ConMon'],
  },
  {
    id:      'crater',
    name:    'CRATER',
    tagline: 'eMASS RMF Toolkit',
    desc:    'eMASS-aligned RMF package builder with SCTM, POAM management, vulnerability tracking, diagrams, and compliance reporting.',
    color:   'indigo',
    icon:    'FileText',
    team:    'GRC',
    port:    3003,
    tags:    ['eMASS', 'RMF', 'SCTM', 'POAM'],
  },
  {
    id:      'mash',
    name:    'MASH',
    tagline: 'MTSI Advanced Sentinel Hub',
    desc:    'DoD security compliance dashboard with live threat intelligence, audit log analysis, and posture monitoring.',
    color:   'gold',
    icon:    'BarChart3',
    team:    'Security Operations',
    port:    8080,
    tags:    ['Dashboard', 'Threat Intel', 'DoD'],
  },
];

const COLOR_MAP = {
  teal:   { card: 'hover:border-teal-500/40',   badge: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20',   icon: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20' },
  indigo: { card: 'hover:border-indigo-500/40', badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20', icon: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
  gold:   { card: 'hover:border-scorva-gold/40', badge: 'bg-scorva-gold/10 text-scorva-gold border border-scorva-gold/20', icon: 'bg-scorva-gold/10 text-scorva-gold border-scorva-gold/20' },
  cyan:   { card: 'hover:border-scorva-cyan/40', badge: 'bg-scorva-cyan/10 text-scorva-cyan border border-scorva-cyan/20', icon: 'bg-scorva-cyan/10 text-scorva-cyan border-scorva-cyan/20' },
};

const STATS = [
  { value: String(APPS.length), label: 'Mission Apps' },
  { value: 'SSO',     label: 'Single Sign-On' },
  { value: 'NIST',    label: '800-53 Ready' },
  { value: 'DoD',     label: 'Compliant' },
];

const FEATURES = [
  { icon: Lock,     label: 'Unified Auth',        desc: 'One login grants access to every app in the hub via SSO token exchange.' },
  { icon: Globe,    label: 'App Factory',          desc: 'Browse, discover, and launch purpose-built mission applications from all teams.' },
  { icon: Users,    label: 'Role-Based Access',    desc: 'Shared user directory and role system across all hub applications.' },
  { icon: Activity, label: 'Multi-Team Platform',  desc: 'Apps contributed by Cybersecurity, GRC, and Security Operations teams.' },
  { icon: Zap,      label: 'Instant Launch',       desc: 'Click-to-launch any app with your hub session — no re-authentication needed.' },
  { icon: Shield,   label: 'Security-First',       desc: 'Built on DoD-aligned security standards with session-based authentication.' },
];

export default function Landing() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { dark, toggle } = useTheme();

  useEffect(() => {
    if (!loading && user) navigate('/portal', { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-scorva-bg text-scorva-text">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between h-16 px-6 md:px-10 bg-scorva-surface/90 backdrop-blur border-b border-scorva-border">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-scorva-accent/10 border border-scorva-accent/20">
            <Shield size={16} className="text-scorva-accent" />
          </div>
          <div>
            <span className="text-sm font-bold font-mono tracking-widest text-scorva-accent uppercase">MTSI Hub</span>
            <span className="hidden sm:inline text-xs text-scorva-muted font-mono ml-2">Security App Factory</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="p-1.5 rounded-md text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover transition-colors"
            title="Toggle theme"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={() => navigate('/login')}
            className="btn-primary py-2 px-5"
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-6 md:px-10 pt-20 pb-24">
        <div className="absolute inset-0 cyber-grid pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-scorva-accent/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-scorva-accent/10 border border-scorva-accent/20 mb-6">
            <Lock size={12} className="text-scorva-accent" />
            <span className="text-xs font-mono text-scorva-accent tracking-widest uppercase">MTSI Security Hub · Unified App Platform</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-scorva-text leading-tight tracking-tight mb-6">
            All Your Mission Apps,<br />
            <span className="text-scorva-accent">One Secure Hub.</span>
          </h1>

          <p className="text-lg text-scorva-muted max-w-2xl mx-auto mb-10 leading-relaxed">
            MTSI Security Hub is the unified launch portal for all security and compliance
            applications across every team — one login, single sign-on, every tool.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="btn-primary py-3 px-8 text-base"
            >
              Sign In to Hub
              <ArrowRight size={18} />
            </button>
            <a href="#apps" className="btn-secondary py-3 px-8 text-base">
              Browse Apps
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats band ── */}
      <section className="border-y border-scorva-border bg-scorva-surface">
        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {STATS.map(s => (
            <div key={s.label}>
              <div className="text-2xl font-bold font-mono text-scorva-accent">{s.value}</div>
              <div className="text-xs text-scorva-muted mt-0.5 uppercase tracking-wider font-mono">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── App Cards ── */}
      <section id="apps" className="max-w-6xl mx-auto px-6 md:px-10 py-24">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="h-px w-8 bg-scorva-accent/40" />
            <span className="text-xs font-mono text-scorva-accent uppercase tracking-widest">Applications</span>
            <div className="h-px w-8 bg-scorva-accent/40" />
          </div>
          <h2 className="text-3xl font-bold text-scorva-text">Mission App Catalog</h2>
          <p className="text-scorva-muted mt-3 max-w-xl mx-auto">
            Purpose-built tools from every team — all accessible through a single hub session.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {APPS.map(app => {
            const Icon   = ICON_MAP[app.icon] || Shield;
            const colors = COLOR_MAP[app.color];
            return (
              <div
                key={app.id}
                className={`card p-6 transition-all group ${colors.card}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${colors.icon}`}>
                      <Icon size={22} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-scorva-text font-mono tracking-wide">
                        {app.name}
                      </h3>
                      <p className="text-xs text-scorva-muted">{app.tagline}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-scorva-muted bg-scorva-hover px-2 py-1 rounded-md border border-scorva-border">
                    {app.team}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm text-scorva-muted leading-relaxed mb-4">{app.desc}</p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {app.tags.map(tag => (
                    <span key={tag} className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${colors.badge}`}>
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-mono text-scorva-muted">Live</span>
                  </div>
                  <button
                    onClick={() => navigate('/login')}
                    className="flex items-center gap-1.5 text-xs font-medium text-scorva-accent hover:text-scorva-accent-light transition-colors"
                  >
                    Sign in to launch <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Platform Features ── */}
      <section className="bg-scorva-surface border-y border-scorva-border">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-20">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="h-px w-8 bg-scorva-accent/40" />
              <span className="text-xs font-mono text-scorva-accent uppercase tracking-widest">Platform</span>
              <div className="h-px w-8 bg-scorva-accent/40" />
            </div>
            <h2 className="text-3xl font-bold text-scorva-text">Built for mission teams</h2>
            <p className="text-scorva-muted mt-3 max-w-xl mx-auto">
              A unified platform built on DoD-aligned security principles — not just a list of links.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="card p-5 hover:border-scorva-accent/30 transition-colors group">
                <div className="inline-flex p-2.5 rounded-xl bg-scorva-accent/10 border border-scorva-accent/20 mb-4">
                  <Icon size={18} className="text-scorva-accent" />
                </div>
                <h3 className="text-sm font-semibold text-scorva-text mb-2 group-hover:text-scorva-accent transition-colors">
                  {label}
                </h3>
                <p className="text-xs text-scorva-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-3xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-scorva-accent/10 border border-scorva-accent/20 mb-6">
          <Zap size={24} className="text-scorva-accent" />
        </div>
        <h2 className="text-3xl font-bold text-scorva-text mb-4">Ready to take command?</h2>
        <p className="text-scorva-muted mb-8">
          Sign in once with your organizational credentials and launch any mission app instantly.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="btn-primary py-3 px-10 text-base"
        >
          Sign In to MTSI Hub
          <ArrowRight size={18} />
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-scorva-border bg-scorva-surface">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-scorva-accent" />
            <span className="text-xs font-mono text-scorva-accent font-bold tracking-widest">MTSI Hub</span>
            <span className="text-xs text-scorva-muted">Security App Factory</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-scorva-muted font-mono">
            <span>NIST SP 800-53 Rev 5</span>
            <span>·</span>
            <span>v1.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
