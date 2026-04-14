import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ShieldCheck, Activity, BookOpen,
  AlertTriangle, CheckSquare, Users, Monitor, Key,
  FileText, Package, LayoutGrid, ClipboardList, Bell,
  Building2, ChevronLeft, ChevronRight, Shield,
} from 'lucide-react';

const NAV = [
  { label: 'Dashboard',    to: '/',             icon: LayoutDashboard },
  { label: 'ATO',          to: '/ato',          icon: ShieldCheck },
  { label: 'ConMon',       to: '/conmon',       icon: Activity },
  { label: 'Controls',     to: '/controls',     icon: BookOpen },
  { label: 'POAM',         to: '/poam',         icon: AlertTriangle },
  { label: 'Tasks',        to: '/tasks',        icon: CheckSquare },
  { label: 'Users',        to: '/users',        icon: Users },
  { label: 'Devices',      to: '/workstations', icon: Monitor },
  { label: 'YubiKeys',     to: '/yubikeys',     icon: Key },
  { label: 'Documents',    to: '/agreements',   icon: FileText },
  { label: 'Licenses',     to: '/licenses',     icon: Package },
  { label: 'Trackers',     to: '/trackers',     icon: LayoutGrid },
  { label: 'Audit Log',    to: '/audit',        icon: ClipboardList },
  { label: 'Notifications',to: '/notifications',icon: Bell },
  { label: 'Sites',        to: '/sites',        icon: Building2 },
];

export default function Sidebar({ open, onToggle }) {
  return (
    <aside
      className={`flex flex-col bg-scorva-surface border-r border-scorva-border transition-all duration-200 shrink-0 ${
        open ? 'w-56' : 'w-14'
      }`}
    >
      {/* Logo / Branding */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-scorva-border">
        {open ? (
          <div className="flex items-center gap-2 min-w-0">
            <Shield size={18} className="text-scorva-accent shrink-0" />
            <div className="min-w-0">
              <div className="text-scorva-accent font-bold text-sm tracking-widest uppercase font-mono leading-none">
                SCORVA
              </div>
              <div className="text-scorva-muted text-[9px] font-mono tracking-wider uppercase leading-none mt-0.5 truncate">
                Cyber Command
              </div>
            </div>
          </div>
        ) : (
          <Shield size={18} className="text-scorva-accent mx-auto" />
        )}
        <button
          onClick={onToggle}
          className="ml-auto p-1.5 rounded-md text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover transition-colors shrink-0"
        >
          {open ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        {NAV.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-scorva-accent/10 text-scorva-accent border border-scorva-accent/25 font-medium'
                  : 'text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover'
              }`
            }
            title={!open ? label : undefined}
          >
            <Icon size={16} className="shrink-0" />
            {open && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      {open && (
        <div className="px-4 py-3 border-t border-scorva-border space-y-1">
          <div className="text-[9px] font-mono tracking-widest text-scorva-accent/60 uppercase">
            NIST SP 800-53 Rev 5
          </div>
          <div className="text-[9px] font-mono text-scorva-muted">
            v3.0.0
          </div>
        </div>
      )}
    </aside>
  );
}
