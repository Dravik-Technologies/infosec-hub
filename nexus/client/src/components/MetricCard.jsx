export default function MetricCard({ label, value, suffix = '', hint, tone = 'default', trend = null }) {
  const toneClass = tone !== 'default' ? ` tone-${tone}` : '';
  const trendClass = trend ? ` trend-${trend.direction || 'flat'}` : '';
  const trendLabel = trend?.direction === 'improving'
    ? 'Improving'
    : trend?.direction === 'degrading'
      ? 'Degrading'
      : 'Flat';
  return (
    <div className={`kpi-card${toneClass}${trendClass}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {value}
        {suffix && <sup>{suffix}</sup>}
      </div>
      {trend && (
        <div className={`kpi-trend trend-${trend.direction || 'flat'}`}>
          <span className="kpi-trend-pill">{trendLabel}</span>
          <span>{trend.label}</span>
        </div>
      )}
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}
