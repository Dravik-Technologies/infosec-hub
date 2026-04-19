import { useEffect, useState } from 'react';
import { Menu, LogOut, Bell, Sun, Moon, Building2 } from 'lucide-react';
import { useAuth }  from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const BASE = import.meta.env.DEV ? 'http://localhost:3000' : '';
const TOKEN_KEY = 'scorva_token';

export default function Header({ onMenuClick }) {
  const { user, logout, selectedSite, selectSite } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();

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
    <header className="flex items-center justify-between h-14 px-4 bg-scorva-surface border-b border-scorva-border shrink-0">
      <button
        onClick={onMenuClick}
        className="p-1.5 rounded-md text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover transition-colors md:hidden"
      >
        <Menu size={18} />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        {/* Corporate Admin site selector */}
        {isAdmin && (
          <div className="flex items-center gap-1.5 mr-2 pr-2 border-r border-scorva-border">
            <Building2 size={14} className="text-scorva-muted shrink-0" />
            <select
              value={selectedSite || ''}
              onChange={e => selectSite(e.target.value || null)}
              className="text-xs bg-transparent text-scorva-text border border-scorva-border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-scorva-accent cursor-pointer"
              title="View data for a specific site, or all sites"
            >
              <option value="">All Sites</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Dark / Light toggle */}
        <button
          onClick={toggle}
          className="p-1.5 rounded-md text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover transition-colors"
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Notifications shortcut */}
        <button
          onClick={() => navigate('/notifications')}
          className="p-1.5 rounded-md text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover transition-colors"
        >
          <Bell size={16} />
        </button>

        {/* User pill */}
        <div className="flex items-center gap-2 pl-2 ml-1 border-l border-scorva-border">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-scorva-accent text-white dark:text-scorva-bg text-xs font-semibold">
            {user?.initials}
          </div>
          {user && (
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-xs font-medium text-scorva-text">{user.name}</span>
              <span className="text-xs text-scorva-muted">
                {user.role}
                {isAdmin && selectedSite && (
                  <span className="ml-1 text-scorva-accent">
                    · {sites.find(s => s.id === selectedSite)?.label || selectedSite}
                  </span>
                )}
              </span>
            </div>
          )}
          <button
            onClick={logout}
            className="p-1.5 rounded-md text-scorva-muted hover:text-red-500 hover:bg-scorva-hover transition-colors"
            title="Logout"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
