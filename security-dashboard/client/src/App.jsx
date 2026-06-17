import { useState, useEffect } from 'react';
import { AUTH, WS, useClock } from './app.js';
import LoginPage from './pages/LoginPage.jsx';
import OverviewPage from './pages/OverviewPage.jsx';
import FacilityPage from './pages/FacilityPage.jsx';
import PersonnelPage from './pages/PersonnelPage.jsx';
import ActivitiesPage from './pages/ActivitiesPage.jsx';
import DocumentsPage from './pages/DocumentsPage.jsx';
import DD254Page from './pages/DD254Page.jsx';
import MediaPage from './pages/MediaPage.jsx';
import InspectionsPage from './pages/InspectionsPage.jsx';

const THEME_KEY = 'mash-theme';
const SECTIONS = [
  { id: 'overview',     label: 'Overview',     dot: '#64748b', accent: 'var(--primary)' },
  { id: 'facility',     label: 'Facility',     dot: '#0f766e', accent: 'var(--facility)' },
  { id: 'personnel',    label: 'Personnel',    dot: '#6d28d9', accent: 'var(--personnel)' },
  { id: 'activities',   label: 'Activities',   dot: '#0369a1', accent: 'var(--activities)' },
  { id: 'documents',    label: 'Documents',    dot: '#9a3412', accent: 'var(--docs)' },
  { id: 'dd254',        label: 'DD254',        dot: '#b45309', accent: 'var(--docs)' },
  { id: 'media',        label: 'Media',        dot: '#7e22ce', accent: 'var(--media)' },
  { id: 'inspections',  label: 'Inspections',  dot: '#166534', accent: 'var(--inspections)' },
];

const ROLE_NAV = {
  corporate_security_admin: 'all',
  facility_security_mgr:    ['overview','facility','activities','inspections'],
  personnel_security_mgr:   ['overview','personnel','activities'],
  activities_security_mgr:  ['overview','activities'],
  document_control_mgr:     ['overview','documents','dd254'],
  media_control_mgr:        ['overview','media'],
  viewer:                   'all',
};

function decodeJwt(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(atob(b64 + '='.repeat((4 - b64.length % 4) % 4)));
  } catch { return null; }
}

