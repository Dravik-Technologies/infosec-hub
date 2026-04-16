import { useEffect } from 'react';
import { MASH, sevCls } from '../app.js';
import KpiCard from '../components/KpiCard.jsx';
import NextMilestoneCard from '../components/NextMilestoneCard.jsx';
import FacilityCard from '../components/FacilityCard.jsx';
import TimelineItem from '../components/TimelineItem.jsx';
import { Badge } from '../components/index.jsx';

const FEATURED = ['lincolnia-hq', 'texas-field', 'california-lab', 'maryland-warehouse'];

export default function DashboardSection({ data, onNavigate }) {
  const { sites = [], risks = [], budget = {}, compliance = {}, milestones = [], activity = [] } = data;

  const featured    = FEATURED.map(id => sites.find(s => s.id === id)).filter(Boolean);
  const openRisks   = risks.filter(r => r.status !== 'resolved');
  const highRisks   = openRisks.filter(r => r.severity === 'critical' || r.severity === 'high');
  const avgPosture  = sites.length ? Math.round(sites.reduce((a, s) => a + s.compliance, 0) / sites.length) : 0;
  const compliantCt = sites.filter(s => s.compliance >= 95).length;
  const atRiskCt    = sites.filter(s => s.compliance < 82).length;
  const budgetTotal  = budget.total || 0;
  const budgetSpent  = budget.spent || 0;
  const budgetRemain = budgetTotal - budgetSpent;
  const budgetPct    = budgetTotal ? Math.round(budgetRemain / budgetTotal * 100) : 0;
  const nextMs       = milestones[0];
  const actColor     = { success: 'bg-emerald-400', warning: 'bg-amber-400', info: 'bg-yellow-500', danger: 'bg-red-400' };

  useEffect(() => { MASH.initTilt(); }, [featured.length]);

  return (
    <div className="section">
      {/* Page heading */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="sec-heading mb-1.5">Program Overview</div>
          <h2 className="font-head font-bold" style={{ fontSize: '1.75rem', color: 'var(--off-white)', letterSpacing: '-.01em' }}>
            Security Operations Dashboard
          </h2>
          <p className="text-xs mt-1" style={{ color: 'rgba(143,163,192,.4)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <span className="text-[9px] font-mono uppercase tracking-widest px-4 py-1.5 rounded"
          style={{ background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.15)', color: 'rgba(201,168,76,.5)' }}>
          FY26 Q2 &nbsp;·&nbsp; SECRET//NOFORN
        </span>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        <KpiCard icon="fa-building" label="Active Facilities" value={sites.length}
          sub={`${compliantCt} Compliant · ${atRiskCt} Need Attention`} />

        <KpiCard icon="fa-shield-halved" label="Overall Security Posture"
          value={`${avgPosture}%`} valueColor="var(--gold)"
          progress={avgPosture} sub="↑ 4% vs. Last Month" />

        <KpiCard icon="fa-dollar-sign" label="FY26 Budget Remaining"
          value={`$${(budgetRemain / 1e6).toFixed(2)}M`}
          progress={budgetPct} sub={`${budgetPct}% of $${(budgetTotal / 1e6).toFixed(2)}M approved`} />

        <KpiCard icon="fa-triangle-exclamation" label="Open Risk Items"
          value={openRisks.length}
          valueColor={openRisks.length > 4 ? '#EF4444' : 'var(--gold)'}
          sub={`${highRisks.length} High Priority · ${openRisks.length - highRisks.length} Medium`}>
          <div className="space-y-1.5 mt-3">
            {openRisks.slice(0, 3).map(r => (
              <div key={r.id} className="flex items-center justify-between" style={{ fontSize: '10px' }}>
                <span className="truncate mr-2" style={{ color: 'rgba(143,163,192,.5)' }}>{(r.title || '').split('—')[0].trim().slice(0, 28)}</span>
                <Badge cls={sevCls(r.severity)}>{r.severity?.toUpperCase()}</Badge>
              </div>
            ))}
          </div>
        </KpiCard>

        <NextMilestoneCard ms={nextMs} />
      </div>

      {/* Main two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* LEFT — Facilities */}
        <div className="col-span-1 xl:col-span-7">
          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="sec-heading mb-1">Facilities from Orbit</div>
              <p className="text-xs" style={{ color: 'rgba(143,163,192,.4)' }}>Active cleared facilities under program management</p>
            </div>
            <button onClick={() => onNavigate('sites')}
              className="text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-x-1.5"
              style={{ color: 'var(--gold)', fontSize: '.65rem', letterSpacing: '.08em' }}>
              View All {sites.length} Sites <i className="fa-solid fa-arrow-right text-[9px]" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {featured.map(s => (
              <FacilityCard key={s.id} site={s} onClick={() => MASH.openSiteModal && MASH.openSiteModal(s.id)} />
            ))}
          </div>
        </div>

        {/* RIGHT — Timeline */}
        <div className="col-span-1 xl:col-span-5">
          <div className="mb-5">
            <div className="sec-heading mb-1">Upcoming Inspections &amp; Secure Space Projects</div>
            <p className="text-xs" style={{ color: 'rgba(143,163,192,.4)' }}>Ideal timeline for new secure spaces: 4–8 months</p>
          </div>
          <div className="card p-6">
            {milestones.map((m, i) => (
              <TimelineItem key={m.id} item={m} isLast={i === milestones.length - 1} />
            ))}
          </div>
        </div>

      </div>

      {/* Recent Activity */}
      {activity.length > 0 && (
        <div className="mt-6 card p-5">
          <div className="sec-heading mb-4">Recent Program Activity</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activity.slice(0, 6).map(a => {
              const ts = new Date(a.timestamp);
              return (
                <div key={a.id} className="flex gap-x-3" style={{ fontSize: '10px' }}>
                  <div className={`w-1.5 shrink-0 rounded-full mt-1 ${actColor[a.type] || 'bg-white/25'}`} style={{ minHeight: '14px' }} />
                  <div>
                    <div className="font-medium leading-snug" style={{ color: 'rgba(240,244,248,.7)' }}>{a.message}</div>
                    <div className="mt-0.5" style={{ color: 'rgba(143,163,192,.35)' }}>{ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {a.site}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
