export default function DonutChart({ segments = [], size = 128, strokeWidth = 20, centerValue = '', centerLabel = '' }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const C = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0);

  let cumFrac = 0;
  const arcs = segments.map((seg, i) => {
    const pct = total > 0 ? seg.value / total : 0;
    const dashLen = pct * C;
    const dashOffset = C * (0.25 - cumFrac);
    cumFrac += pct;
    return (
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={seg.color || '#e2e8f0'}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dashLen} ${C}`}
        strokeDashoffset={dashOffset}
      />
    );
  });

  const valueSize = Math.round(size * 0.175);
  const labelSize = Math.round(size * 0.1);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      {total === 0 && (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
      )}
      {arcs}
      {centerValue && (
        <text
          x={cx}
          y={centerLabel ? cy - labelSize * 0.6 : cy + valueSize * 0.35}
          textAnchor="middle"
          style={{ fontSize: valueSize + 'px', fontWeight: 700, fill: '#0f172a', fontFamily: 'Inter, sans-serif' }}
        >
          {centerValue}
        </text>
      )}
      {centerLabel && (
        <text
          x={cx}
          y={centerValue ? cy + labelSize * 1.6 : cy + labelSize * 0.4}
          textAnchor="middle"
          style={{ fontSize: labelSize + 'px', fontWeight: 500, fill: '#64748b', fontFamily: 'Inter, sans-serif' }}
        >
          {centerLabel.toUpperCase()}
        </text>
      )}
    </svg>
  );
}
