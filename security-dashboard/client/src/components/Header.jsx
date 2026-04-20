import { useState } from 'react';
import { useClock, MASH } from '../app.js';
import { GoldLine } from './index.jsx';

export default function Header({ section, onNav, data, currentUser, onLogout }) {
  const clock    = useClock();
  const user     = currentUser || data.settings?.user || {};
  const sites    = data.sites || [];
  const stds     = data.compliance?.standards || [];
  const avg      = sites.length ? Math.round(sites.reduce((a, s) => a + s.compliance, 0) / sites.length) : 0;
  const [isDark,   setIsDark]   = useState(localStorage.getItem('mash-theme') !== 'light');
  const [menuOpen, setMenuOpen] = useState(false);

  function toggleTheme() {
    const goLight = isDark;
    if (goLight) {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('mash-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('mash-theme', 'dark');
    }
    setIsDark(!isDark);
  }

  function handleNav(id) { onNav(id); setMenuOpen(false); }

  const STATUS_ITEMS = [
    { id: 'nispom',  label: 'Personnel Security' },
    { id: 'daapm',   label: 'Audit Readiness'    },
    { id: 'icd705',  label: 'SCIF Controls'      },
    { id: 'tempest', label: 'Emanations Sec.'    },
  ];

  const navItems = [
    { id: 'dashboard',    label: 'Dashboard'    },
    { id: 'sites',        label: 'Sites'        },
    { id: 'employees',    label: 'Employees'    },
    { id: 'documents',    label: 'Documents'    },
    { id: 'compliance',   label: 'Compliance'   },
    { id: 'budget',       label: 'Budget'       },
    { id: 'timeline',     label: 'Timeline'     },
    { id: 'construction', label: 'Construction' },
    { id: 'risks',        label: 'Risks'        },
  ];

  const navIcons = {
    dashboard: 'fa-gauge-high', sites: 'fa-building', employees: 'fa-id-card',
    documents: 'fa-file-shield', compliance: 'fa-shield-halved',
    budget: 'fa-chart-bar', timeline: 'fa-diagram-gantt',
    construction: 'fa-helmet-safety', risks: 'fa-triangle-exclamation',
  };

  return (
    <>
      {/* Mobile slide-out nav */}
      <div className={`mobile-nav ${menuOpen ? 'open' : ''}`}>
        <div className="mb-6" style={{ borderBottom: '1px solid rgba(201,168,76,.15)', paddingBottom: '16px' }}>
          <div className="font-head font-bold uppercase tracking-widest" style={{ color: 'var(--gold)', fontSize: '.7rem', letterSpacing: '.15em' }}>Navigation</div>
        </div>
        {navItems.map(n => (
          <div key={n.id} className={`mobile-nav-item ${section === n.id ? 'active' : ''}`} onClick={() => handleNav(n.id)}>
            <i className={`fa-solid ${navIcons[n.id]} w-5 text-center`} style={{ color: 'var(--gold)', fontSize: '1rem' }} />
            {n.label}
          </div>
        ))}
        <div className="mt-auto pt-6" style={{ borderTop: '1px solid rgba(201,168,76,.1)' }}>
          <div className="text-xs uppercase tracking-widest" style={{ color: 'rgba(201,168,76,.4)', letterSpacing: '.1em' }}>{user.name || 'VET-Kilika'}</div>
          <div className="text-xs mt-0.5" style={{ color: 'rgba(201,168,76,.28)' }}>{user.title || 'Director of Security'}</div>
        </div>
      </div>
      {menuOpen && <div className="fixed inset-0 z-[480]" onClick={() => setMenuOpen(false)} />}

      <header className="hdr">
        {/* Main bar */}
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-[60px] md:h-[64px] flex items-center gap-x-3 sm:gap-x-4">

          {/* Logo */}
          <div className="flex items-center gap-x-2 sm:gap-x-3 shrink-0">
            <div className="logo-ring w-11 h-11 sm:w-14 sm:h-14 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
              style={{ background: '#06121f', border: '1px solid rgba(201,168,76,.42)' }}>
              <img src="/logo-mash.png" alt="MASH" className="w-full h-full object-contain" />
            </div>
            <div className="leading-none hidden sm:block">
              <div className="font-head text-xl font-bold tracking-widest glitch" data-text="MASH" style={{ color: '#e8c96d', letterSpacing: '.12em', textShadow: '0 0 20px rgba(201,168,76,.55)' }}>MASH</div>
              <div className="text-[8px] uppercase tracking-widest mt-0.5" style={{ color: 'rgba(201,168,76,.5)', letterSpacing: '.14em' }}>MTSI Advanced Sentinel Hub</div>
            </div>
            <div className="leading-none sm:hidden">
              <div className="font-head text-lg font-bold" style={{ color: '#e8c96d', letterSpacing: '.1em' }}>MASH</div>
            </div>
          </div>

          {/* Desktop nav */}
          <GoldLine />
          <nav className="hidden md:flex items-center gap-x-0.5 flex-1 justify-center">
            {navItems.map(n => (
              <button key={n.id} className={`nav-btn ${section === n.id ? 'active' : ''}`} onClick={() => handleNav(n.id)}>
                {n.label}
              </button>
            ))}
          </nav>

          {/* Desktop right controls */}
          <div className="hidden md:flex items-center gap-x-3 lg:gap-x-4 shrink-0">
            <div className="relative hidden lg:block">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[9px]" style={{ color: 'rgba(201,168,76,.4)' }} />
              <input placeholder="Search…" className="inp rounded-full pl-8 py-1.5 text-xs" style={{ width: '140px', height: '32px' }} />
            </div>
            <button onClick={toggleTheme} title={isDark ? 'Light Mode' : 'Dark Mode'}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0"
              style={{ background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.2)', color: 'var(--gold)' }}>
              <i className={`fa-solid ${isDark ? 'fa-sun' : 'fa-moon'} text-xs`} />
            </button>
            <GoldLine />
            <div className="text-right leading-none hidden lg:block">
              <div className="flex items-center gap-x-2 justify-end">
                <div className="text-sm font-semibold" style={{ color: 'var(--off-white)' }}>{user.name || 'VET-Kilika'}</div>
                {user.role === 'global_fso'
                  ? <span className="badge b-gold" style={{ fontSize: '.52rem' }}>Global FSO</span>
                  : <span className="badge b-b"    style={{ fontSize: '.52rem' }}>Site Manager</span>}
              </div>
              <div className="text-[9px] mt-0.5 uppercase tracking-wider" style={{ color: 'rgba(201,168,76,.55)' }}>{user.title || 'Director of Security'}</div>
            </div>
            <button onClick={() => MASH.toast('Generating executive briefing PDF…', 'info')} className="btn-gold hidden sm:flex">
              <i className="fa-solid fa-download text-[9px]" /> <span className="hidden lg:inline">Export Briefing</span><span className="lg:hidden">Export</span>
            </button>
            <button onClick={() => MASH.toggleNotif()} className="relative w-8 h-8 flex items-center justify-center transition-colors shrink-0" style={{ color: 'rgba(143,163,192,.5)' }}>
              <i className="fa-solid fa-bell text-sm" />
              <span id="bell-badge" className="absolute top-0.5 right-0 w-4 h-4 bg-red-500 text-[9px] font-bold rounded-full flex items-center justify-center text-white">3</span>
            </button>
            <button onClick={onLogout} title="Sign out"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0"
              style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.18)', color: '#FCA5A5' }}>
              <i className="fa-solid fa-right-from-bracket text-xs" />
            </button>
          </div>

          {/* Mobile right */}
          <div className="flex md:hidden items-center gap-x-2 ml-auto shrink-0">
            <button onClick={toggleTheme}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.2)', color: 'var(--gold)' }}>
              <i className={`fa-solid ${isDark ? 'fa-sun' : 'fa-moon'} text-xs`} />
            </button>
            <button onClick={() => MASH.toggleNotif()} className="relative w-8 h-8 flex items-center justify-center" style={{ color: 'rgba(143,163,192,.5)' }}>
              <i className="fa-solid fa-bell text-sm" />
              <span className="absolute top-0.5 right-0 w-4 h-4 bg-red-500 text-[9px] font-bold rounded-full flex items-center justify-center text-white">3</span>
            </button>
            <button onClick={() => setMenuOpen(o => !o)}
              className="w-9 h-9 rounded-lg flex flex-col items-center justify-center gap-1.5"
              style={{ background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.2)' }}>
              <span className="block w-4 h-0.5 rounded transition-all" style={{ background: 'var(--gold)', transform: menuOpen ? 'rotate(45deg) translate(3px,3px)' : '' }} />
              <span className="block h-0.5 rounded transition-all" style={{ background: 'var(--gold)', width: menuOpen ? '0' : '14px', opacity: menuOpen ? 0 : 1 }} />
              <span className="block w-4 h-0.5 rounded transition-all" style={{ background: 'var(--gold)', transform: menuOpen ? 'rotate(-45deg) translate(3px,-3px)' : '' }} />
            </button>
          </div>
        </div>

        {/* Status bar */}
        <div className="hidden sm:flex status-bar max-w-screen-2xl mx-auto px-4 sm:px-6 h-[36px] items-center gap-x-4 text-[10px] sweep relative overflow-hidden"
          style={{ borderTop: '1px solid rgba(201,168,76,.08)' }}>
          <div className="flex items-center gap-x-2 shrink-0">
            <span className="uppercase tracking-widest font-bold hidden lg:inline" style={{ color: 'rgba(143,163,192,.55)', fontSize: '.6rem', letterSpacing: '.1em' }}>Security Posture</span>
            <div className="w-16 lg:w-24 prog prog-s"><div className="prog-fill p-gold" style={{ width: `${avg}%` }} /></div>
            <span className="font-head font-bold text-sm lg:text-base glow-gold" style={{ color: 'var(--gold)' }}>{avg}%</span>
            <span className="font-bold text-[9px]" style={{ color: 'var(--green)' }}>↑ 4%</span>
          </div>
          <GoldLine />
          <div className="flex items-center gap-x-1.5 shrink-0" style={{ color: 'rgba(143,163,192,.5)' }}>
            <i className="fa-solid fa-building text-[9px]" style={{ color: 'var(--gold)' }} />
            <span>{sites.length} <span className="hidden lg:inline">Facilities Monitored</span><span className="lg:hidden">Sites</span></span>
          </div>
          <GoldLine />
          <div className="hidden lg:flex items-center gap-x-4">
            {STATUS_ITEMS.map(si => {
              const std = stds.find(x => x.id === si.id);
              const ok  = !std || std.percentage >= 90;
              return (
                <div key={si.id} className="flex items-center gap-x-1.5"
                  style={{ color: ok ? 'rgba(143,163,192,.55)' : 'var(--amber)' }}>
                  <i className={`fa-solid ${ok ? 'fa-circle-check' : 'fa-triangle-exclamation'} text-[9px]`}
                    style={{ color: ok ? 'var(--gold)' : '' }} />
                  <span className="uppercase tracking-wider" style={{ fontSize: '.58rem', letterSpacing: '.08em' }}>{si.label}</span>
                </div>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-x-3 shrink-0">
            <div className="flex items-center gap-x-1.5 px-2.5 py-0.5 rounded-full"
              style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)' }}>
              <div className="w-1.5 h-1.5 bg-emerald-400 status-dot" />
              <span className="font-bold text-emerald-300 uppercase" style={{ fontSize: '.58rem', letterSpacing: '.1em' }}>Live</span>
            </div>
            <span className="font-mono hidden md:inline" style={{ color: 'rgba(143,163,192,.3)', fontSize: '.7rem' }}>{clock}</span>
          </div>
        </div>
      </header>
    </>
  );
}
