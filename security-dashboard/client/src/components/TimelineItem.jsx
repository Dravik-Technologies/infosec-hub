import { Badge, PhaseBar, Prog } from './index.jsx';
import { daysUntil, fmtDate } from '../app.js';

export default function TimelineItem({ item, isLast }) {
  const days   = daysUntil(item.dueDate);
  const urgent = days !== null && days <= 14;
  const soon   = days !== null && days <= 30 && !urgent;
  const urgCls = urgent ? 'b-r' : soon ? 'b-a' : 'b-gold';
  const dotC   = urgent ? 'var(--red)' : soon ? 'var(--amber)' : 'var(--gold)';
  const icons  = { inspection: 'fa-magnifying-glass-chart', 'self-inspection': 'fa-clipboard-list', construction: 'fa-helmet-safety' };
  const dayLbl = days === null ? '—' : days < 0 ? `${Math.abs(days)}d OVR` : days === 0 ? 'TODAY' : `${days}d`;

  return (
    <div className="relative flex gap-x-4 pb-6">
      {!isLast && (
        <div className="absolute top-10 bottom-0 w-px" style={{ left: '19px', background: `linear-gradient(to bottom,${dotC}40,transparent)` }} />
      )}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: 'rgba(201,168,76,.07)', border: `1px solid ${dotC}35` }}>
        <i className={`fa-solid ${icons[item.type] || 'fa-circle'} text-sm`} style={{ color: dotC }} />
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-start justify-between gap-x-3 mb-0.5">
          <div className="font-head font-semibold text-sm leading-snug" style={{ color: 'var(--off-white)' }}>{item.title}</div>
          <Badge cls={urgCls}>{dayLbl}</Badge>
        </div>
        <div className="mb-0.5 uppercase tracking-wider" style={{ fontSize: '9px', color: 'rgba(143,163,192,.4)', letterSpacing: '.07em' }}>{item.site} · {fmtDate(item.dueDate)}</div>
        <div style={{ fontSize: '9px', color: 'rgba(143,163,192,.3)' }} className="mb-1">{item.detail}</div>

        {item.phases && <PhaseBar phases={item.phases} />}
        {item.idealTimeline && item.phases && (
          <div style={{ fontSize: '8px', color: 'rgba(143,163,192,.3)' }} className="mt-1.5 uppercase tracking-wider">
            Ideal timeline: {item.idealTimeline}
          </div>
        )}

        {item.prepPct !== undefined && !item.phases && (
          <div className="mt-2">
            <div className="flex justify-between mb-1" style={{ fontSize: '9px', color: 'rgba(143,163,192,.35)' }}>
              <span className="uppercase tracking-wider" style={{ fontSize: '8px' }}>Preparation</span>
              <span>{item.prepPct}%</span>
            </div>
            <Prog v={item.prepPct} cls={item.prepPct >= 80 ? 'p-g' : 'p-gold'} h="h-[4px]" />
          </div>
        )}

        {item.flag === 'amber' && (
          <div className="flex items-center gap-x-1.5 mt-2" style={{ fontSize: '8px', color: 'rgba(245,158,11,.6)' }}>
            <i className="fa-solid fa-flag shrink-0" style={{ fontSize: '8px' }} />
            <span className="line-clamp-1">{item.notes}</span>
          </div>
        )}
      </div>
    </div>
  );
}
