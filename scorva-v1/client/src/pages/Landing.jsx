import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import {
  Shield, ShieldCheck, Activity, AlertTriangle,
  Monitor, Users, BookOpen, ArrowRight, Lock,
  Zap, BarChart3, Globe, Sun, Moon,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const FEATURES = [
  {
    icon: ShieldCheck,
    label: 'Authorization Management',
    desc: 'Track Authority to Operate (ATO) packages, manage NIST 800-53 controls, and remediate findings via integrated POAM workflows.',
    color: 'indigo',
  },
  {
    icon: Activity,
    label: 'Continuous Monitoring',
    desc: 'Schedule and track ConMon tasks, assign findings, and maintain a live compliance posture with real-time CVE threat intelligence.',
    color: 'cyan',
  },
  {
    icon: AlertTriangle,
    label: 'Vulnerability Tracking',
    desc: 'Centralize Plan of Action & Milestones (POAM) items with severity scoring, responsible parties, and scheduled remediation dates.',
    color: 'orange',
  },
  {
    icon: Monitor,
    label: 'Asset Inventory',
    desc: 'Manage devices, hardware tokens, and software licenses in one place with compliance status and expiration tracking.',
    color: 'teal',
  },
  {
    icon: Users,
    label: 'Access Governance',
    desc: 'Administer user accounts, define roles, manage official documents & records, and maintain site-level access controls.',
    color: 'blue',
  },
  {
    icon: BarChart3,
    label: 'Audit & Reporting',
    desc: 'Full system-wide audit trail with filterable logs, notification management, and exportable compliance posture reports.',
    color: 'violet',
  },
];

const COLOR_MAP = {
  indigo:  'bg-indigo-500/10  text-indigo-500  dark:text-indigo-400  border-indigo-500/20',
  cyan:    'bg-cyan-500/10    text-cyan-600    dark:text-cyan-400    border-cyan-500/20',
  orange:  'bg-orange-500/10  text-orange-500  dark:text-orange-400  border-orange-500/20',
  teal:    'bg-teal-500/10    text-teal-600    dark:text-teal-400    border-teal-500/20',
  blue:    'bg-blue-500/10    text-blue-600    dark:text-blue-400    border-blue-500/20',
  violet:  'bg-violet-500/10  text-violet-500  dark:text-violet-400  border-violet-500/20',
};

export default function Landing() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { dark, toggle } = useTheme();
  const hubRequestUrl = `${import.meta.env.VITE_HUB_URL || 'http://localhost:3010'}/request-access?app=scorva`;
  const reason = new URLSearchParams(window.location.search).get('reason');

  // If already logged in, offer to go to portal (don't force redirect — let them see the landing)
  useEffect(() => {
    if (!loading && user) {
      navigate('/portal', { replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-scorva-bg text-scorva-text relative overflow-hidden">
      <div className="sc-landing-grid absolute inset-0 pointer-events-none" />
      <div className="sc-landing-glow-a absolute pointer-events-none" />
      <div className="sc-landing-glow-b absolute pointer-events-none" />

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between h-16 px-6 md:px-10 bg-scorva-surface/90 backdrop-blur border-b border-scorva-border relative">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-scorva-accent/10 border border-scorva-accent/20">
            <Shield size={16} className="text-scorva-accent" />
          </div>
          <div>
            <span className="text-sm font-bold font-mono tracking-widest text-scorva-accent uppercase">SCORVA</span>
            <span className="hidden sm:inline text-xs text-scorva-muted font-mono ml-2">Cyber Command Center</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="p-1.5 rounded-md text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover transition-colors"
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
        <div className="relative max-w-4xl mx-auto text-center">
          {reason === 'scorva_access_required' && (
            <div className="mb-6 inline-flex max-w-2xl items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs">
              Your account authenticated, but SCORVA access has not been provisioned yet. Submit a HUB request and the admins can finish the handoff.
            </div>
          )}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-scorva-accent/10 border border-scorva-accent/20 mb-6">
            <Lock size={12} className="text-scorva-accent" />
            <span className="text-xs font-mono text-scorva-accent tracking-widest uppercase">NIST SP 800-53 Rev 5 · RMF Compliant</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-scorva-text leading-tight tracking-tight mb-6">
            Cyber compliance,<br />
            <span className="text-scorva-accent">mission ready.</span>
          </h1>

          <p className="text-lg text-scorva-muted max-w-2xl mx-auto mb-10 leading-relaxed">
            SCORVA unifies authorization management, continuous monitoring, asset inventory,
            and governance into a single mission-ready platform — built for DoD and federal systems.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="btn-primary py-3 px-8 text-base"
            >
              Sign In to Portal
              <ArrowRight size={18} />
            </button>
            <a
              href={hubRequestUrl}
              className="btn-secondary py-3 px-8 text-base"
            >
              Request SCORVA Access
            </a>
            <a
              href="#features"
              className="btn-secondary py-3 px-8 text-base"
            >
              Explore Features
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats band ── */}
      <section className="border-y border-scorva-border bg-scorva-surface">
        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: '800+', label: 'NIST Controls' },
            { value: '5', label: 'Mission Apps' },
            { value: 'Real-time', label: 'CVE Threat Feed' },
            { value: 'FISMA', label: 'Ready' },
          ].map(s => (
            <div key={s.label}>
              <div className="text-2xl font-bold font-mono text-scorva-accent">{s.value}</div>
              <div className="text-xs text-scorva-muted mt-0.5 uppercase tracking-wider font-mono">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="max-w-6xl mx-auto px-6 md:px-10 py-24">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="h-px w-8 bg-scorva-accent/40" />
            <span className="text-xs font-mono text-scorva-accent uppercase tracking-widest">Capabilities</span>
            <div className="h-px w-8 bg-scorva-accent/40" />
          </div>
          <h2 className="text-3xl font-bold text-scorva-text">Everything your team needs</h2>
          <p className="text-scorva-muted mt-3 max-w-xl mx-auto">
            Five purpose-built mission modules, each a full-featured application in its own right.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, label, desc, color }) => (
            <div key={label} className="sc-feature-card p-6 group">
              <div className={`inline-flex p-2.5 rounded-xl border mb-4 ${COLOR_MAP[color]}`}>
                <Icon size={20} />
              </div>
              <h3 className="text-sm font-semibold text-scorva-text mb-2 group-hover:text-scorva-accent transition-colors">
                {label}
              </h3>
              <p className="text-xs text-scorva-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Mission apps preview ── */}
      <section className="bg-scorva-surface border-y border-scorva-border">
        <div className="max-w-5xl mx-auto px-6 md:px-10 py-20 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="h-px w-8 bg-scorva-accent/40" />
            <span className="text-xs font-mono text-scorva-accent uppercase tracking-widest">Mission Apps</span>
            <div className="h-px w-8 bg-scorva-accent/40" />
          </div>
          <h2 className="text-3xl font-bold text-scorva-text mb-4">Five apps. One platform.</h2>
          <p className="text-scorva-muted max-w-lg mx-auto mb-12">
            Each module launches as its own dedicated application — focused, fast, and purpose-built.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {[
              { label: 'Authorization', sub: 'ATO · Controls · POAM',       icon: ShieldCheck, color: 'text-indigo-400' },
              { label: 'Monitoring',    sub: 'ConMon · Tasks · Trackers',    icon: Activity,    color: 'text-cyan-400' },
              { label: 'Assets',        sub: 'Devices · YubiKeys · Licenses',      icon: Monitor, color: 'text-teal-400' },
              { label: 'Administration',sub: 'Users · Sites · Documents',    icon: Users,       color: 'text-blue-400' },
              { label: 'Command Center',sub: 'Posture · Intel · Activity',   icon: Globe,       color: 'text-scorva-accent' },
            ].map(({ label, sub, icon: Icon, color }) => (
              <div key={label} className="sc-feature-card p-4 flex flex-col items-center text-center gap-3">
                <Icon size={24} className={color} />
                <div>
                  <div className="text-xs font-semibold text-scorva-text">{label}</div>
                  <div className="text-[10px] text-scorva-muted mt-0.5 leading-snug">{sub}</div>
                </div>
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
          Sign in with your organizational credentials to access your mission modules.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="btn-primary py-3 px-10 text-base"
        >
          Sign In to SCORVA
          <ArrowRight size={18} />
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-scorva-border bg-scorva-surface">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-scorva-accent" />
            <span className="text-xs font-mono text-scorva-accent font-bold tracking-widest">SCORVA</span>
            <span className="text-xs text-scorva-muted">Cyber Command Center</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-scorva-muted font-mono">
            <span>NIST SP 800-53 Rev 5</span>
            <span>·</span>
            <span>v3.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
