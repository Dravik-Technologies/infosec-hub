import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useEffect } from 'react';
import {
  Shield, ShieldCheck, FileText, BarChart3, Flame,
  ArrowRight, Lock, Sun, Moon, Zap, Globe, Users, Activity, Terminal, Command,
} from 'lucide-react';

const ICON_MAP = { ShieldCheck, FileText, BarChart3, Shield, Flame, Command };

const APPS = [
  {
    id: 'scorva', name: 'SCORVA', tagline: 'Cyber Command Center',
    desc: 'NIST SP 800-53 Rev 5 compliance management — ATO tracking, continuous monitoring, POAM, asset inventory, and access governance.',
    color: 'teal', icon: 'ShieldCheck', team: 'Cybersecurity',
    tags: ['NIST 800-53', 'RMF', 'ATO', 'ConMon'],
  },
  {
    id: 'crater', name: 'CRATER', tagline: 'eMASS RMF Toolkit',
    desc: 'eMASS-aligned RMF package builder with SCTM, POAM management, vulnerability tracking, diagrams, and compliance reporting.',
    color: 'indigo', icon: 'FileText', team: 'GRC',
    tags: ['eMASS', 'RMF', 'SCTM', 'POAM'],
  },
  {
    id: 'mash', name: 'MASH', tagline: 'MTSI Advanced Sentinel Hub',
    desc: 'Security Managers Workspace shell for the future facility, personnel, and activities-security rebuild that will feed NEXUS.',
    color: 'gold', icon: 'BarChart3', team: 'Security Operations',
    tags: ['Facility Security', 'Personnel Security', 'Activities Security'],
  },
  {
    id: 'lava', name: 'LAVA', tagline: 'Network Access Portal',
    desc: 'Magmatic onboarding portal with digitized DD Form 2875 SAAR workflow, Vulcan approval command, and hardware asset provisioning.',
    color: 'orange', icon: 'Flame', team: 'Network Administration',
    tags: ['SAAR', 'DD Form 2875', 'YubiKey'],
  },
  {
    id: 'nexus', name: 'NEXUS', tagline: 'Program Mission Command',
    desc: 'Executive command surface for program management, non-IT security posture, and SCORVA-fed IT and cybersecurity readiness.',
    color: 'cyan', icon: 'Command', team: 'Program Management',
    tags: ['Real Estate', 'Construction', 'Accreditation'],
  },
];

const COLOR_MAP = {
  teal: {
    card:  'hover:border-teal-500/50',
    badge: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20',
    icon:  'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    top:   'bg-teal-500',
    glow:  'group-hover:shadow-[0_0_32px_rgb(20_184_166/0.12)]',
  },
  indigo: {
    card:  'hover:border-indigo-500/50',
    badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
    icon:  'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    top:   'bg-indigo-500',
    glow:  'group-hover:shadow-[0_0_32px_rgb(99_102_241/0.12)]',
  },
  gold: {
    card:  'hover:border-yellow-500/50',
    badge: 'bg-scorva-gold/10 text-scorva-gold border border-scorva-gold/20',
    icon:  'bg-scorva-gold/10 text-scorva-gold border-scorva-gold/20',
    top:   'bg-yellow-500',
    glow:  'group-hover:shadow-[0_0_32px_rgb(234_179_8/0.12)]',
  },
  orange: {
    card:  'hover:border-orange-500/50',
    badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20',
    icon:  'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    top:   'bg-orange-500',
    glow:  'group-hover:shadow-[0_0_32px_rgb(249_115_22/0.12)]',
  },
  cyan: {
    card:  'hover:border-cyan-500/50',
    badge: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20',
    icon:  'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    top:   'bg-cyan-500',
    glow:  'group-hover:shadow-[0_0_32px_rgb(6_182_212/0.12)]',
  },
};

