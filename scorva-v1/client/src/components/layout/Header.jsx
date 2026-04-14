import { Menu, LogOut, Bell, Sun, Moon } from 'lucide-react';
import { useAuth }  from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';

export default function Header({ onMenuClick }) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();

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
              <span className="text-xs text-scorva-muted">{user.role}</span>
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
