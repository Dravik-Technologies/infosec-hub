import MetricCard from '../components/MetricCard.jsx';
import ProgressBar from '../components/ProgressBar.jsx';

function statusBadge(status) {
  const s = (status || '').toLowerCase();
  if (/nominal|active|current|cleared/.test(s)) return 'badge-green';
  if (/critical|expired|overdue|risk/.test(s)) return 'badge-red';
  if (/guarded|elevated|pending|review|watch|inspection/.test(s)) return 'badge-amber';
  if (/scheduled|processing/.test(s)) return 'badge-blue';
  return 'badge-gray';
}

export default function ProgramSecurityPage({ data }) {
  const facility = data?.facilitySecurity || {};
  const personnel = data?.personnelSecurity || {};
  const activities = data?.activitiesSecurity || {};
  const summary = facility.summary || {};
  const sites = facility.sites || [];
  const categories = activities.categories || [];
  const training = personnel.training || {};
  const visits = personnel.visitAccessRequests || {};
  const clearance = personnel.clearanceStatus || {};

  const totalFacilities = (summary.nominal || 0) + (summary.guarded || 0) + (summary.elevated || 0);

  return (
    <div className="page-shell">

      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Program Security</h1>
          <p>Facility posture, personnel readiness, and activity security across {totalFacilities} facilities.</p>
        </div>
        <span className="page-badge teal">{totalFacilities} Facilities</span>
      </div>

      {/* KPI strip */}
      <section className="kpi-strip">
        <MetricCard label="Nominal Facilities" value={summary.nominal || 0} hint="Green operating posture" tone="good" />
        <MetricCard label="Guarded Facilities" value={summary.guarded || 0} hint="Active watch items" tone="watch" />
        <MetricCard label="Training Overdue" value={training.overdue || 0} hint="Personnel security refresh needed" tone={training.overdue > 0 ? 'risk' : 'good'} />
        <MetricCard label="Visit Access Requests" value={visits.open || 0} hint={visits.priority ? `${visits.priority} priority` : 'open queue'} />
      </section>

      {/* Facility security + Personnel security */}
      <section className="split-grid">

        {/* Facility list */}
        <div className="card">
          <div className="card-header">
            <h3>Facility Security Status</h3>
            <span>{sites.length} sites</span>
          </div>
          <div className="card-body">
            <div className="data-list">
              {sites.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: 0 }}>No facility data available.</p>
              ) : sites.map(item => (
                <div key={item.id} className="data-row">
                  <div className="data-row-main">
                    <strong>{item.site}</strong>
                    <p>{item.issue || 'No open issues'}</p>
                  </div>
                  <div className="data-row-meta">
                    <span className={`badge ${statusBadge(item.status)}`}>{item.status}</span>
                    {item.lastReview && <small>Reviewed {item.lastReview}</small>}
                  </div>
                </div>
              ))}
            </div>

            {/* Facility summary strip */}
            {totalFacilities > 0 && (
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <ProgressBar
                  label="Nominal posture"
                  value={summary.nominal || 0}
                  max={totalFacilities}
                  tone="green"
                />
                {summary.guarded > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <ProgressBar
                      label="Guarded posture"
                      value={summary.guarded || 0}
                      max={totalFacilities}
                      tone="amber"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Personnel security */}
        <div className="card">
          <div className="card-header">
            <h3>Personnel Security</h3>
            <span>Training · Visits · Clearances</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            <div className="stat-grid-3">
              <div className="stat-cell">
                <label>Training Current</label>
                <strong>{training.current || 0}</strong>
                <span>{training.dueSoon || 0} due soon</span>
              </div>
              <div className="stat-cell">
                <label>Visit Requests</label>
                <strong>{visits.open || 0}</strong>
                <span>{visits.processedThisWeek || 0} processed this week</span>
              </div>
              <div className="stat-cell">
                <label>Active Clearances</label>
                <strong>{clearance.active || 0}</strong>
                <span>{clearance.reinvestigationsDue || 0} reinvestigations due</span>
              </div>
            </div>

            {(training.current > 0 || training.overdue > 0) && (
              <div>
                <ProgressBar
                  label="Training compliance"
                  value={training.current || 0}
                  max={(training.current || 0) + (training.overdue || 0) + (training.dueSoon || 0)}
                  tone="teal"
                />
              </div>
            )}

            {clearance.active > 0 && (
              <div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.875rem' }}>
                  <div style={{ font: '500 0.72rem Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: '0.5rem' }}>Clearance Breakdown</div>
                  {Object.entries(clearance).filter(([k]) => k !== 'active' && k !== 'reinvestigationsDue').map(([key, val]) => (
                    <div key={key} className="data-row" style={{ paddingBlock: '0.5rem' }}>
                      <div className="data-row-main">
                        <strong style={{ textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1').trim()}</strong>
                      </div>
                      <div className="data-row-meta"><strong>{val}</strong></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Activities security */}
      {(categories.length > 0 || activities.headline) && (
        <div className="card">
          <div className="card-header">
            <h3>Activities Security</h3>
            <span>Bridge to future security-managers app</span>
          </div>
          <div className="card-body">
            {activities.headline && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {activities.headline}
              </p>
            )}
            <div className="card-grid-3">
              {categories.map(item => (
                <div key={item.id} className="project-card">
                  <div className="project-card-top">
                    <h4>{item.name}</h4>
                    <span className="badge badge-amber">{item.open} open</span>
                  </div>
                  {item.note && <p>{item.note}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
