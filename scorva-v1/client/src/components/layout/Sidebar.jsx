import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ShieldCheck, Activity, BookOpen,
  AlertTriangle, CheckSquare, Users, Monitor, Key,
  FileText, Package, LayoutGrid, ClipboardList, Bell,
  Building2, Shield, Sun, Moon, LogOut, Plus,
  ChevronLeft, ChevronRight, Zap,
} from 'lucide-react';
import { useAuth }  from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import axios from 'axios';

const BASE      = import.meta.env.DEV ? 'http://localhost:3000' : '';
const TOKEN_KEY = 'scorva_token';

const NAV_GROUPS = [
  {
    id: 'authorization',
    label: 'Authorization',
    items: [
      { label: 'Dashboard', to: '/',        icon: LayoutDashboard, end: true },
      { label: 'ATO',       to: '/ato',     icon: ShieldCheck },
      { label: 'ConMon',    to: '/conmon',  icon: Activity },
      { label: 'Controls',  to: '/controls',icon: BookOpen },
      { label: 'POAM',      to: '/poam',    icon: AlertTriangle },
      { label: 'Tasks',     to: '/tasks',   icon: CheckSquare },
      { label: 'Events',    to: '/monitoring/events', icon: Zap },
    ],
  },
  {
    id: 'assets',
    label: 'Assets',
    items: [
      { label: 'Users',    to: '/users',        icon: Users },
      { label: 'Devices',  to: '/workstations', icon: Monitor },
      { label: 'YubiKeys', to: '/yubikeys',     icon: Key },
      { label: 'Licenses', to: '/licenses',     icon: Package },
    ],
  },
  {
    id: 'records',
    label: 'Records',
    items: [
      { label: 'Documents', to: '/agreements', icon: FileText },
      { label: 'Trackers',  to: '/trackers',   icon: LayoutGrid },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    items: [
      { label: 'Audit Log',     to: '/audit',         icon: ClipboardList },
      { label: 'Notifications', to: '/notifications', icon: Bell },
      { label: 'Sites',         to: '/sites',         icon: Building2 },
    ],
  },
];

export default function Sidebar({ open, onToggle }) {
  const { user, logout, selectedSite, selectSite } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();
  const [sites, setSites] = useState([]);
  const isAdmin = user?.role === 'Corporate Admin';

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
    <aside
      className={`sc-sidebar shrink-0 overflow-hidden transition-all duration-300 flex flex-col ${
        open ? 'w-[18rem]' : 'w-[5rem]'
      }`}
    >
      {/* Top: Logo + Brand */}
      <div className="sc-sidebar-top">
        <button
          onClick={!open ? onToggle : undefined}
          className={`sc-brand-mark ${!open ? 'hover:bg-scorva-accent/20 cursor-pointer mx-auto' : 'cursor-default'}`}
        >
          <Shield size={16} />
        </button>

        {open && (
          <div className="flex-1 min-w-0">
            <div className="sc-brand-wordmark">
              SCORVA
            </div>
          </div>
        )}
      </div>

      {/* CTA: New POAM */}
      <div className="px-3 pt-3 pb-3 shrink-0">
        {open ? (
          <div className="flex items-center gap-2">
            <NavLink
              to="/poam"
              className="sc-cta-main flex-1"
            >
              <Plus size={15} className="shrink-0" />
              <span>New POAM</span>
            </NavLink>
            <button
              type="button"
              className="sc-cta-mini"
              title="Collapse sidebar"
              onClick={onToggle}
            >
              <Plus size={15} />
            </button>
          </div>
        ) : (
          <NavLink
            to="/poam"
            className="sc-cta-mini mx-auto"
            title="New POAM"
          >
            <Plus size={15} />
          </NavLink>
        )}
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2 sidebar-nav">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.id} className={gi === 0 ? '' : 'mt-3'}>
            {open && (
              <div className="px-3 pt-3 pb-2">
                <span className="sc-nav-group-label">
                  {group.label}
                </span>
              </div>
            )}
            {!open && gi > 0 && (
              <div className="mx-auto w-4 border-t border-scorva-border/40 my-2" />
            )}

            <div className="space-y-1">
              {group.items.map(({ label, to, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  title={!open ? label : undefined}
                  className={({ isActive }) => [
                    'sc-nav-link',
                    open ? 'px-3' : 'px-0 justify-center',
                    isActive
                      ? 'sc-nav-link-active'
                      : 'text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover',
                  ].join(' ')}
                >
                  <Icon size={16} className="shrink-0" />
                  {open && <span className="truncate font-medium">{label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: Site selector + User widget */}
      <div className="shrink-0 border-t border-scorva-border/40">

        {isAdmin && open && sites.length > 0 && (
          <div className="px-3 pt-2.5 pb-2">
            <select
              value={selectedSite || ''}
              onChange={e => selectSite(e.target.value || null)}
              className="w-full text-[10px] bg-scorva-bg border border-scorva-border rounded-lg px-2 py-1.5 text-scorva-text focus:outline-none focus:ring-1 focus:ring-scorva-accent/50 cursor-pointer"
            >
              <option value="">All Sites</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* User Widget */}
        <div className={`flex items-center gap-2.5 px-3 py-2.5 ${!open ? 'flex-col px-2 py-2 gap-2' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-scorva-accent flex items-center justify-center text-[12px] font-bold text-white dark:text-scorva-bg font-mono shrink-0">
            {user?.initials || '??'}
          </div>

          {open && (
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-scorva-text truncate leading-tight">
                {user?.name}
              </div>
              <div className="text-[10px] text-scorva-muted/70 truncate leading-tight mt-0.5">
                {user?.role}
              </div>
            </div>
          )}

          <div className={`flex items-center gap-1 shrink-0 ${!open ? 'flex-col' : ''}`}>
            <button
              onClick={toggleTheme}
              className="sc-icon-btn"
              title={dark ? 'Light mode' : 'Dark mode'}
            >
              {dark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              onClick={logout}
              className="sc-icon-btn"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
