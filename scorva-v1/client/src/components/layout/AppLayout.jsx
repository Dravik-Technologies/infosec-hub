import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Bell, Sun, Moon, LogOut, Building2, Menu, X,
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { canManageAllSites } from '../../utils/siteSelectionGuard';
import scorvaLogo from '../../assets/scorva-logo.png?url';

const BASE = import.meta.env.DEV ? 'http://localhost:3000' : '';
const TOKEN_KEY = 'scorva_token';

/**
 * AppLayout — left sidebar navigation wrapper for mission apps.
 * Props:
 *   appName    string       — e.g. "Authorization & Compliance"
 *   appIcon    LucideIcon   — icon component for the app
 *   tabs       Array<{ label, to, icon?, end? }>  — sidebar nav items
 *   children   ReactNode    — page content
 */
export default function AppLayout({ appName, appIcon: AppIcon, tabs = [], children }) {
  const navigate = useNavigate();
  const { user, logout, selectedSite, selectSite } = useAuth();
  const { dark, toggle } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sites, setSites] = useState([]);
  const displayRole = user?.displayRole || user?.title || user?.jobRole || user?.securityRole || user?.hubRole || user?.role || 'Hub Viewer';

  const isAdmin = canManageAllSites(user);

  // Fetch sites on mount
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
    <div className="flex h-screen overflow-hidden bg-scorva-bg">
      {/* Left Sidebar */}
      <aside
        className={`app-sidebar shrink-0 overflow-hidden transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Logo / Back */}
          <div className="px-4 py-4 border-b border-scorva-border/40">
            <Link
              to="/portal"
              className="flex items-center gap-2 group"
              title="Back to Portal"
            >
              <div className="w-10 h-10 rounded-xl bg-scorva-accent/10 border border-scorva-accent/20 flex items-center justify-center shrink-0">
                <img src={scorvaLogo} alt="SCORVA" className="h-7 w-7 object-contain" />
              </div>
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono font-bold text-scorva-accent tracking-widest">
                    SCORVA
                  </div>
                  <div className="text-[10px] text-scorva-muted/70">COMMAND CENTER</div>
                </div>
              )}
            </Link>
          </div>

          {/* App Header */}
          {sidebarOpen && (
            <div className="px-4 py-3 border-b border-scorva-border/40">
              <div className="flex items-center gap-2 mb-1">
                {AppIcon && <AppIcon size={15} className="text-scorva-accent shrink-0" />}
                <span className="text-xs font-bold text-scorva-text truncate">{appName}</span>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
            <button
              type="button"
              onClick={() => navigate('/portal')}
              className="w-full app-nav-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-scorva-accent hover:bg-scorva-accent/10 hover:text-scorva-accent transition-all"
              title={!sidebarOpen ? 'Back to Command Center' : undefined}
            >
              <ChevronLeft size={16} className="shrink-0" />
              {sidebarOpen && <span className="truncate font-semibold">Back to Command Center</span>}
            </button>

            {tabs.map(tab => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end ?? false}
                className={({ isActive }) =>
                  `app-nav-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    isActive
                      ? 'bg-scorva-accent/15 text-scorva-accent font-semibold border border-scorva-accent/25'
                      : 'text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover'
                  }`
                }
                title={!sidebarOpen ? tab.label : undefined}
              >
                {tab.icon && <tab.icon size={16} className="shrink-0" />}
                {sidebarOpen && <span className="truncate">{tab.label}</span>}
              </NavLink>
            ))}
          </nav>

          {/* Site Selector (Admin) */}
          {isAdmin && sidebarOpen && sites.length > 0 && (
            <div className="px-3 py-3 border-t border-scorva-border/40">
              <label className="text-[10px] font-mono font-bold text-scorva-muted/70 uppercase tracking-widest block mb-1.5">
                Site
              </label>
              <select
                value={selectedSite || ''}
                onChange={e => selectSite(e.target.value || null)}
                className="w-full text-xs bg-scorva-card border border-scorva-border/60 rounded-lg px-2.5 py-2 text-scorva-text focus:outline-none focus:ring-1 focus:ring-scorva-accent/50 cursor-pointer"
              >
                <option value="">All Sites</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Footer Controls */}
          <div className="border-t border-scorva-border/40 p-3 space-y-2">
            <button
              onClick={toggle}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover transition-all"
              title={dark ? 'Light mode' : 'Dark mode'}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
              {sidebarOpen && <span className="text-sm flex-1 text-left">{dark ? 'Light' : 'Dark'}</span>}
            </button>

            <button
              onClick={() => navigate('/admin/notifications')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover transition-all"
              title="Notifications"
            >
              <Bell size={16} />
              {sidebarOpen && <span className="text-sm flex-1 text-left">Notifications</span>}
            </button>

            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-scorva-muted hover:text-red-400 hover:bg-scorva-hover transition-all"
              title="Sign out"
            >
              <LogOut size={16} />
              {sidebarOpen && <span className="text-sm flex-1 text-left">Sign Out</span>}
            </button>

            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover transition-all"
              title={sidebarOpen ? 'Collapse' : 'Expand'}
            >
              {sidebarOpen ? <ChevronLeft size={16} /> : <Menu size={16} />}
              {sidebarOpen && <span className="text-sm flex-1 text-left">Collapse</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Top Header Bar (Minimal) */}
        <header className="h-14 px-6 border-b border-scorva-border/40 flex items-center justify-between shrink-0 bg-scorva-surface/40 backdrop-blur-sm">
          <div className="text-sm text-scorva-muted/70 font-mono">
            {appName}
          </div>

          {/* User Info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 pl-3 border-l border-scorva-border/40">
              <div className="w-7 h-7 rounded-lg bg-scorva-accent text-white text-xs font-bold flex items-center justify-center shrink-0">
                {user?.initials}
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-xs font-medium text-scorva-text">{user?.name}</span>
                <span className="text-[10px] text-scorva-muted/70">{displayRole}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
