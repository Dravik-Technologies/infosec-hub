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

function postureVariant(status) {
  const s = (status || '').toLowerCase();
  if (/nominal/.test(s)) return 'tone-good';
  if (/guarded|watch/.test(s)) return 'tone-watch';
  if (/elevated|critical/.test(s)) return 'tone-risk';
  return 'tone-blue';
}

function milestoneDotClass(status) {
  const s = (status || '').toLowerCase();
  if (/complete|active|approved/.test(s)) return 'dot-green';
  if (/critical|overdue|risk/.test(s)) return 'dot-red';
  if (/watch|pending|upcoming/.test(s)) return 'dot-amber';
  return '';
}

export default function ProgramSecurityPage({ data }) {
  const facility   = data?.facilitySecurity || {};
  const personnel  = data?.personnelSecurity || {};
  const activities = data?.activitiesSecurity || {};
  const summary    = facility.summary || {};
  const sites      = facility.sites || [];
  const categories = activities.categories || [];
  const training   = personnel.training || {};
  const visits     = personnel.visitAccessRequests || {};
  const clearance  = personnel.clearanceStatus || {};

  const totalFacilities = (summary.nominal || 0) + (summary.guarded || 0) + (summary.elevated || 0);

  // Derive overall posture
  const overallPosture = summary.elevated > 0 ? 'Elevated'
    : summary.guarded > 0 ? 'Guarded' : 'Nominal';
  const postureColor = summary.elevated > 0 ? 'var(--red-val)'
    : summary.guarded > 0 ? 'var(--amber-val)' : 'var(--green)';

  return (
    <div className="page-shell">
      <section className="ops-hero">
        <div className="ops-hero-main">
          <div className="ops-hero-kicker">Security operating picture</div>
          <div className="ops-hero-title">Facility status, personnel readiness, and activity security on one surface.</div>
          <div className="ops-hero-copy">
            Keep leadership focused on site posture, overdue security training, and the activity lanes carrying the most operational friction.
          </div>
        </div>
        <div className="ops-hero-side">
          <div className="signal-mini">
            <label>Overall posture</label>
            <strong>{overallPosture}</strong>
            <span>{totalFacilities} facilities in view</span>
          </div>
          <div className="signal-mini">
            <label>Priority queue</label>
            <strong>{(training.overdue || 0) + (visits.open || 0)}</strong>
            <span>{training.overdue || 0} training · {visits.open || 0} requests</span>
          </div>
        </div>
      </section>

      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Program Security</h1>
          <p>
            Facility posture, personnel readiness, and activity security
            {totalFacilities > 0 ? ` across ${totalFacilities} facilities.` : '.'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {totalFacilities > 0 && (
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: postureColor, background: 'var(--bg-alt)', border: `1px solid ${postureColor}33`, borderRadius: '999px', padding: '0.3rem 0.75rem', whiteSpace: 'nowrap' }}>
              {overallPosture}
            </span>
          )}
          <span className="page-badge teal">{totalFacilities} Facilities</span>
        </div>
      </div>

      {/* KPI strip */}
      <section className="kpi-strip">
        <MetricCard
          label="Nominal Facilities"
          value={summary.nominal || 0}
          hint="Green operating posture"
          tone="good"
        />
        <MetricCard
          label="Guarded Facilities"
          value={summary.guarded || 0}
          hint="Active watch items"
          tone={summary.guarded > 0 ? 'watch' : 'default'}
        />
        <MetricCard
          label="Training Overdue"
          value={training.overdue || 0}
          hint="Personnel security refresh needed"
          tone={training.overdue > 0 ? 'risk' : 'good'}
        />
        <MetricCard
          label="Visit Access Requests"
          value={visits.open || 0}
          hint={visits.priority ? `${visits.priority} priority` : 'open queue'}
          tone={visits.open > 10 ? 'watch' : 'default'}
        />
      </section>

      {/* Facility posture summary */}
      {totalFacilities > 0 && (
        <div className="posture-strip">
          <div className={`posture-cell ${summary.nominal > 0 ? 'tone-good' : 'tone-blue'}`}>
            <label>Nominal</label>
            <strong>{summary.nominal || 0}</strong>
          </div>
          <div className="posture-divider" />
          <div className={`posture-cell ${summary.guarded > 0 ? 'tone-watch' : 'tone-blue'}`}>
            <label>Guarded</label>
            <strong>{summary.guarded || 0}</strong>
          </div>
          <div className="posture-divider" />
          <div className={`posture-cell ${summary.elevated > 0 ? 'tone-risk' : 'tone-blue'}`}>
            <label>Elevated</label>
            <strong>{summary.elevated || 0}</strong>
          </div>
          <div className="posture-divider" />
          <div className="posture-cell tone-teal">
            <label>Total Facilities</label>
            <strong>{totalFacilities}</strong>
          </div>
        </div>
      )}

      {/* Facility list + Personnel security */}
      <section className="split-grid">

        <div className="card">
          <div className="card-header">
            <h3>Facility Security Status</h3>
            <span>{sites.length} sites</span>
          </div>
          <div className="card-body">
            {sites.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🏢</div>
                <p>No facility data available.</p>
              </div>
            ) : (
              <div className="data-list">
                {sites.map(item => (
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
            )}

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
              <ProgressBar
                label="Training compliance"
                value={training.current || 0}
                max={(training.current || 0) + (training.overdue || 0) + (training.dueSoon || 0)}
                tone="teal"
              />
            )}

            {clearance.active > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.875rem' }}>
                <div style={{ font: '500 0.68rem Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--muted)', marginBottom: '0.5rem' }}>
                  Clearance Breakdown
                </div>
                {Object.entries(clearance)
                  .filter(([k]) => k !== 'active' && k !== 'reinvestigationsDue')
                  .map(([key, val]) => (
                    <div key={key} className="data-row" style={{ paddingBlock: '0.5rem' }}>
                      <div className="data-row-main">
                        <strong style={{ textTransform: 'capitalize' }}>
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </strong>
                      </div>
                      <div className="data-row-meta"><strong>{val}</strong></div>
                    </div>
                  ))}
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
            <span>{activities.openCount != null ? `${activities.openCount} open` : 'Bridge to MASH'}</span>
          </div>
          <div className="card-body">
            {activities.headline && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {activities.headline}
              </p>
            )}
            {categories.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <p>No activity data available.</p>
              </div>
            ) : (
              <div className="card-grid-3">
                {categories.map(item => (
                  <div key={item.id} className="project-card">
                    <div className="project-card-top">
                      <h4>{item.name}</h4>
                      <span className={`badge ${item.open > 0 ? 'badge-amber' : 'badge-green'}`}>
                        {item.open} open
                      </span>
                    </div>
                    {item.total != null && (
                      <p>{item.total} total tracked</p>
                    )}
                    {item.note && <p>{item.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
