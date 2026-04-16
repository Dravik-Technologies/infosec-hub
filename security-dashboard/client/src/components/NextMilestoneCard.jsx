import { Badge } from './index.jsx';
import { daysUntil, fmtDate } from '../app.js';

export default function NextMilestoneCard({ ms }) {
  if (!ms) return null;
  const days   = daysUntil(ms.dueDate);
  const urgCls = days <= 14 ? 'b-r' : days <= 30 ? 'b-a' : 'b-gold';
  const icons  = { inspection: 'fa-magnifying-glass-chart', 'self-inspection': 'fa-clipboard-list', construction: 'fa-helmet-safety' };
  return (
    <div className="card card-kpi card-tilt p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.18)' }}>
          <i className={`fa-solid ${icons[ms.type] || 'fa-clock'} text-base`} style={{ color: 'var(--gold)' }} />
        </div>
        <Badge cls={urgCls}>{days != null ? `${days}d` : '—'}</Badge>
      </div>
      <div className="uppercase tracking-widest mb-2" style={{ fontSize: '.59rem', fontWeight: 700, color: 'rgba(143,163,192,.5)', letterSpacing: '.1em' }}>Next Major Milestone</div>
      <div className="font-head text-sm font-semibold leading-snug mb-1" style={{ color: 'var(--off-white)' }}>{ms.title}</div>
      <div className="text-xs" style={{ color: 'rgba(143,163,192,.4)' }}>{ms.site}</div>
      <div className="text-xs mt-0.5" style={{ color: 'rgba(143,163,192,.35)' }}>Due {fmtDate(ms.dueDate)}</div>
      {ms.flag === 'amber' && (
        <div className="flex items-center gap-x-2 mt-3 px-2.5 py-2 rounded-lg text-[9px]"
          style={{ background: 'rgba(245,158,11,.06)', color: 'rgba(245,158,11,.75)' }}>
          <i className="fa-solid fa-flag text-[8px] shrink-0" />
          <span className="line-clamp-2">{ms.notes}</span>
        </div>
      )}
    </div>
  );
}
