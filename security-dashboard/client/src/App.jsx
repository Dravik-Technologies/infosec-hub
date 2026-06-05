import { useState, useEffect } from 'react';
import { AUTH, WS, useClock } from './app.js';
import LoginPage from './pages/LoginPage.jsx';
import OverviewPage from './pages/OverviewPage.jsx';
import FacilityPage from './pages/FacilityPage.jsx';
import PersonnelPage from './pages/PersonnelPage.jsx';
import ActivitiesPage from './pages/ActivitiesPage.jsx';
import DocumentsPage from './pages/DocumentsPage.jsx';
import MediaPage from './pages/MediaPage.jsx';
import InspectionsPage from './pages/InspectionsPage.jsx';

const THEME_KEY = 'mash-theme';
const SECTIONS = [
  { id: 'overview',     label: 'Overview',     dot: '#64748b', accent: 'var(--primary)', heading: 'Program security posture', brief: 'Cross-domain watchfloor for compliance, readiness, and urgent action.' },
  { id: 'facility',     label: 'Facility',     dot: '#0f766e', accent: 'var(--facility)', heading: 'Facility assurance', brief: 'Accreditation, IDS posture, and SCIF control visibility.' },
  { id: 'personnel',    label: 'Personnel',    dot: '#6d28d9', accent: 'var(--personnel)', heading: 'Personnel control', brief: 'Clearance health, training status, and reporting requirements.' },
  { id: 'activities',   label: 'Activities',   dot: '#0369a1', accent: 'var(--activities)', heading: 'Operational tempo', brief: 'Meetings, inspections, travel, and security action tracking.' },
  { id: 'documents',    label: 'Documents',    dot: '#9a3412', accent: 'var(--docs)', heading: 'Controlled documents', brief: 'Inventory accountability, lifecycle actions, and custodianship.' },
  { id: 'media',        label: 'Media',        dot: '#7e22ce', accent: 'var(--media)', heading: 'Media accountability', brief: 'Issue, return, destruction, and removable media chain-of-custody.' },
  { id: 'inspections',  label: 'Inspections',  dot: '#166534', accent: 'var(--inspections)', heading: 'Inspection readiness', brief: 'Findings, campaigns, and evidence-driven compliance execution.' },
];

const ROLE_NAV = {
  corporate_security_admin: 'all',
  facility_security_mgr:    ['overview','facility','activities','inspections'],
  personnel_security_mgr:   ['overview','personnel','activities'],
  activities_security_mgr:  ['overview','activities'],
  document_control_mgr:     ['overview','documents'],
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
  const roleLabel = {
    corporate_security_admin: 'Corp Security Admin',
    facility_security_mgr: 'Facility Sec Mgr',
    personnel_security_mgr: 'Personnel Sec Mgr',
    activities_security_mgr: 'Activities Sec Mgr',
    document_control_mgr: 'Doc Control Mgr',
    media_control_mgr: 'Media Control Mgr',
    viewer: 'Viewer',
  }[wsRole] || wsRole;

  return (
    <header className="ws-header" style={{ '--section-accent': activeSection.accent }}>
      <div className="ws-header-top">
        <div className="ws-brand">
          <div className="ws-brand-mark">
            <span>S</span>
          </div>
          <div>
            <div className="ws-brand-name">Security Managers Workspace</div>
            <div className="ws-brand-sub">NISPOM / DCSA / ICD 705</div>
          </div>
        </div>

        <div className="ws-header-brief">
          <div className="ws-brief-label">Active Mission Layer</div>
          <div className="ws-brief-title">{activeSection.heading}</div>
          <div className="ws-brief-sub">{activeSection.brief}</div>
        </div>

        <div className="ws-identity">
          <div className="ws-status-pill">
            <span className="ws-status-dot" />
            <span>Secure session</span>
          </div>
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
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <span className="ws-role-chip">{roleLabel}</span>
          <span className="ws-user-chip">{user?.name || user?.username}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{clock}</span>
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

  const [section, setSection] = useState('overview');
  const [siteId, setSiteId] = useState('');
  const [sites, setSites] = useState([]);
  const activeSection = SECTIONS.find(s => s.id === section) || SECTIONS[0];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!user) return;
    WS.get('security_workspace_settings').then(s => {
      if (s?.sites) setSites(s.sites.filter(x => x.active !== false));
    });
  }, [user]);

  function handleLogin(u) { setUser(u); }
  function handleLogout() { AUTH.clearAll(); setUser(null); }
  function handleToggleTheme() { setTheme(t => t === 'dark' ? 'light' : 'dark'); }

  if (!user) return <LoginPage onLogin={handleLogin} />;

  const pageProps = { user, siteId };

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
        {section === 'media'       && <MediaPage        {...pageProps} />}
        {section === 'inspections' && <InspectionsPage  {...pageProps} />}
      </main>
    </div>
  );
}
