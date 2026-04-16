import { daysUntil, fmtDate } from '../app.js';
import { Badge, Prog } from '../components/index.jsx';

const STATUS_META = {
  'pending-auth': { label: 'Pending Authorization', cls: 'b-a', dot: 'var(--amber)' },
  'design':       { label: 'Design Phase',          cls: 'b-c', dot: 'var(--gold)'  },
  'planning':     { label: 'Planning',              cls: 'b-b', dot: '#93C5FD'      },
  'construction': { label: 'Under Construction',    cls: 'b-r', dot: '#F87171'      },
  'tech-controls':{ label: 'Tech Controls',         cls: 'b-v', dot: '#C4B5FD'      },
  'accreditation':{ label: 'Accreditation',         cls: 'b-g', dot: 'var(--green)' },
  'complete':     { label: 'Complete',              cls: 'b-g', dot: 'var(--green)' },
};
const TYPE_ICON = {
  'new-scif':   'fa-building-circle-arrow-right',
  'renovation': 'fa-screwdriver-wrench',
  'expansion':  'fa-maximize',
};
const PHASE_NOTE_COLOR = {
  'complete':    'var(--green)',
  'in-progress': 'var(--gold)',
  'upcoming':    'rgba(143,163,192,.35)',
};

function ConstructionPhaseRow({ phase, isLast }) {
  const dotC = PHASE_NOTE_COLOR[phase.status] || 'rgba(143,163,192,.35)';
  return (
    <div className="relative flex gap-x-3">
      {!isLast && (
        <div className="absolute top-5 bottom-0 w-px" style={{ left: '9px', background: `linear-gradient(to bottom,${dotC}50,transparent)` }} />
      )}
      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: `${dotC}18`, border: `1px solid ${dotC}55` }}>
        {phase.status === 'complete'
          ? <i className="fa-solid fa-check" style={{ fontSize: '7px', color: dotC }} />
          : phase.status === 'in-progress'
          ? <i className="fa-solid fa-circle-half-stroke" style={{ fontSize: '7px', color: dotC }} />
          : <i className="fa-solid fa-circle" style={{ fontSize: '6px', color: `${dotC}60` }} />}
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-center justify-between gap-x-2 mb-0.5">
          <span className="font-head font-semibold text-xs" style={{ color: phase.status === 'upcoming' ? 'rgba(143,163,192,.5)' : 'var(--off-white)' }}>{phase.name}</span>
          <span className="font-mono text-right shrink-0" style={{ fontSize: '9px', color: dotC }}>
            {phase.completedDate ? fmtDate(phase.completedDate) : phase.targetDate ? fmtDate(phase.targetDate) : '—'}
          </span>
        </div>
        {phase.note && <div style={{ fontSize: '9px', color: 'rgba(143,163,192,.38)' }}>{phase.note}</div>}
      </div>
    </div>
  );
}