function Header({ user, sites, siteId, onSiteChange, section, onSection, onLogout, theme, onToggleTheme }) {
  const clock = useClock();
  const wsRole = user?.wsRole || 'viewer';
  const allowedNav = ROLE_NAV[wsRole];
  const visibleSections = SECTIONS.filter(s =>
    allowedNav === 'all' || allowedNav.includes(s.id)
  );
  const activeSection = SECTIONS.find(s => s.id === section) || SECTIONS[0];
  const roleLabel = user?.displayRole || user?.title || user?.jobRole || user?.securityRole || user?.hubRole || user?.role || 'Security Staff';
  const siteText = siteId
    ? getSiteLabel(sites.find(s => s.id === siteId)) || siteId
    : (user?.primarySiteId || user?.siteId || (user?.siteIds?.length > 1 ? `${user.siteIds.length} sites` : user?.siteIds?.[0]) || 'All sites');
  const initials = (user?.initials
    || user?.name?.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('')
    || user?.username?.slice(0, 2)
    || 'SM'
  ).toUpperCase();

  return (
    <header className="ws-header" style={{ '--section-accent': activeSection.accent }}>
      <div className="ws-header-top">
        <div className="ws-brand">
          <div className="ws-brand-mark">
            <span>S</span>
          </div>
          <div>
            <div className="ws-brand-name">Security Managers Workspace</div>
            <div className="ws-brand-sub">MASH</div>
          </div>
        </div>

        <div className="ws-identity">
          <button
            type="button"
            className="ws-theme-toggle"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? 'Light mode' : 'Night mode'}
          </button>
          {sites.length > 1 && (
            <div className="ws-site-filter">
              <span>Site:</span>
              <select value={siteId} onChange={e => onSiteChange(e.target.value)}>
                <option value="">All Sites</option>
                {sites.map(s => <option key={s.id} value={s.id}>{getSiteLabel(s)}</option>)}
              </select>
            </div>
          )}
          <span className="ws-role-chip">{roleLabel}</span>
          <span className="ws-site-chip">{siteText}</span>
          <div className="ws-user-cluster">
            <div className="ws-user-avatar" aria-hidden="true">{initials}</div>
            <div className="ws-user-meta">
              <div className="ws-user-name">{user?.name || user?.username}</div>
              <div className="ws-user-time">{clock}</div>
            </div>
          </div>
          <button type="button" className="ws-logout" onClick={onLogout}>Sign out</button>
        </div>
      </div>

      <nav className="ws-nav">
        {visibleSections.map(s => (
          <button
            key={s.id}
            type="button"
            className={`ws-nav-link${section === s.id ? ' active' : ''}`}
            onClick={() => onSection(s.id)}
          >
            <span className="ws-nav-dot" style={{ background: section === s.id ? s.dot : 'var(--border)' }} />
            {s.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

function getSiteLabel(s) {
  return s?.label || s?.name || s?.id || '';
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [user, setUser] = useState(() => {
    const stored = AUTH.getUser();
    if (stored) return stored;
    const params = new URLSearchParams(window.location.search);
    const tok = params.get('ws_token') || params.get('mash_token');
    if (tok) {
      const payload = decodeJwt(tok);
      if (payload) {
        AUTH.setToken(tok);
        AUTH.setUser(payload);
        setTimeout(() => window.history.replaceState({}, '', '/'), 0);
        return payload;
      }
    }
    return null;
  });
  const [authChecked, setAuthChecked] = useState(() => Boolean(AUTH.getUser()));

  const [section, setSection] = useState('overview');
  const [siteId, setSiteId] = useState('');
  const [sites, setSites] = useState([]);
  const activeSection = SECTIONS.find(s => s.id === section) || SECTIONS[0];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (user) {
      setAuthChecked(true);
      return;
    }
    fetch('/api/me', { credentials: 'include' })
      .then(async res => {
        if (!res.ok) return null;
        return res.json();
      })
      .then(payload => {
        if (payload) {
          AUTH.setUser(payload);
          setUser(payload);
        }
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    WS.getSites().then(s => {
      if (Array.isArray(s?.sites)) setSites(s.sites);
    });
  }, [user]);

  function handleLogin(u) { setUser(u); }
  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: AUTH.hdrs(),
        credentials: 'include',
      });
    } catch {}
    AUTH.clearAll();
    setUser(null);
  }
  function handleToggleTheme() { setTheme(t => t === 'dark' ? 'light' : 'dark'); }

  if (!authChecked) {
    return (
      <div className="ws-login-shell">
        <div className="ws-login-card">
          <div className="ws-login-mark">S</div>
          <div className="ws-login-kicker">Security Managers Workspace</div>
          <h1>MASH</h1>
          <p>Restoring secure session…</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage onLogin={handleLogin} />;

  const pageProps = { user, siteId, sites };

  return (
    <div className="ws-shell" data-section={section}>
      <div className="ws-shell-glow ws-shell-glow-a" aria-hidden="true" />
      <div className="ws-shell-glow ws-shell-glow-b" aria-hidden="true" />
      <div className="ws-grid-overlay" aria-hidden="true" />
      <Header
        user={user}
        sites={sites}
        siteId={siteId}
        onSiteChange={setSiteId}
        section={section}
        onSection={setSection}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
      <main className="ws-main" style={{ '--section-accent': activeSection.accent }}>
        {section === 'overview'    && <OverviewPage     {...pageProps} />}
        {section === 'facility'    && <FacilityPage     {...pageProps} />}
        {section === 'personnel'   && <PersonnelPage    {...pageProps} />}
        {section === 'activities'  && <ActivitiesPage   {...pageProps} />}
        {section === 'documents'   && <DocumentsPage    {...pageProps} />}
        {section === 'dd254'       && <DD254Page        {...pageProps} />}
        {section === 'media'       && <MediaPage        {...pageProps} />}
        {section === 'inspections' && <InspectionsPage  {...pageProps} />}
      </main>
    </div>
  );
}