const FEATURES = [
  { icon: Lock,     label: 'Unified Auth',       desc: 'One login grants SSO access to every platform app via secure token exchange.' },
  { icon: Globe,    label: 'App Factory',         desc: 'Browse and launch purpose-built mission applications from all security teams.' },
  { icon: Users,    label: 'Role-Based Access',   desc: 'Centralized identity, site assignments, and app-specific role mapping.' },
  { icon: Activity, label: 'Multi-Team Platform', desc: 'Apps contributed by Cybersecurity, GRC, and Security Operations teams.' },
  { icon: Zap,      label: 'Instant Launch',      desc: 'Click-to-launch any app with your hub session — no re-authentication needed.' },
  { icon: Shield,   label: 'Security-First',      desc: 'DoD-aligned security standards with session-based authentication throughout.' },
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

      {/* ── Classification strip ── */}
      <div className="h-7 flex items-center justify-center gap-4 px-6 border-b border-scorva-border/60 bg-scorva-surface/60 backdrop-blur-sm overflow-hidden">
        <span className="text-[9px] font-mono text-scorva-muted tracking-[0.3em] uppercase hidden sm:inline">MTSI Security App Factory</span>
        <span className="w-1 h-1 rounded-full bg-scorva-border hidden sm:inline-block" />
        <span className="text-[9px] font-mono text-scorva-accent tracking-[0.2em] uppercase">NIST 800-53 Rev 5 · DoD Compliant · v2.0</span>
        <span className="w-1 h-1 rounded-full bg-scorva-border hidden sm:inline-block" />
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] font-mono text-emerald-500 dark:text-emerald-400 tracking-[0.2em] uppercase">All Systems Operational</span>
        </div>
      </div>

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between h-16 px-6 md:px-10 bg-scorva-surface/80 backdrop-blur-xl border-b border-scorva-border">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-scorva-accent/10 border border-scorva-accent/30 glow-border">
            <Shield size={17} className="text-scorva-accent" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border-2 border-scorva-surface animate-pulse" />
          </div>
          <div>
            <span className="text-sm font-black font-mono tracking-[0.2em] text-scorva-accent uppercase text-glow">MTSI Hub</span>
            <span className="hidden sm:inline text-xs text-scorva-muted font-mono ml-2 tracking-wide">/ Security App Factory</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="p-1.5 rounded-md text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover transition-colors" title="Toggle theme">
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={() => navigate('/login')} className="btn-primary py-2 px-5 glow-border">
            Sign In
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden min-h-[90vh] flex items-center">
        {/* Layered background atmosphere */}
        <div className="absolute inset-0 cyber-grid-dense pointer-events-none opacity-70" />
        <div className="absolute inset-0 scanlines pointer-events-none" />
        <div className="absolute top-[-10%] left-[-5%] w-[700px] h-[700px] bg-scorva-accent/6 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-15%] right-[-5%] w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-[30%] right-[15%] w-[300px] h-[300px] bg-scorva-accent/4 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative w-full max-w-7xl mx-auto px-6 md:px-10 py-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-16 items-center">

            {/* Left: content */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-scorva-accent/10 border border-scorva-accent/30 mb-10">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-mono text-scorva-accent tracking-[0.35em] uppercase">All Systems Operational</span>
              </div>

              <h1 className="font-black leading-none tracking-tighter mb-8">
                <span className="block text-6xl sm:text-7xl md:text-8xl text-scorva-text">All Your</span>
                <span className="block text-6xl sm:text-7xl md:text-8xl text-scorva-text">Mission Apps.</span>
                <span className="block text-6xl sm:text-7xl md:text-8xl text-scorva-accent text-glow">One Secure Hub.</span>
              </h1>

              <p className="text-base md:text-lg text-scorva-muted max-w-lg leading-relaxed mb-10">
                MTSI Security Hub is the unified launch portal for every security and compliance
                application — one login, single sign-on, centralized identity control.
              </p>

              <div className="flex flex-col sm:flex-row items-start gap-3 mb-14">
                <button onClick={() => navigate('/login')} className="btn-primary py-3.5 px-10 text-base glow-border">
                  Access Hub <ArrowRight size={18} />
                </button>
                <a href="#apps" className="btn-secondary py-3.5 px-10 text-base">
                  Browse Apps
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono text-scorva-muted">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-scorva-accent animate-pulse" />
                  <span>{APPS.length} Mission Apps</span>
                </div>
                <span className="text-scorva-border">·</span>
                <span>SSO-Enabled</span>
                <span className="text-scorva-border">·</span>
                <span>NIST SP 800-53 Rev 5</span>
                <span className="text-scorva-border">·</span>
                <span>DoD Compliant</span>
              </div>
            </div>

            {/* Right: live status panel */}
            <div className="relative hidden lg:block">
              {/* HUD corner brackets — all 4 */}
              <div className="absolute -top-3 -left-3 w-8 h-8 border-t-2 border-l-2 border-scorva-accent/60 pointer-events-none" />
              <div className="absolute -top-3 -right-3 w-8 h-8 border-t-2 border-r-2 border-scorva-accent/60 pointer-events-none" />
              <div className="absolute -bottom-3 -left-3 w-8 h-8 border-b-2 border-l-2 border-scorva-accent/60 pointer-events-none" />
              <div className="absolute -bottom-3 -right-3 w-8 h-8 border-b-2 border-r-2 border-scorva-accent/60 pointer-events-none" />

              <div className="glass border border-scorva-accent/20 rounded-xl overflow-hidden glow-border">
                {/* Terminal header */}
                <div className="flex items-center justify-between px-4 py-3 bg-scorva-accent/8 border-b border-scorva-border/70">
                  <div className="flex items-center gap-2">
                    <Terminal size={11} className="text-scorva-accent" />
                    <span className="text-[9px] font-mono text-scorva-accent tracking-[0.35em] uppercase">Platform Status</span>
                    <span className="text-[9px] font-mono text-scorva-border/80">/ SYS-001</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="hidden sm:inline text-[9px] font-mono text-scorva-muted/60 tracking-[0.25em] uppercase">CTRL</span>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest">All Ops</span>
                    </div>
                  </div>
                </div>

                {/* App rows */}
                <div className="p-3 space-y-2">
                  {APPS.map(app => {
                    const Icon = ICON_MAP[app.icon] || Shield;
                    const colors = COLOR_MAP[app.color];
                    return (
                      <div key={app.id} className="flex items-center gap-3 p-3 rounded-lg bg-scorva-bg/70 border border-scorva-border/40 hover:border-scorva-accent/30 transition-colors">
                        <div className={`p-2 rounded-lg border ${colors.icon} shrink-0`}>
                          <Icon size={13} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black font-mono text-scorva-text tracking-widest uppercase">{app.name}</div>
                          <div className="text-[10px] text-scorva-muted truncate">{app.tagline}</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[9px] font-mono text-emerald-400 uppercase">Live</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Metrics footer */}
                <div className="grid grid-cols-3 divide-x divide-scorva-border/60 border-t border-scorva-border/70">
                  {[
                    { value: String(APPS.length), label: 'Systems', sub: 'Online' },
                    { value: 'SSO',    label: 'Auth Mode', sub: 'Token' },
                    { value: '99.9%', label: 'Uptime',    sub: 'SLA' },
                  ].map(m => (
                    <div key={m.label} className="py-3 text-center">
                      <div className="text-sm font-black font-mono text-scorva-accent">{m.value}</div>
                      <div className="text-[9px] font-mono text-scorva-muted uppercase tracking-widest mt-0.5">{m.label}</div>
                      <div className="text-[8px] font-mono text-scorva-border uppercase tracking-wider">{m.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Stats band ── */}
      <section className="relative overflow-hidden border-y border-scorva-border bg-scorva-surface">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-scorva-accent/50 to-transparent pointer-events-none" />
        <div className="absolute inset-0 cyber-grid opacity-40 pointer-events-none" />
        <div className="absolute inset-0 scanlines pointer-events-none opacity-60" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-scorva-border/60">
            {[
              { value: String(APPS.length), label: 'Mission Apps',    sub: 'In Production' },
              { value: 'SSO',               label: 'Single Sign-On', sub: 'Token Exchange' },
              { value: 'NIST',              label: '800-53 Ready',   sub: 'Rev 5 Aligned' },
              { value: 'DoD',               label: 'Compliant',      sub: 'Security Standards' },
            ].map(s => (
              <div key={s.label} className="py-9 px-6 text-center">
                <div className="text-4xl font-black font-mono text-scorva-accent text-glow">{s.value}</div>
                <div className="text-xs font-mono text-scorva-text uppercase tracking-widest mt-2">{s.label}</div>
                <div className="text-[10px] text-scorva-muted mt-0.5 tracking-wide">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── App Catalog ── */}
      <section id="apps" className="max-w-7xl mx-auto px-6 md:px-10 py-24">
        <div className="mb-14">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-[2px] bg-scorva-accent" />
            <span className="text-[10px] font-mono text-scorva-accent uppercase tracking-[0.35em]">01 / Applications</span>
            <div className="w-8 h-[2px] bg-scorva-accent/30" />
          </div>
          <h2 className="text-5xl font-black text-scorva-text tracking-tight">Mission App Catalog</h2>
          <p className="text-scorva-muted mt-3 text-base max-w-xl">
            Purpose-built tools from every team — all accessible through a single authenticated session.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {APPS.map(app => {
            const Icon = ICON_MAP[app.icon] || Shield;
            const colors = COLOR_MAP[app.color];
            return (
              <div key={app.id} className={`relative card p-6 transition-all duration-300 group overflow-hidden ${colors.card} ${colors.glow}`}>
                <div className={`absolute top-0 left-0 right-0 h-[3px] ${colors.top} opacity-60 group-hover:opacity-100 transition-opacity`} />

                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl border ${colors.icon}`}>
                      <Icon size={22} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-scorva-text font-mono tracking-widest uppercase">{app.name}</h3>
                      <p className="text-xs text-scorva-muted mt-0.5">{app.tagline}</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-scorva-muted bg-scorva-hover px-2 py-1 rounded border border-scorva-border shrink-0">
                    {app.team}
                  </span>
                </div>

                <p className="text-sm text-scorva-muted leading-relaxed mb-5">{app.desc}</p>

                <div className="flex flex-wrap gap-1.5 mb-5">
                  {app.tags.map(tag => (
                    <span key={tag} className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${colors.badge}`}>{tag}</span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-scorva-border/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-mono text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">Operational</span>
                  </div>
                  <button onClick={() => navigate('/login')} className="flex items-center gap-1.5 text-xs font-semibold text-scorva-accent hover:text-scorva-accent-light transition-colors">
                    Sign in to launch <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Platform Features ── */}
      <section className="relative bg-scorva-surface border-y border-scorva-border overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-6 md:px-10 py-20">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-[2px] bg-scorva-accent" />
              <span className="text-[10px] font-mono text-scorva-accent uppercase tracking-[0.35em]">02 / Platform</span>
            </div>
            <h2 className="text-4xl font-black text-scorva-text tracking-tight">Built for mission teams</h2>
            <p className="text-scorva-muted mt-3 max-w-xl">
              A unified platform built on DoD-aligned security principles — not just a list of links.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="card p-5 hover:border-scorva-accent/30 transition-all duration-300 group hover:glow-border">
                <div className="inline-flex p-2.5 rounded-xl bg-scorva-accent/10 border border-scorva-accent/20 mb-4">
                  <Icon size={16} className="text-scorva-accent" />
                </div>
                <h3 className="text-sm font-bold text-scorva-text mb-1.5 group-hover:text-scorva-accent transition-colors font-mono tracking-wide">{label}</h3>
                <p className="text-xs text-scorva-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 cyber-grid-dense pointer-events-none opacity-60" />
        <div className="absolute inset-0 scanlines pointer-events-none opacity-80" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-scorva-accent/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-6 py-28 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-scorva-accent/10 border border-scorva-accent/30 mb-8 glow-border">
            <Zap size={26} className="text-scorva-accent" />
          </div>
          <h2 className="text-5xl font-black text-scorva-text tracking-tight mb-5">Ready to take command?</h2>
          <p className="text-scorva-muted mb-10 text-base max-w-md mx-auto leading-relaxed">
            Sign in once with your organizational credentials and launch any mission app instantly.
          </p>
          <button onClick={() => navigate('/login')} className="btn-primary py-4 px-12 text-base glow-border">
            Sign In to MTSI Hub <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-scorva-border bg-scorva-surface">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Shield size={13} className="text-scorva-accent" />
            <span className="text-xs font-black font-mono text-scorva-accent tracking-[0.2em] uppercase text-glow">MTSI Hub</span>
            <span className="text-xs text-scorva-muted">/ Security App Factory</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-scorva-muted font-mono">
            <span>NIST SP 800-53 Rev 5</span>
            <span className="text-scorva-border">·</span>
            <span>DoD Compliant</span>
            <span className="text-scorva-border">·</span>
            <span>v2.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
