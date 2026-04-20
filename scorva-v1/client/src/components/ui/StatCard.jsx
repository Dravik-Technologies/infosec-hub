export default function StatCard({ label, value, sub, icon: Icon, accent = false }) {
  return (
    <div className={`card p-5 flex items-start gap-4 ${accent ? 'border-scorva-accent/30' : ''}`}>
      {Icon && (
        <div className={`p-2.5 rounded-lg ${accent ? 'bg-scorva-accent/15 text-scorva-accent-light' : 'bg-scorva-surface text-scorva-muted'}`}>
          <Icon size={20} />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-2xl font-semibold text-scorva-text font-mono">{value ?? '—'}</div>
        <div className="text-xs text-scorva-muted mt-0.5">{label}</div>
        {sub && <div className="text-xs text-scorva-muted mt-1">{sub}</div>}
      </div>
    </div>
  );
}
