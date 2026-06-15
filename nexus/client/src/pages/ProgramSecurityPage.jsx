import MetricCard from '../components/MetricCard.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import BarChart from '../components/BarChart.jsx';
import { fmtDate } from '../app.js';

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

export default function ProgramSecurityPage({ data, trend }) {
  const facility   = data?.facilitySecurity || {};
  const personnel  = data?.personnelSecurity || {};
  const activities = data?.activitiesSecurity || {};
  const documents  = data?.documentControl || {};
  const dd254      = data?.dd254 || {};
  const media      = data?.mediaControl || {};
  const inspections = data?.selfInspections || {};
  const summary    = facility.summary || {};
  const sites      = facility.sites || [];
  const categories = activities.categories || [];
  const training   = personnel.training || {};
  const visits     = personnel.visitAccessRequests || {};
  const clearance  = personnel.clearanceStatus || {};
  const highAttentionFacilities = (facility.idsIssueCount || 0) + (facility.overdueFindings || 0);

  const totalFacilities = (summary.nominal || 0) + (summary.guarded || 0) + (summary.elevated || 0);

  // Derive overall posture
  const overallPosture = summary.elevated > 0 ? 'Elevated'
    : summary.guarded > 0 ? 'Guarded' : 'Nominal';
  const postureColor = summary.elevated > 0 ? 'var(--red-val)'
    : summary.guarded > 0 ? 'var(--amber-val)' : 'var(--green)';

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Program Security</h1>
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
          trend={trend?.security?.nominalFacilities}
        />
        <MetricCard
          label="Guarded Facilities"
          value={summary.guarded || 0}
          hint="Active watch items"
          tone={summary.guarded > 0 ? 'watch' : 'default'}
          trend={trend?.security?.guardedFacilities}
        />
        <MetricCard
          label="Training Overdue"
          value={training.overdue || 0}
          hint="Personnel security refresh needed"
          tone={training.overdue > 0 ? 'risk' : 'good'}
          trend={trend?.security?.overdueTraining}
        />
        <MetricCard
          label="Visit Access Requests"
          value={visits.open || 0}
          hint={visits.priority ? `${visits.priority} priority` : 'open queue'}
          tone={visits.open > 10 ? 'watch' : 'default'}
          trend={trend?.security?.visitRequests}
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

      <div className="ops-summary-strip">
        <div className="ops-summary-cell">
          <label>Facility Alerts</label>
          <strong>{highAttentionFacilities}</strong>
        </div>
        <div className="ops-summary-cell">
          <label>Inventory Overdue</label>
          <strong>{documents.inventoryOverdue || 0}</strong>
        </div>
        <div className="ops-summary-cell">
          <label>DD254 Action</label>
          <strong>{(dd254.actionable || 0) + (dd254.reviewDue30d || 0) + (dd254.expiring30d || 0)}</strong>
        </div>
        <div className="ops-summary-cell">
          <label>Media Exceptions</label>
          <strong>{(media.overdueReturns || 0) + (media.flagged || 0)}</strong>
        </div>
        <div className="ops-summary-cell">
          <label>Inspection Overdue</label>
          <strong>{inspections.overdue || 0}</strong>
        </div>
      </div>

      {/* Facility Posture Chart */}
      {totalFacilities > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Facility Posture Distribution</h3>
            <span>{totalFacilities} total facilities</span>
          </div>
          <div className="card-body" style={{ minHeight: 280 }}>
            <BarChart
              data={[
                { name: 'Nominal', value: summary.nominal || 0 },
                { name: 'Guarded', value: summary.guarded || 0 },
                { name: 'Elevated', value: summary.elevated || 0 },
              ]}
              dataKey="value"
              label="Facilities"
              colors={['#15803d', '#d97706', '#dc2626']}
              height={260}
            />
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
                      {item.idsAlarm && item.idsAlarm !== 'Operational' && (
                        <span className="badge badge-red">IDS {item.idsAlarm}</span>
                      )}
                      {item.fclExpires && <small>FCL {fmtDate(item.fclExpires)}</small>}
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
              <div className="stat-cell">
                <label>PRD Expiring</label>
                <strong style={{ color: personnel.clearanceExpiring30d > 0 ? 'var(--amber-val)' : undefined }}>{personnel.clearanceExpiring30d || 0}</strong>
                <span>within 30 days</span>
              </div>
              <div className="stat-cell">
                <label>Travel Debriefs</label>
                <strong style={{ color: personnel.foreignTravelDebriefPending > 0 ? 'var(--red-val)' : undefined }}>{personnel.foreignTravelDebriefPending || 0}</strong>
                <span>pending closeout</span>
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

      <section className="split-grid">
        <div className="card">
          <div className="card-header">
            <h3>Document, DD254 &amp; Media Control</h3>
            <span>{documents.accountableTotal || 0} accountable docs</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="stat-grid-3">
              <div className="stat-cell">
                <label>Inventory Overdue</label>
                <strong style={{ color: documents.inventoryOverdue > 0 ? 'var(--red-val)' : undefined }}>{documents.inventoryOverdue || 0}</strong>
                <span>document control</span>
              </div>
              <div className="stat-cell">
                <label>Status Exceptions</label>
                <strong style={{ color: documents.statusExceptions > 0 ? 'var(--amber-val)' : undefined }}>{documents.statusExceptions || 0}</strong>
                <span>non-active docs</span>
              </div>
              <div className="stat-cell">
                <label>Media Returns</label>
                <strong style={{ color: media.overdueReturns > 0 ? 'var(--red-val)' : undefined }}>{media.overdueReturns || 0}</strong>
                <span>overdue</span>
              </div>
              <div className="stat-cell">
                <label>DD254 Active</label>
                <strong>{dd254.active || 0}</strong>
                <span>{dd254.total || 0} tracked</span>
              </div>
              <div className="stat-cell">
                <label>DD254 Expiring 30d</label>
                <strong style={{ color: dd254.expiring30d > 0 ? 'var(--amber-val)' : undefined }}>{dd254.expiring30d || 0}</strong>
                <span>renewal window</span>
              </div>
              <div className="stat-cell">
                <label>DD254 Review Due</label>
                <strong style={{ color: dd254.reviewDue30d > 0 ? 'var(--amber-val)' : undefined }}>{dd254.reviewDue30d || 0}</strong>
                <span>scheduled reviews</span>
              </div>
            </div>
            <div className="data-list">
              <div className="data-row">
                <div className="data-row-main"><strong>Pending Destruction</strong><p>media disposition queue</p></div>
                <div className="data-row-meta"><strong>{media.pendingDestruction || 0}</strong></div>
              </div>
              <div className="data-row">
                <div className="data-row-main"><strong>Flagged Media</strong><p>items with exception flags</p></div>
                <div className="data-row-meta"><strong>{media.flagged || 0}</strong></div>
              </div>
              <div className="data-row">
                <div className="data-row-main"><strong>DD254 Action Required</strong><p>draft, review, revision, or expired contracts</p></div>
                <div className="data-row-meta"><strong>{dd254.actionable || 0}</strong></div>
              </div>
            </div>
            {Array.isArray(dd254.items) && dd254.items.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.875rem' }}>
                <div style={{ font: '500 0.68rem Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--muted)', marginBottom: '0.5rem' }}>
                  Priority DD254 Items
                </div>
                <div className="data-list">
                  {dd254.items.map(item => (
                    <div key={item.id} className="data-row">
                      <div className="data-row-main">
                        <strong>{item.contractNumber || 'Contract pending'}</strong>
                        <p>{item.programName || item.customer || 'Program not set'}</p>
                      </div>
                      <div className="data-row-meta">
                        <span className={`badge ${statusBadge(item.status)}`}>{item.status || 'Unknown'}</span>
                        {item.reviewDueDate && <small>Review {fmtDate(item.reviewDueDate)}</small>}
                        {item.expirationDate && <small>Expires {fmtDate(item.expirationDate)}</small>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Inspection Readiness</h3>
            <span>{inspections.inProgress || 0} in progress</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="stat-grid-3">
              <div className="stat-cell">
                <label>Upcoming 90d</label>
                <strong>{inspections.upcoming90d || 0}</strong>
                <span>scheduled reviews</span>
              </div>
              <div className="stat-cell">
                <label>Overdue</label>
                <strong style={{ color: inspections.overdue > 0 ? 'var(--red-val)' : undefined }}>{inspections.overdue || 0}</strong>
                <span>past due</span>
              </div>
              <div className="stat-cell">
                <label>Open Findings</label>
                <strong>{inspections.openFindings || 0}</strong>
                <span>from campaigns</span>
              </div>
            </div>
            <div className="data-list">
              <div className="data-row">
                <div className="data-row-main"><strong>Recent Completed</strong><p>completed in last 90 days</p></div>
                <div className="data-row-meta"><strong>{inspections.recentCompleted || 0}</strong></div>
              </div>
            </div>
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
            <div className="stat-grid-3" style={{ marginBottom: categories.length === 0 ? 0 : '1rem' }}>
              <div className="stat-cell">
                <label>Open</label>
                <strong>{activities.openCount || 0}</strong>
                <span>current activity queue</span>
              </div>
              <div className="stat-cell">
                <label>Overdue</label>
                <strong style={{ color: activities.overdueCount > 0 ? 'var(--red-val)' : undefined }}>{activities.overdueCount || 0}</strong>
                <span>require attention</span>
              </div>
              <div className="stat-cell">
                <label>Upcoming 30d</label>
                <strong>{activities.upcoming30d || 0}</strong>
                <span>scheduled</span>
              </div>
            </div>
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
