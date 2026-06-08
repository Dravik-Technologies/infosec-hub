import { useClock, isAdminRole } from '../app.js';

const NAV = [
  { id: 'dashboard', label: 'Program Management', path: '/dashboard', icon: '▣' },
  { id: 'security',  label: 'Program Security',   path: '/security', icon: '◈' },
  { id: 'cyber',     label: 'IT & Cybersecurity', path: '/cyber', icon: '◉' },
];

export default function AppHeader({ view, onNavigate, user, onLogout, appName, theme, onToggleTheme }) {
  const clock = useClock();
  const hubRole = user?.hubRole || user?.role;
  const displayRole = user?.displayRole || user?.title || user?.jobRole || user?.securityRole || hubRole;
  const primarySiteId = user?.primarySiteId || user?.siteId || user?.site || null;
  const siteText = user?.siteIds?.length > 1
    ? `${user.siteIds.length} sites`
    : primarySiteId;
  const showAdmin = isAdminRole(user);

  return (
    <header className="nexus-header">
      <div className="brand-cluster">
        <div className="brand-mark">N</div>
        <div>
          <div className="brand-title">{appName || 'NEXUS'}</div>
          <div className="brand-subtitle">Program Command</div>
        </div>
      </div>

      <nav className="top-nav">
        {NAV.map(item => (
          <button
            key={item.id}
            type="button"
            className={view === item.id ? 'nav-link active' : 'nav-link'}
            onClick={() => onNavigate(item.path)}
          >
            <span className="nav-link-icon" aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        ))}
        {showAdmin && (
          <button
            type="button"
            className={view === 'admin' ? 'nav-link active nav-link-admin' : 'nav-link nav-link-admin'}
            onClick={() => onNavigate('/admin')}
          >
            <span className="nav-link-icon" aria-hidden="true">◎</span>
            Admin
          </button>
        )}
      </nav>

      <div className="identity-rail">
        <div className="identity-status">
          <span className="identity-status-dot" />
          Command link healthy
        </div>
        <button
          type="button"
          className="theme-btn"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        {displayRole && <div className="identity-chip">{displayRole}</div>}
        {siteText && <div className="identity-chip">{siteText}</div>}
        <div className="identity-user">
          <div>{user?.name || '—'}</div>
          <span>{clock}</span>
        </div>
        <button type="button" className="logout-btn" onClick={onLogout}>Sign out</button>
      </div>
    </header>
  );
}
