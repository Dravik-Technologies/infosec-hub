import { useEffect, useState } from 'react';

export default function DonutChart({ segments = [], size = 128, strokeWidth = 20, centerValue = '', centerLabel = '' }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Defer one frame so the CSS transition fires after initial mount
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const cx = size / 2;
  const cy = size / 2;
  const r  = (size - strokeWidth) / 2;
  const C  = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0);

  let cumFrac = 0;
  const arcs = segments.map((seg, i) => {
    const pct       = total > 0 ? seg.value / total : 0;
    const dashLen   = pct * C;
    const dashOffset = C * (0.25 - cumFrac);
    cumFrac += pct;
    return (
      <circle
        key={i}
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={seg.color || 'var(--border)'}
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
        strokeDasharray={ready ? `${dashLen} ${C}` : `0 ${C}`}
        strokeDashoffset={dashOffset}
        style={{ transition: `stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1) ${i * 80}ms` }}
      />
    );
  });

  const valueSize = Math.round(size * 0.175);
  const labelSize = Math.round(size * 0.1);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', overflow: 'visible' }}>
      {/* Track ring */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="var(--border)"
        strokeWidth={strokeWidth}
        opacity={total === 0 ? 1 : 0.25}
      />
      {total > 0 && arcs}
      {centerValue && (
        <text
          x={cx}
          y={centerLabel ? cy - labelSize * 0.6 : cy + valueSize * 0.35}
          textAnchor="middle"
          style={{
            fontSize: valueSize + 'px',
            fontWeight: 700,
            fill: 'var(--text)',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {centerValue}
        </text>
      )}
      {centerLabel && (
        <text
          x={cx}
          y={centerValue ? cy + labelSize * 1.6 : cy + labelSize * 0.4}
          textAnchor="middle"
          style={{
            fontSize: labelSize + 'px',
            fontWeight: 500,
            fill: 'var(--muted)',
            fontFamily: 'Inter, system-ui, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {centerLabel.toUpperCase()}
        </text>
      )}
    </svg>
  );
}
