import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  trend: {},
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
    <div className="data-source-banner">
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
  const [authChecked, setAuthChecked] = useState(() => Boolean(AUTH.getUser()));
  const [view, setView] = useState(() => pathToView(window.location.pathname));
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState(EMPTY);
  const [error, setError] = useState('');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (currentUser) {
      setAuthChecked(true);
      return;
    }
    API.get('me').then(payload => {
      if (payload && !payload._apiError) {
        AUTH.setUser(payload);
        setCurrentUser(payload);
      }
      setAuthChecked(true);
    }).catch(() => setAuthChecked(true));
  }, [currentUser]);

  useEffect(() => {
    const onPop = () => setView(pathToView(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    reloadBootstrap();
  }, [currentUser]);

  async function reloadBootstrap() {
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
  }

  function navigate(pathname) {
    window.history.pushState({}, '', pathname);
    setView(pathToView(pathname));
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: AUTH.hdrs(),
        credentials: 'include',
      });
    } catch {}
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
    reloadBootstrap();
  }

  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3, ease: 'easeIn' } },
  };

  const activePage = useMemo(() => {
    if (view === 'security') return <ProgramSecurityPage data={data.programSecurity} trend={data.trend} />;
    if (view === 'cyber') return <ProgramCyberPage data={data.cyber} trend={data.trend} />;
    if (view === 'admin') {
      if (!isAdminRole(currentUser)) {
        return (
          <div style={{ padding: '2rem', color: 'var(--muted)' }}>
            Admin console requires NEXUS admin permission.
          </div>
        );
      }
      return <AdminPage pmData={data.programManagement} trend={data.trend} onSave={refreshPm} />;
    }
    return <ProgramManagementPage data={data.programManagement} trend={data.trend} />;
  }, [view, data, currentUser]);

  if (!authChecked) {
    return (
      <div className="loading-shell">
        <div className="nexus-boot">
          <div className="boot-ring-wrap">
            <div className="boot-ring" />
            <div className="boot-ring-pulse" />
          </div>
          <div className="boot-wordmark">NEXUS</div>
          <div className="boot-sub">Restoring secure session…</div>
        </div>
      </div>
    );
  }

  if (!currentUser) return <LoginPage onLogin={setCurrentUser} />;

  if (!loaded) {
    return (
      <div className="loading-shell">
        <div className="nexus-boot">
          <div className="boot-ring-wrap">
            <div className="boot-ring" />
            <div className="boot-ring-pulse" />
          </div>
          <div className="boot-wordmark">NEXUS</div>
          <div className="boot-sub">Loading program command surfaces…</div>
          {error && <div className="error-banner" style={{ marginTop: '0.5rem', maxWidth: '28rem' }}>{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="nexus-shell">
      <div className="nexus-shell-glow nexus-shell-glow-a" aria-hidden="true" />
      <div className="nexus-shell-glow nexus-shell-glow-b" aria-hidden="true" />
      <div className="nexus-grid-overlay" aria-hidden="true" />
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
      <AnimatePresence mode="wait">
        <motion.main
          key={view}
          className="main-shell"
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {activePage}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
