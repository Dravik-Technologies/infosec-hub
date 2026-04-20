import { BarChart3 } from 'lucide-react';

/**
 * StatTile — individual KPI tile.
 * Props: label, value, color ('green'|'yellow'|'red'|'blue'|'default'), sub
 */
const TILE_COLORS = {
  green:   { val: 'text-emerald-400', wrap: 'bg-emerald-500/5 border-emerald-500/15' },
  yellow:  { val: 'text-amber-400',   wrap: 'bg-amber-500/5  border-amber-500/15'   },
  red:     { val: 'text-red-400',     wrap: 'bg-red-500/5    border-red-500/15'     },
  blue:    { val: 'text-blue-400',    wrap: 'bg-blue-500/5   border-blue-500/15'    },
  default: { val: 'text-scorva-text', wrap: 'bg-scorva-surface border-scorva-border' },
};

export function StatTile({ label, value, color = 'default', sub }) {
  const c = TILE_COLORS[color] ?? TILE_COLORS.default;
  return (
    <div className={`rounded-lg border px-4 py-3 flex flex-col min-w-[88px] ${c.wrap}`}>
      <span className={`text-2xl font-bold font-mono leading-none tabular-nums ${c.val}`}>
        {value}
      </span>
      <span className="text-xs text-scorva-muted mt-1 leading-snug">{label}</span>
      {sub && (
        <span className={`text-[11px] mt-0.5 leading-none ${c.val} opacity-70`}>{sub}</span>
      )}
    </div>
  );
}

/**
 * StatusDashboard — leadership status panel container.
 * Accepts children for custom chart/tile layouts.
 * Falls back to rendering a row of StatTiles if `stats` prop is provided.
 *
 * Props:
 *   children  ReactNode  — custom chart content
 *   stats     Array<{ label, value, color?, sub? }>  — legacy tile array
 */
export default function StatusDashboard({ children, stats }) {
  const hasContent = children || (stats && stats.length > 0);
  if (!hasContent) return null;

  return (
    <div className="mt-6 rounded-xl border border-scorva-border bg-scorva-surface overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-scorva-border bg-scorva-hover/30">
        <BarChart3 size={12} className="text-scorva-muted" />
        <span className="text-[10px] font-semibold text-scorva-muted uppercase tracking-widest">
          Status Overview
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        {children ?? (
          <div className="flex flex-wrap gap-2">
            {stats.map((s, i) => <StatTile key={i} {...s} />)}
          </div>
        )}
      </div>
    </div>
  );
}
