/**
 * BarList — horizontal bar chart.
 * Props:
 *   bars   Array<{ label, value, color? }>
 *   title  string   — optional section heading
 *   max    number   — override bar scale max (defaults to largest value)
 */

const BG = {
  green:  'bg-emerald-400',
  yellow: 'bg-amber-400',
  red:    'bg-red-400',
  blue:   'bg-blue-400',
  orange: 'bg-orange-400',
  purple: 'bg-violet-400',
  muted:  'bg-slate-500',
};

export default function BarList({ bars = [], title, max: maxProp }) {
  const max = maxProp ?? Math.max(1, ...bars.map(b => b.value || 0));

  return (
    <div className="flex flex-col gap-1 min-w-0">
      {title && (
        <p className="text-[10px] font-semibold text-scorva-muted uppercase tracking-widest mb-1">
          {title}
        </p>
      )}
      {bars.map((bar, i) => {
        const pct = max > 0 ? (bar.value / max) * 100 : 0;
        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="text-scorva-muted w-28 truncate shrink-0">{bar.label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-scorva-border overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${BG[bar.color] ?? BG.muted}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="font-mono font-semibold text-scorva-text tabular-nums w-6 text-right shrink-0">
              {bar.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
