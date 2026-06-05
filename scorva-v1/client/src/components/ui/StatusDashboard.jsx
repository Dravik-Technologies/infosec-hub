import { BarChart3 } from 'lucide-react';

const TILE_COLORS = {
  green:   { val: 'text-emerald-400', wrap: 'bg-emerald-500/5 border-emerald-500/15', bar: 'border-l-emerald-500' },
  yellow:  { val: 'text-amber-400',   wrap: 'bg-amber-500/5  border-amber-500/15',   bar: 'border-l-amber-500'  },
  red:     { val: 'text-red-400',     wrap: 'bg-red-500/5    border-red-500/15',     bar: 'border-l-red-500'    },
  blue:    { val: 'text-blue-400',    wrap: 'bg-blue-500/5   border-blue-500/15',    bar: 'border-l-blue-500'   },
  default: { val: 'text-scorva-text', wrap: 'bg-scorva-surface border-scorva-border', bar: 'border-l-scorva-border' },
};

/**
 * StatTile — individual KPI tile for use inside StatusDashboard.
 * Props: label, value, color ('green'|'yellow'|'red'|'blue'|'default'), sub
 */
export function StatTile({ label, value, color = 'default', sub }) {
  const c = TILE_COLORS[color] ?? TILE_COLORS.default;
  return (
    <div className={`sc-status-tile rounded-[1.15rem] border border-l-[3px] ${c.bar} ${c.wrap} px-4 py-3 flex flex-col min-w-[88px]`}>
      <span className={`text-2xl font-bold font-mono leading-none tabular-nums ${c.val}`}>
        {value}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-scorva-muted mt-1.5 leading-none">
        {label}
      </span>
      {sub && (
        <span className={`text-[11px] mt-1.5 leading-none ${c.val} opacity-70`}>{sub}</span>
      )}
    </div>
  );
}

/**
 * StatusDashboard — leadership status panel container.
 * Accepts children for custom chart/tile layouts.
 * Falls back to rendering a row of StatTiles if `stats` prop is provided.
 */
export default function StatusDashboard({ children, stats }) {
  const hasContent = children || (stats && stats.length > 0);
  if (!hasContent) return null;

  return (
    <div className="sc-status-shell mt-6 overflow-hidden">
      <div className="sc-status-shell-glow" />
      <div className="flex items-center gap-2 px-4 py-3 border-b border-scorva-border bg-scorva-hover/20 relative z-10">
        <BarChart3 size={11} className="text-scorva-muted" />
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-scorva-muted font-mono">
          Status Overview
        </span>
      </div>

      <div className="p-4 relative z-10">
        {children ?? (
          <div className="flex flex-wrap gap-3">
            {stats.map((s, i) => <StatTile key={i} {...s} />)}
          </div>
        )}
      </div>
    </div>
  );
}
