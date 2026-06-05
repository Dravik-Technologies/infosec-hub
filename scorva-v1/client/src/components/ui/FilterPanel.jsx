import { X, SlidersHorizontal } from 'lucide-react';

/**
 * Slide-in filter panel.
 *
 * Props:
 *   open     – boolean
 *   onClose  – () => void
 *   title    – string (default "Filters")
 *   onClear  – () => void, shown as "Clear all" button when provided
 *   children – <FilterGroup> elements
 */
export default function FilterPanel({ open, onClose, title = 'Filters', onClear, children }) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-scorva-bg/50 backdrop-blur-[2px]"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed right-4 top-4 bottom-4 z-40 w-80 sc-filter-panel flex flex-col shadow-2xl transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-scorva-border shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-scorva-muted" />
            <span className="text-sm font-semibold text-scorva-text uppercase tracking-[0.12em] font-mono">{title}</span>
          </div>
          <div className="flex items-center gap-3">
            {onClear && (
              <button
                className="text-[11px] text-scorva-muted hover:text-scorva-accent transition-colors font-medium"
                onClick={onClear}
              >
                Clear all
              </button>
            )}
            <button className="btn-icon" onClick={onClose}>
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5 sidebar-nav">
          {children}
        </div>
      </div>
    </>
  );
}

/**
 * A single filter group inside FilterPanel.
 *
 * Props:
 *   label    – section heading string
 *   options  – array of strings or { value, label, count }
 *   value    – current selected value (string for single, string[] for multiple)
 *   onChange – (newValue) => void
 *   multiple – boolean (default false)
 *   allLabel – label for the "show all" option (default "All")
 */
export function FilterGroup({
  label,
  options = [],
  value,
  onChange,
  multiple = false,
  allLabel = 'All',
}) {
  const selected = multiple
    ? (Array.isArray(value) ? value : [])
    : (value || allLabel);

  function toggle(optVal) {
    if (!multiple) {
      onChange(optVal === selected ? allLabel : optVal);
      return;
    }
    const arr = Array.isArray(value) ? value : [];
    onChange(arr.includes(optVal) ? arr.filter(v => v !== optVal) : [...arr, optVal]);
  }

  const isActive = (optVal) =>
    multiple ? selected.includes(optVal) : selected === optVal;

  const itemCls = (active) =>
    `w-full text-left text-[12px] px-2.5 py-[7px] rounded-lg flex items-center justify-between transition-colors ${
      active
        ? 'bg-scorva-accent/10 text-scorva-accent font-semibold'
        : 'text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover'
    }`;

  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-scorva-muted/60 mb-2 font-mono">
        {label}
      </div>
      <div className="space-y-0.5">
        {/* All option (single-select only) */}
        {!multiple && (
          <button
            className={itemCls(selected === allLabel)}
            onClick={() => onChange(allLabel)}
          >
            <span>{allLabel}</span>
          </button>
        )}

        {options.map(opt => {
          const optVal   = typeof opt === 'object' ? (opt.value ?? opt.label) : opt;
          const optLabel = typeof opt === 'object' ? opt.label : opt;
          const count    = typeof opt === 'object' ? opt.count : undefined;
          const active   = isActive(optVal);
          return (
            <button
              key={optVal}
              className={itemCls(active)}
              onClick={() => toggle(optVal)}
            >
              <span>{optLabel}</span>
              {count !== undefined && (
                <span className={`text-[10px] font-mono tabular-nums ${active ? 'text-scorva-accent/60' : 'text-scorva-muted/50'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Trigger button that shows the filter panel with an active-filter badge. */
export function FilterTrigger({ onClick, activeCount = 0 }) {
  return (
    <button
      className={`btn-secondary flex items-center gap-1.5 relative ${activeCount > 0 ? 'border-scorva-accent/40 text-scorva-accent' : ''}`}
      onClick={onClick}
    >
      <SlidersHorizontal size={14} />
      Filter
      {activeCount > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-scorva-accent text-scorva-bg text-[9px] font-bold flex items-center justify-center dark:text-scorva-bg">
          {activeCount}
        </span>
      )}
    </button>
  );
}