function ConstructionCard({ project }) {
  const sm        = STATUS_META[project.status] || { label: project.status, cls: 'b-b', dot: '#93C5FD' };
  const daysTo    = daysUntil(project.projectedCompletion);
  const budgetPct = project.budget.total ? Math.round(project.budget.spent / project.budget.total * 100) : 0;
  const phasesDone = project.phases.filter(p => p.status === 'complete').length;
  const phasePct   = Math.round((phasesDone / project.phases.length) * 100);

  return (
    <div className="card p-0 overflow-hidden">
      {/* Card header */}
      <div className="px-6 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(201,168,76,.08)' }}>
        <div className="flex items-start justify-between gap-x-4 mb-3">
          <div className="flex items-center gap-x-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(201,168,76,.07)', border: '1px solid rgba(201,168,76,.18)' }}>
              <i className={`fa-solid ${TYPE_ICON[project.type] || 'fa-building'} text-sm`} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <div className="font-head font-bold text-sm uppercase tracking-wide" style={{ color: 'var(--off-white)', letterSpacing: '.08em' }}>{project.title}</div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(143,163,192,.45)' }}>{project.subtitle}</div>
            </div>
          </div>
          <div className="flex items-center gap-x-2 shrink-0">
            <Badge cls={sm.cls}>{sm.label}</Badge>
            {project.flag === 'amber' && <i className="fa-solid fa-flag text-xs" style={{ color: 'var(--amber)' }} />}
          </div>
        </div>
        <div className="flex items-center gap-x-5 flex-wrap gap-y-1" style={{ fontSize: '10px', color: 'rgba(143,163,192,.45)' }}>
          <span><i className="fa-solid fa-location-dot mr-1.5" style={{ color: 'var(--gold)' }} /><strong style={{ color: 'rgba(240,244,248,.7)' }}>{project.site}</strong> · {project.location}</span>
          <span><i className="fa-solid fa-building-lock mr-1.5" style={{ color: 'var(--gold)' }} />{project.scifType}</span>
          <span><i className="fa-solid fa-ruler-combined mr-1.5" style={{ color: 'var(--gold)' }} />{project.squareFootage?.toLocaleString()} sq ft</span>
          <span><i className="fa-solid fa-shield-halved mr-1.5" style={{ color: 'var(--gold)' }} />{project.classification}</span>
        </div>
      </div>

      {/* Body: 3-column grid */}
      <div className="cs-card-body grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x" style={{ borderColor: 'rgba(201,168,76,.07)' }}>

        {/* Col 1 — Phase timeline */}
        <div className="px-5 py-5">
          <div className="sec-heading mb-4" style={{ fontSize: '.58rem' }}>Build Phases</div>
          <div className="mb-4">
            <div className="flex justify-between mb-1.5" style={{ fontSize: '9px', color: 'rgba(143,163,192,.4)' }}>
              <span className="uppercase tracking-wider" style={{ fontSize: '8px' }}>Overall Progress</span>
              <span style={{ color: 'var(--gold)' }}>{phasePct}%</span>
            </div>
            <Prog v={phasePct} cls="p-gold" h="h-[5px]" />
          </div>
          <div>
            {project.phases.map((p, i) => (
              <ConstructionPhaseRow key={i} phase={p} isLast={i === project.phases.length - 1} />
            ))}
          </div>
        </div>

        {/* Col 2 — Budget */}
        <div className="px-5 py-5">
          <div className="sec-heading mb-4" style={{ fontSize: '.58rem' }}>Budget Breakdown</div>
          <div className="mb-5">
            <div className="flex items-end justify-between mb-1">
              <span style={{ fontSize: '9px', color: 'rgba(143,163,192,.4)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Total Approved</span>
              <span className="font-head font-bold text-lg" style={{ color: 'var(--gold)' }}>${(project.budget.total / 1000).toFixed(0)}K</span>
            </div>
            <div className="flex items-end justify-between mb-2" style={{ fontSize: '10px' }}>
              <span style={{ color: 'rgba(143,163,192,.4)' }}>Spent YTD</span>
              <span className="font-mono font-bold" style={{ color: 'rgba(240,244,248,.7)' }}>${project.budget.spent.toLocaleString()}</span>
            </div>
            <Prog v={budgetPct} cls={budgetPct > 80 ? 'p-a' : 'p-gold'} h="h-[5px]" />
            <div className="flex justify-between mt-1.5" style={{ fontSize: '9px', color: 'rgba(143,163,192,.35)' }}>
              <span>{budgetPct}% spent</span>
              <span>${project.budget.remaining.toLocaleString()} remaining</span>
            </div>
          </div>
          <div className="rounded-lg px-3 py-2.5 mb-4" style={{
            background: project.budget.cfoAuth === 'approved' ? 'rgba(16,185,129,.06)' : 'rgba(245,158,11,.06)',
            border: `1px solid ${project.budget.cfoAuth === 'approved' ? 'rgba(16,185,129,.18)' : 'rgba(245,158,11,.2)'}`,
          }}>
            <div className="flex items-center gap-x-2" style={{ fontSize: '9px' }}>
              <i className={`fa-solid ${project.budget.cfoAuth === 'approved' ? 'fa-circle-check text-emerald-400' : 'fa-hourglass-half text-amber-400'}`} />
              <span style={{ color: project.budget.cfoAuth === 'approved' ? 'rgba(110,231,183,.8)' : 'rgba(252,211,77,.8)' }}>{project.budget.cfoAuthNote}</span>
            </div>
          </div>
          <div className="space-y-2.5">
            {project.budget.breakdown.map((b, i) => {
              const pct = Math.round(b.amount / project.budget.total * 100);
              return (
                <div key={i}>
                  <div className="flex justify-between mb-1" style={{ fontSize: '9px', color: 'rgba(143,163,192,.4)' }}>
                    <span>{b.label}</span>
                    <span className="font-mono" style={{ color: 'rgba(240,244,248,.55)' }}>${b.amount.toLocaleString()}</span>
                  </div>
                  <Prog v={pct} cls={b.status === 'complete' ? 'p-g' : b.status === 'in-progress' ? 'p-gold' : 'p-a'} h="h-[3px]" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Col 3 — Timeline + blockers */}
        <div className="px-5 py-5">
          <div className="sec-heading mb-4" style={{ fontSize: '.58rem' }}>Timeline &amp; Details</div>
          <div className="space-y-2.5 mb-5">
            {[
              { icon: 'fa-calendar-day',     label: 'Kickoff Date',          val: fmtDate(project.kickoffDate)          },
              { icon: 'fa-flag-checkered',   label: 'Projected Completion',   val: fmtDate(project.projectedCompletion) },
              { icon: 'fa-clock',            label: 'Ideal Timeline',         val: project.idealTimeline                },
              { icon: 'fa-hard-hat',         label: 'Contractor',             val: project.contractor                   },
              { icon: 'fa-drafting-compass', label: 'A&E Firm',              val: project.aE                           },
              { icon: 'fa-user-shield',      label: 'SSM (Post-Accred)',       val: project.ssm                         },
            ].map(({ icon, label, val }) => (
              <div key={label} className="flex items-start gap-x-2.5" style={{ fontSize: '10px' }}>
                <i className={`fa-solid ${icon} mt-0.5 shrink-0 w-3 text-center`} style={{ color: 'var(--gold)', fontSize: '9px' }} />
                <div>
                  <div className="uppercase tracking-wider" style={{ fontSize: '8px', color: 'rgba(143,163,192,.4)', letterSpacing: '.07em' }}>{label}</div>
                  <div style={{ color: 'rgba(240,244,248,.7)' }}>{val}</div>
                </div>
              </div>
            ))}
            {daysTo !== null && (
              <div className="flex items-center gap-x-2 mt-1 px-2.5 py-2 rounded-lg" style={{ background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.15)', fontSize: '10px' }}>
                <i className="fa-solid fa-hourglass-half" style={{ color: 'var(--gold)', fontSize: '9px' }} />
                <span style={{ color: 'rgba(201,168,76,.8)' }}><strong>{daysTo}d</strong> until projected completion</span>
              </div>
            )}
          </div>
          {project.blockers?.length > 0 && (
            <div>
              <div className="sec-heading mb-2.5" style={{ fontSize: '.55rem', color: 'rgba(245,158,11,.7)' }}>Active Blockers</div>
              <div className="space-y-2">
                {project.blockers.map((b, i) => (
                  <div key={i} className="flex items-start gap-x-2 px-2.5 py-2 rounded-lg"
                    style={{ background: 'rgba(245,158,11,.05)', border: '1px solid rgba(245,158,11,.15)', fontSize: '9px', color: 'rgba(252,211,77,.7)' }}>
                    <i className="fa-solid fa-triangle-exclamation shrink-0 mt-0.5" style={{ fontSize: '9px' }} />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {project.notes && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(201,168,76,.07)' }}>
              <div className="sec-heading mb-1.5" style={{ fontSize: '.55rem', color: 'rgba(143,163,192,.4)' }}>Notes</div>
              <p style={{ fontSize: '9px', color: 'rgba(143,163,192,.4)', lineHeight: '1.5' }}>{project.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConstructionSection({ data }) {
  const projects    = data.construction || [];
  const totalBudget  = projects.reduce((a, p) => a + p.budget.total, 0);
  const totalSpent   = projects.reduce((a, p) => a + p.budget.spent, 0);
  const activeCount  = projects.filter(p => p.status !== 'complete').length;
  const blockerCount = projects.reduce((a, p) => a + (p.blockers?.length || 0), 0);

  return (
    <div className="section">
      <div className="flex items-end justify-between mb-7">
        <div>
          <div className="sec-heading mb-1">Infrastructure Pipeline</div>
          <h2 className="font-head text-[1.8rem] font-bold" style={{ color: 'var(--off-white)' }}>Construction &amp; Secure Space Projects</h2>
          <p className="text-xs mt-1" style={{ color: 'rgba(143,163,192,.4)' }}>Active builds, renovations, and accreditation milestones across all facilities</p>
        </div>
        <span className="text-[9px] font-mono uppercase tracking-widest px-4 py-1.5 rounded"
          style={{ background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.15)', color: 'rgba(201,168,76,.5)' }}>
          {activeCount} Active Project{activeCount !== 1 ? 's' : ''} · FY26
        </span>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
        {[
          { icon: 'fa-helmet-safety',        label: 'Active Projects',  val: activeCount,                                         sub: 'Across all facilities'       },
          { icon: 'fa-dollar-sign',          label: 'Total Budget',     val: `$${(totalBudget / 1000).toFixed(0)}K`,              sub: 'All authorized projects'     },
          { icon: 'fa-chart-line',           label: 'Total Spent YTD',  val: `$${(totalSpent / 1000).toFixed(1)}K`,               sub: `${totalBudget ? Math.round(totalSpent / totalBudget * 100) : 0}% of total budget` },
          { icon: 'fa-triangle-exclamation', label: 'Active Blockers',  val: blockerCount, sub: 'Requiring PM attention', color: blockerCount > 0 ? 'var(--amber)' : 'var(--green)' },
        ].map((k, i) => (
          <div key={i} className="card card-kpi p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(201,168,76,.07)', border: '1px solid rgba(201,168,76,.18)' }}>
                <i className={`fa-solid ${k.icon} text-base`} style={{ color: 'var(--gold)' }} />
              </div>
            </div>
            <div className="uppercase tracking-widest mb-2" style={{ fontSize: '.58rem', fontWeight: 700, color: 'rgba(143,163,192,.5)', letterSpacing: '.1em' }}>{k.label}</div>
            <div className="font-head font-bold leading-none mb-2" style={{ fontSize: '2rem', color: k.color || 'var(--gold)' }}>{k.val}</div>
            <div className="text-xs" style={{ color: 'rgba(143,163,192,.4)' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {projects.length === 0 ? (
          <div className="card p-12 text-center" style={{ color: 'rgba(143,163,192,.35)' }}>
            <i className="fa-solid fa-helmet-safety text-4xl mb-4 block" style={{ color: 'rgba(201,168,76,.2)' }} />
            <div className="font-head font-semibold mb-1">No active construction projects</div>
            <div className="text-sm">Projects will appear here once added to construction.json</div>
          </div>
        ) : (
          projects.map(p => <ConstructionCard key={p.id} project={p} />)
        )}
      </div>
    </div>
  );
}
