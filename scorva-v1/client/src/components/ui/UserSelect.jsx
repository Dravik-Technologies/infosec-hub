import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { ChevronDown, Search, X, Check } from 'lucide-react';

/**
 * UserSelect — searchable user picker backed by the /api/users list.
 *
 * Props:
 *   value      – currently selected display name (string)
 *   onChange   – (name: string) => void
 *   placeholder – string shown when nothing selected
 *   disabled    – boolean
 */
export default function UserSelect({ value, onChange, placeholder = 'Select user…', disabled = false }) {
  const { user, selectedSite } = useAuth();
  const siteScopeKey = selectedSite || user?.siteID || user?.siteId || 'all-sites';
  const { data: users = [] } = useQuery({ queryKey: ['users', siteScopeKey], queryFn: api.users.list });

  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  /* close on outside click */
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = users.filter(u => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  });

  function select(u) {
    onChange(u.name);
    setOpen(false);
    setQuery('');
  }

  function clear(e) {
    e.stopPropagation();
    onChange('');
  }

  function initials(name = '') {
    return name.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase();
  }

  return (
    <div ref={ref} className="relative">
      {/* ── Trigger ── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen(o => !o); setQuery(''); } }}
        className="input-base w-full flex items-center justify-between gap-2 text-left"
      >
        {value ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-5 h-5 rounded-full bg-scorva-accent/20 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-scorva-accent">{initials(value)}</span>
            </div>
            <span className="text-scorva-text text-sm truncate">{value}</span>
          </div>
        ) : (
          <span className="text-scorva-muted text-sm flex-1">{placeholder}</span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
            <span
              role="button"
              className="text-scorva-muted hover:text-scorva-text p-0.5 rounded"
              onClick={clear}
            >
              <X size={11} />
            </span>
          )}
          <ChevronDown size={13} className={`text-scorva-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[220px] bg-scorva-card border border-scorva-border rounded-lg shadow-2xl overflow-hidden">
          {/* Search bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-scorva-border bg-scorva-surface/50">
            <Search size={12} className="text-scorva-muted shrink-0" />
            <input
              autoFocus
              className="flex-1 bg-transparent text-xs text-scorva-text placeholder-scorva-muted outline-none"
              placeholder="Search by name, role or email…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="text-scorva-muted hover:text-scorva-text">
                <X size={10} />
              </button>
            )}
          </div>

          {/* User list */}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-4 text-xs text-scorva-muted text-center">
                No users found{query ? ` for "${query}"` : ''}
              </div>
            ) : (
              filtered.map(u => {
                const selected = value === u.name;
                return (
                  <button
                    key={u.id ?? u.username}
                    type="button"
                    onClick={() => select(u)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      selected ? 'bg-scorva-accent/10' : 'hover:bg-scorva-hover'
                    }`}
                  >
                    {/* Avatar */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${
                      selected ? 'bg-scorva-accent/30 text-scorva-accent' : 'bg-scorva-border text-scorva-muted'
                    }`}>
                      {initials(u.name)}
                    </div>
                    {/* Name + role */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-scorva-text truncate">{u.name}</div>
                      <div className="text-[10px] text-scorva-muted truncate">{u.role}{u.email ? ` · ${u.email}` : ''}</div>
                    </div>
                    {selected && <Check size={13} className="text-scorva-accent shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer hint */}
          <div className="px-3 py-1.5 border-t border-scorva-border bg-scorva-surface/30">
            <p className="text-[10px] text-scorva-muted/60">
              {users.length} user{users.length !== 1 ? 's' : ''} · managed in Admin → Users
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
