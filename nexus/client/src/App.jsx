import { useEffect, useMemo, useState } from 'react';
import { AUTH, API, isAdminRole } from './app.js';
import AppHeader from './components/AppHeader.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ProgramManagementPage from './pages/ProgramManagementPage.jsx';
import ProgramSecurityPage from './pages/ProgramSecurityPage.jsx';
import ProgramCyberPage from './pages/ProgramCyberPage.jsx';
import AdminPage from './pages/AdminPage.jsx';

const THEME_KEY = 'nexus-theme';
const EMPTY = {
  settings: {},
  programManagement: {},
  programSecurity: {},
  cyber: {},
  _sources: {},
};

function pathToView(pathname) {
  if (pathname === '/' || pathname === '/dashboard') return 'dashboard';
  if (pathname === '/security') return 'security';
  if (pathname === '/cyber') return 'cyber';
  if (pathname === '/admin') return 'admin';
  return 'dashboard';
}

function DataSourceBanner({ sources }) {
  if (!sources) return null;
  const warnings = [];
  if (sources.programSecurity === 'stored') warnings.push('Security data: showing stored snapshot (MASH unavailable)');
  if (sources.programSecurity === 'unavailable') warnings.push('Security data: unavailable — MASH tables not populated');
  if (sources.cyber === 'error') warnings.push('Cyber data: rollup failed — check SCORVA connectivity');
  if (warnings.length === 0) return null;
  return (
    <div style={{
      background: 'var(--amber-bg, #fffbeb)',
      borderBottom: '1px solid var(--amber-border, #fde68a)',
      padding: '0.4rem 1.25rem',
      fontSize: '0.75rem',
      color: 'var(--amber, #b45309)',
      display: 'flex',
      gap: '1rem',
      flexWrap: 'wrap',
    }}>
      {warnings.map((w, i) => <span key={i}>⚠ {w}</span>)}
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [currentUser, setCurrentUser] = useState(() => {
    const stored = AUTH.getUser();
    if (stored) {
      // authVersion < 2 tokens lack canSeeAllSites — force re-authentication
      if (!stored.authVersion || stored.authVersion < 2) {
        AUTH.clearAll();
      } else {
        return stored;
      }
    }
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get('nexus_token');
    if (ssoToken) {
      try {
        const b64 = ssoToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
        const payload = JSON.parse(atob(padded));
        AUTH.setToken(ssoToken);
        AUTH.setUser(payload);
        setTimeout(() => window.history.replaceState({}, '', '/dashboard'), 0);
        return payload;
      } catch {
        return null;
      }
    }
    return null;
  });
  const [view, setView] = useState(() => pathToView(window.location.pathname));
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState(EMPTY);
  const [error, setError] = useState('');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const onPop = () => setView(pathToView(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      setError('');
      const payload = await API.get('bootstrap');
      if (!payload) {
        setError('Unable to load NEXUS data. Check server connectivity.');
        return;
      }
      if (payload._apiError) {
        const hint = payload.status === 403
          ? 'Your account does not have access to this application.'
          : `Load failed (${payload.status}): ${payload.message}`;
        setError(hint);
        return;
      }
      setData(payload);
      setLoaded(true);
    })();
  }, [currentUser]);

  function navigate(pathname) {
    window.history.pushState({}, '', pathname);
    setView(pathToView(pathname));
  }

  function logout() {
    AUTH.clearAll();
    setCurrentUser(null);
    setLoaded(false);
    setData(EMPTY);
  }

  function toggleTheme() {
    setTheme(current => current === 'dark' ? 'light' : 'dark');
  }

  // Refresh PM data after admin edits
  function refreshPm() {
    API.get('program-management').then(pm => {
      if (pm && !pm._apiError) setData(prev => ({ ...prev, programManagement: pm }));
    });
  }

  const activePage = useMemo(() => {
    if (view === 'security') return <ProgramSecurityPage data={data.programSecurity} />;
    if (view === 'cyber') return <ProgramCyberPage data={data.cyber} />;
    if (view === 'admin') {
      if (!isAdminRole(currentUser)) {
        return (
          <div style={{ padding: '2rem', color: 'var(--muted)' }}>
            Admin console requires Corporate Admin or Program Manager role.
          </div>
        );
      }
      return <AdminPage pmData={data.programManagement} onSave={refreshPm} />;
    }
    return <ProgramManagementPage data={data.programManagement} />;
  }, [view, data, currentUser]);

  if (!currentUser) return <LoginPage onLogin={setCurrentUser} />;

  if (!loaded) {
    return (
      <div className="loading-shell">
        <div className="loading-mark">NEXUS</div>
        <p>Loading program command surfaces…</p>
        {error && <div className="error-banner">{error}</div>}
      </div>
    );
  }

  return (
    <div className="nexus-shell">
      <AppHeader
        view={view}
        onNavigate={navigate}
        user={currentUser}
        onLogout={logout}
        appName={data.settings?.app?.name}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <DataSourceBanner sources={data._sources} />
      <main className="main-shell">
        {activePage}
      </main>
    </div>
  );
}
