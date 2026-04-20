/* Shared primitive components */

export function Prog({ v, cls = 'p-gold', h = 'h-[6px]' }) {
  return (
    <div className={`${h} rounded-full overflow-hidden`} style={{ background: 'rgba(255,255,255,.06)' }}>
      <div className={`h-full rounded-full ${cls} transition-[width] duration-1000`} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Badge({ cls, children }) {
  return <span className={`badge ${cls}`}>{children}</span>;
}

export function GoldLine() {
  return <div className="gold-line" />;
}

export function PhaseBar({ phases }) {
  return (
    <div className="mt-2.5">
      <div className="flex gap-x-1 mb-1">
        {phases.map((p, i) => <div key={i} className={`ph-seg ph-${p.status}`} />)}
      </div>
      <div className="flex gap-x-1">
        {phases.map((p, i) => (
          <div key={i} className="flex-1 text-center" style={{ fontSize: '7px', color: 'rgba(143,163,192,.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
        ))}
      </div>
    </div>
  );
}
