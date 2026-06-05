import { useEffect, useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Shield, ChevronLeft, Bell, Sun, Moon, LogOut, Building2 } from 'lucide-react';
import axios from 'axios';
import { useAuth }  from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const BASE = import.meta.env.DEV ? 'http://localhost:3000' : '';
const TOKEN_KEY = 'scorva_token';

/**
 * AppHeader — per-app top nav bar.
 * Props:
 *   appName   string        — e.g. "Authorization & Compliance"
 *   appIcon   LucideIcon    — icon component for the app
 *   tabs      Array<{ label, to, icon?, end? }>  — tab definitions
 */
export default function AppHeader({ appName, appIcon: AppIcon, tabs = [] }) {
  const navigate = useNavigate();
  const { user, logout, selectedSite, selectSite } = useAuth();
  const { dark, toggle } = useTheme();

  const isAdmin = user?.role === 'Corporate Admin';
  const [sites, setSites] = useState([]);

  useEffect(() => {
    if (!isAdmin) return;
    const token = localStorage.getItem(TOKEN_KEY);
    axios.get(`${BASE}/api/sites`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      withCredentials: true,
    })
      .then(r => setSites(r.data))
      .catch(() => {});
  }, [isAdmin]);

  return (
    <header className="sc-app-header min-w-0">

      {/* Brand / back to portal */}
      <Link
        to="/portal"
        className="flex items-center gap-1.5 shrink-0 group px-1"
        title="Back to Portal"
      >
        <div className="sc-app-header-mark">
          <Shield size={14} className="text-scorva-accent" />
        </div>
        <span className="text-xs font-mono font-bold text-scorva-accent tracking-widest">SCORVA</span>
        <ChevronLeft size={13} className="text-scorva-muted group-hover:text-scorva-text transition-colors" />
      </Link>

      <div className="h-4 w-px bg-scorva-border shrink-0" />

      {/* App name */}
      <div className="flex items-center gap-2 shrink-0">
        {AppIcon && <AppIcon size={15} className="text-scorva-accent" />}
        <span className="text-sm font-semibold text-scorva-text">{appName}</span>
      </div>

      {/* Tabs */}
      {tabs.length > 0 && (
        <>
          <div className="h-4 w-px bg-scorva-border shrink-0" />
          <nav className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
            {tabs.map(tab => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end ?? false}
                className={({ isActive }) =>
                  `sc-app-tab flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors shrink-0 ${
                    isActive
                      ? 'bg-scorva-accent/10 text-scorva-accent border border-scorva-accent/25 font-medium'
                      : 'text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover'
                  }`
                }
              >
                {tab.icon && <tab.icon size={14} />}
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </>
      )}

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-1 shrink-0">

        {/* Corporate Admin site selector */}
        {isAdmin && (
          <div className="flex items-center gap-1.5 mr-1 pr-2 border-r border-scorva-border">
            <Building2 size={13} className="text-scorva-muted shrink-0" />
            <select
              value={selectedSite || ''}
              onChange={e => selectSite(e.target.value || null)}
              className="text-xs bg-transparent text-scorva-text border border-scorva-border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-scorva-accent cursor-pointer"
              title="Filter data by site, or view all sites"
            >
              <option value="">All Sites</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={toggle}
          className="p-1.5 rounded-md text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover transition-colors"
          title={dark ? 'Light mode' : 'Dark mode'}
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        <button
          onClick={() => navigate('/admin/notifications')}
          className="p-1.5 rounded-md text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover transition-colors"
          title="Notifications"
        >
          <Bell size={15} />
        </button>

        <div className="sc-app-user flex items-center gap-2 pl-2 ml-1 border-l border-scorva-border">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-scorva-accent text-white dark:text-scorva-bg text-xs font-semibold shrink-0">
            {user?.initials}
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="text-xs font-medium text-scorva-text">{user?.name}</span>
            <span className="text-[10px] text-scorva-muted">
              {user?.role}
              {isAdmin && selectedSite && (
                <span className="ml-1 text-scorva-accent">
                  · {sites.find(s => s.id === selectedSite)?.label || selectedSite}
                </span>
              )}
            </span>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-md text-scorva-muted hover:text-red-500 hover:bg-scorva-hover transition-colors"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
