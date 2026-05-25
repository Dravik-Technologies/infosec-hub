import { useClock, isAdminRole } from '../app.js';

const NAV = [
  { id: 'dashboard', label: 'Program Management', path: '/dashboard' },
  { id: 'security',  label: 'Program Security',   path: '/security' },
  { id: 'cyber',     label: 'IT & Cybersecurity',  path: '/cyber' },
];

export default function AppHeader({ view, onNavigate, user, onLogout, appName, theme, onToggleTheme }) {
  const clock = useClock();
  const siteText = user?.siteIds?.length > 1
    ? `${user.siteIds.length} sites`
    : user?.siteId || null;
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
            {item.label}
          </button>
        ))}
        {showAdmin && (
          <button
            type="button"
            className={view === 'admin' ? 'nav-link active nav-link-admin' : 'nav-link nav-link-admin'}
            onClick={() => onNavigate('/admin')}
          >
            Admin
          </button>
        )}
      </nav>

      <div className="identity-rail">
        <button
          type="button"
          className="theme-btn"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        {user?.role && <div className="identity-chip">{user.role}</div>}
        {user?.scorvaRole && <div className="identity-chip scorva">SCORVA: {user.scorvaRole}</div>}
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
