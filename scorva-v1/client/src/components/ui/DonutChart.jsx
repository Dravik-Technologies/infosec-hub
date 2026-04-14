/**
 * DonutChart — SVG donut with legend.
 * Props:
 *   segments   Array<{ label, value, color }>
 *   label      string  — center primary text  (e.g. "87%")
 *   sublabel   string  — center secondary text (e.g. "done")
 *   size       number  — SVG size in px (default 108)
 *   thickness  number  — stroke width (default 14)
 */

const FILL = {
  green:  '#34d399',
  yellow: '#fbbf24',
  red:    '#f87171',
  blue:   '#60a5fa',
  orange: '#fb923c',
  purple: '#a78bfa',
  muted:  '#64748b',
};

export default function DonutChart({
  segments = [],
  label,
  sublabel,
  size = 108,
  thickness = 14,
}) {
  const r  = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C  = 2 * Math.PI * r;
  const total = segments.reduce((s, g) => s + (g.value || 0), 0);
  // Small gap between segments (arc units), 0 if only one segment
  const GAP = total > 1 ? Math.min(4, C * 0.018) : 0;

  let cumFraction = 0;

  return (
    <div className="flex items-center gap-5">
      {/* ── Donut SVG ── */}
      <div className="shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Track ring */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            strokeWidth={thickness}
            className="stroke-scorva-border"
            opacity={0.35}
          />

          {total > 0 && (
            <g transform={`rotate(-90, ${cx}, ${cy})`}>
              {segments.map((seg, i) => {
                const frac = (seg.value || 0) / total;
                const arc  = Math.max(0, frac * C - GAP);
                const startAngle = cumFraction * 360;
                cumFraction += frac;
                if (arc <= 0) return null;
                return (
                  <circle
                    key={i}
                    cx={cx} cy={cy} r={r}
                    fill="none"
                    stroke={FILL[seg.color] ?? FILL.muted}
                    strokeWidth={thickness}
                    strokeDasharray={`${arc} ${C}`}
                    transform={`rotate(${startAngle}, ${cx}, ${cy})`}
                    strokeLinecap="butt"
                  />
                );
              })}
            </g>
          )}

          {/* Center label */}
          {label && (
            <text
              x={cx} y={cy - (sublabel ? size * 0.07 : 0)}
              textAnchor="middle" dominantBaseline="central"
              className="fill-scorva-text"
              style={{ fontSize: size * 0.19, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}
            >
              {label}
            </text>
          )}
          {sublabel && (
            <text
              x={cx} y={cy + size * 0.14}
              textAnchor="middle"
              className="fill-scorva-muted"
              style={{ fontSize: size * 0.1, fontFamily: 'IBM Plex Sans, sans-serif' }}
            >
              {sublabel}
            </text>
          )}
        </svg>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-col gap-1.5 min-w-0">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs min-w-0">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: FILL[seg.color] ?? FILL.muted }}
            />
            <span className="text-scorva-muted truncate flex-1">{seg.label}</span>
            <span className="font-mono font-semibold text-scorva-text tabular-nums">
              {seg.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
