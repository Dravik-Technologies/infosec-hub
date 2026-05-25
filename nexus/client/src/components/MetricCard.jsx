export default function MetricCard({ label, value, suffix = '', hint, tone = 'default' }) {
  const toneClass = tone !== 'default' ? ` tone-${tone}` : '';
  return (
    <div className={`kpi-card${toneClass}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {value}
        {suffix && <sup>{suffix}</sup>}
      </div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}
