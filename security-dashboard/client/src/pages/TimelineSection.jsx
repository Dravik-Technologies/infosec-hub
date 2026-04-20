import { fmtShort } from '../app.js';

export default function TimelineSection({ data }) {
  const t  = data.timeline || {};
  const ms = t.milestones || [];
  const todayPct = ((t.todayOffset || 103) / t.totalDays * 100).toFixed(1);
  const months   = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
  const BAR = {
    complete: 'rgba(16,185,129,.5)', 'in-progress': 'rgba(201,168,76,.45)',
    in_progress: 'rgba(201,168,76,.45)', 'at-risk': 'rgba(239,68,68,.42)', upcoming: 'rgba(201,168,76,.1)',
  };
  const BDR = {
    complete: '#10B981', 'in-progress': 'var(--gold)', in_progress: 'var(--gold)',
    'at-risk': 'var(--red)', upcoming: 'rgba(201,168,76,.2)',
  };
  const ICN = {
    complete: 'fa-circle-check text-emerald-400', 'in-progress': 'fa-circle-half-stroke',
    in_progress: 'fa-circle-half-stroke', 'at-risk': 'fa-triangle-exclamation text-red-400', upcoming: 'fa-circle',
  };
  const summary = {
    complete: ms.filter(m => m.status === 'complete').length,
    inProg:   ms.filter(m => m.status === 'in-progress' || m.status === 'in_progress').length,
    atRisk:   ms.filter(m => m.status === 'at-risk').length,
    upcoming: ms.filter(m => m.status === 'upcoming').length,
  };

  return (
    <div className="section">
      <div className="flex items-center justify-between mb-7">
        <div>
          <div className="sec-heading mb-1">Program Timeline</div>
          <h2 className="font-head text-[1.8rem] font-bold" style={{ color: 'var(--off-white)' }}>FY26 Gantt View</h2>
        </div>
        <div className="flex items-center gap-x-5" style={{ fontSize: '10px' }}>
          {[
            ['rgba(16,185,129,.5)',  'Complete',    summary.complete],
            ['rgba(201,168,76,.45)', 'In Progress', summary.inProg],
            ['rgba(239,68,68,.42)', 'At Risk',     summary.atRisk],
            ['rgba(201,168,76,.12)', 'Upcoming',    summary.upcoming],
          ].map(([bg, lbl, cnt]) => (
            <span key={lbl} className="flex items-center gap-x-1.5">
              <span className="w-3 h-2 rounded inline-block" style={{ background: bg }} />
              <span style={{ color: 'rgba(143,163,192,.45)' }}>{lbl} ({cnt})</span>
            </span>
          ))}
        </div>
      </div>
      <div className="card p-7 overflow-x-auto">
        <div className="flex mb-4" style={{ paddingLeft: '230px' }}>
          <div className="flex flex-1 uppercase tracking-wider font-mono" style={{ fontSize: '9px', color: 'rgba(143,163,192,.28)' }}>
            {months.map(m => <div key={m} className="flex-1 text-center">{m}</div>)}
          </div>
        </div>
        <div className="relative">
          <div className="gantt-today" style={{ left: `calc(230px + (100% - 230px) * ${todayPct}/100)` }}>
            <span className="absolute -top-5 left-1 font-mono whitespace-nowrap" style={{ fontSize: '8px', color: 'var(--gold)' }}>TODAY</span>
          </div>
          {ms.map(m => {
            const sp = (m.startDay / t.totalDays * 100).toFixed(1);
            const ep = (m.endDay   / t.totalDays * 100).toFixed(1);
            const w  = (parseFloat(ep) - parseFloat(sp)).toFixed(1);
            return (
              <div key={m.id} className="gantt-row">
                <div className="w-[230px] shrink-0 flex items-center gap-x-2.5 pr-5">
                  <i className={`fa-solid ${ICN[m.status] || ICN.upcoming} text-xs shrink-0`}
                    style={{ color: (m.status === 'in-progress' || m.status === 'in_progress') ? 'var(--gold)' : 'rgba(143,163,192,.4)' }} />
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color: 'var(--off-white)' }}>{m.title}</div>
                    <div className="truncate uppercase tracking-wider" style={{ fontSize: '9px', color: 'rgba(143,163,192,.3)', letterSpacing: '.06em' }}>{m.site} · {m.standard}</div>
                  </div>
                </div>
                <div className="gantt-bar-wrap flex-1 relative">
                  <div className="gantt-bar" style={{ left: `${sp}%`, width: `${w}%`, background: BAR[m.status] || BAR.upcoming, border: `1px solid ${BDR[m.status] || 'rgba(201,168,76,.2)'}` }}>
                    {m.progress ? <div className="absolute inset-0 rounded" style={{ width: `${m.progress}%`, background: 'rgba(255,255,255,.08)' }} /> : null}
                  </div>
                  {m.status === 'at-risk' && <span className="absolute right-1 top-0.5 font-mono" style={{ fontSize: '8px', color: 'var(--red)' }}>DUE {fmtShort(m.dueDate)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
