const TONE_ACCENT = {
  teal:    'stat-accent-teal',
  cyan:    'stat-accent-cyan',
  blue:    'stat-accent-blue',
  emerald: 'stat-accent-emerald',
  green:   'stat-accent-emerald',
  red:     'stat-accent-red',
  orange:  'stat-accent-orange',
  yellow:  'stat-accent-yellow',
  gold:    'stat-accent-gold',
  accent:  'stat-accent-teal',
};

const TONE_ICON = {
  teal:    'bg-scorva-accent/10 text-scorva-accent',
  cyan:    'bg-cyan-500/10 text-cyan-400',
  blue:    'bg-blue-500/10 text-blue-400',
  emerald: 'bg-emerald-500/10 text-emerald-400',
  green:   'bg-emerald-500/10 text-emerald-400',
  red:     'bg-red-500/10 text-red-400',
  orange:  'bg-orange-500/10 text-orange-400',
  yellow:  'bg-yellow-500/10 text-yellow-400',
  gold:    'bg-scorva-gold/10 text-scorva-gold',
  accent:  'bg-scorva-accent/10 text-scorva-accent',
};

export default function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'teal',
  onClick,
}) {
  const accentCls = TONE_ACCENT[tone] || 'stat-accent-teal';
  const iconCls   = TONE_ICON[tone]   || 'bg-scorva-accent/10 text-scorva-accent';

  return (
    <div
      className={`card sc-stat-card ${accentCls} p-4 flex items-start gap-3.5 ${
        onClick ? 'card-hover' : ''
      }`}
      onClick={onClick}
    >
      <div className="sc-stat-orb" />
      {Icon && (
        <div className={`p-2 rounded-lg shrink-0 sc-stat-icon ${iconCls}`}>
          <Icon size={18} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="sc-stat-value">
          {value ?? '—'}
        </div>
        <div className="sc-stat-label">
          {label}
        </div>
        {sub && (
          <div className="sc-stat-sub">{sub}</div>
        )}
      </div>
    </div>
  );
}
