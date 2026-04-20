import { Prog, Badge } from './index.jsx';

export default function FacilityCard({ site, onClick }) {
  const p   = site.compliance;
  const lbl = p >= 95 ? 'Fully Compliant' : p >= 82 ? 'Minor Gaps' : 'At Risk';
  const cls = p >= 95 ? 'b-g' : p >= 82 ? 'b-a' : 'b-r';
  const bar = p >= 95 ? 'p-g' : 'p-gold';
  return (
    <div onClick={onClick} className="card card-tilt cursor-pointer p-7 transition-all"
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,.35)'; e.currentTarget.style.boxShadow = '0 8px 36px rgba(0,0,0,.6),0 0 24px rgba(201,168,76,.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }}>
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="font-head font-bold uppercase tracking-widest text-sm" style={{ color: 'var(--off-white)', letterSpacing: '.1em' }}>{site.name}</div>
          <div className="text-xs mt-0.5 uppercase tracking-wider" style={{ color: 'rgba(143,163,192,.4)', fontSize: '.65rem', letterSpacing: '.08em' }}>{site.location}</div>
        </div>
        <div className="font-head font-bold leading-none" style={{ fontSize: '2.2rem', color: 'var(--gold)' }}>{p}%</div>
      </div>
      <div className="mt-5 mb-4"><Prog v={p} cls={bar} h="h-[5px]" /></div>
      <div className="flex items-center justify-between">
        <Badge cls={cls}>{lbl}</Badge>
        <span style={{ fontSize: '10px', color: 'rgba(143,163,192,.35)' }}>{site.openFindings || 0} open items</span>
      </div>
    </div>
  );
}
