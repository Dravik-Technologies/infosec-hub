import { useState, useEffect } from 'react';
import { AUTH, fmtDate, fmtShort, daysUntil } from '../app.js';

async function fetchOverview(siteId) {
  const qs = siteId ? `?siteId=${siteId}` : '';
  try {
    const r = await fetch(`/api/workspace/overview${qs}`, { headers: AUTH.hdrs() });
    if (r.status === 401) { AUTH.clearAll(); window.location.reload(); return null; }
    const body = await r.json();
    if (!r.ok) return { _overviewError: true, status: r.status, message: body?.error || 'Overview failed' };
    return body;
  } catch { return null; }
}

function KPI({ label, value, hint, tone = '' }) {
  return (
    <div className={`ws-kpi ${tone}`}>
      <div className="ws-kpi-label">{label}</div>
      <div className="ws-kpi-value">{value ?? '—'}</div>
      {hint && <div className="ws-kpi-hint">{hint}</div>}
    </div>
  );
}

function AlertDot({ tone }) {
  return <span className={`ws-alert-dot ${tone}`} />;
}

export default function OverviewPage({ siteId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchOverview(siteId).then(d => { setData(d); setLoading(false); });
  }, [siteId]);

  if (loading) return <div className="ws-empty">Loading overview…</div>;
  if (!data) return <div className="ws-empty">Overview unavailable — check server connectivity.</div>;
  if (data._overviewError) {
    const hint = data.status === 403
      ? 'Your account has no site access assigned. Contact your administrator.'
      : `Server error (${data.status}): ${data.message}`;
    return <div className="ws-empty">{hint}</div>;
  }

  const { summary = {}, alerts = {}, upcoming = {}, documents = {}, media = {}, findings = {}, activities = {} } = data;

  const overdueActivities = alerts.overdueActivities || [];
  const overdueTraining = alerts.overdueTraining || [];
  const overdueMedia = alerts.overdueMedia || [];
  const idsIssues = alerts.idsIssues || [];
  const debriefPending = alerts.debriefPending || [];
  const clearanceExpiring = alerts.clearanceExpiring || [];

  const totalAlerts = overdueActivities.length + overdueTraining.length + overdueMedia.length +
    idsIssues.length + debriefPending.length;
  const readinessScore = Math.max(0, Math.min(100, Math.round(
    100 - (overdueActivities.length * 7) - (overdueTraining.length * 5) - (idsIssues.length * 8) - (overdueMedia.length * 4)
  )));
  const activeSiteLabel = siteId ? 'Site view active' : 'All-site overview active';
  const heroTags = [
    `${summary.facilities || 0} facilities monitored`,
    `${summary.personnel || 0} cleared personnel`,
    `${activities.scheduled ?? 0} scheduled actions`,
  ];

  return (
    <div className="ws-page">
      <section className="ws-hero">
        <div className="ws-hero-grid">
          <div>
            <div className="ws-hero-kicker">Security program overview</div>
            <div className="ws-hero-title">Security program visibility across facilities, personnel, media, and inspections.</div>
            <div className="ws-hero-copy">
              Track compliance, overdue actions, and site-level security status in one workspace with a clearer operational summary at the top.
            </div>
            <div className="ws-hero-tags">
              <span className="ws-hero-tag">{activeSiteLabel}</span>
              {heroTags.map(tag => <span key={tag} className="ws-hero-tag">{tag}</span>)}
            </div>
          </div>

          <div className="ws-hero-side">
            <div className="ws-signal-card">
              <div className="ws-signal-label">Readiness score</div>
              <div className="ws-signal-value">{readinessScore}%</div>
              <div className="ws-signal-copy">
                Derived from current overdue activities, training gaps, IDS issues, and media exceptions.
              </div>
              <div className="ws-signal-meter">
                <span style={{ width: `${readinessScore}%` }} />
              </div>
            </div>
            <div className="ws-signal-card">
              <div className="ws-signal-label">Open action items</div>
              <div className="ws-signal-value">{totalAlerts}</div>
              <div className="ws-signal-copy">
                {totalAlerts > 0
                  ? 'Items currently require review, follow-up, or corrective action.'
                  : 'No immediate action items are currently open.'}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="ws-page-header">
        <div>
          <div className="ws-page-title">Security Overview</div>
          <div className="ws-page-sub">Actionable summary across all security program areas{siteId ? ' — filtered by site' : ''}.</div>
        </div>
        <span className="ws-count-badge">{totalAlerts} action items</span>
      </div>

      {/* KPI strip */}
      <section className="ws-kpi-strip">
        <KPI label="Facilities" value={summary.facilities} hint="Tracked in program" />
        <KPI label="Cleared Personnel" value={summary.personnel} hint="Active roster" />
        <KPI
          label="Overdue Activities"
          value={overdueActivities.length}
          hint={overdueActivities.length > 0 ? 'Require immediate action' : 'All current'}
          tone={overdueActivities.length > 0 ? 'risk' : 'good'}
        />
        <KPI
          label="Action Items"
          value={totalAlerts}
          hint="Overdue or attention required"
          tone={totalAlerts > 5 ? 'risk' : totalAlerts > 0 ? 'watch' : 'good'}
        />
      </section>

      <div className="ws-grid-2">

        {/* Alerts */}
        <div className="ws-card">
          <div className="ws-card-header">
            <h3>Immediate Actions Required</h3>
            <span>{totalAlerts} items</span>
          </div>
          <div className="ws-card-body">
            {totalAlerts === 0 ? (
              <div className="ws-empty" style={{ padding: '1rem 0' }}>No immediate actions.</div>
            ) : (
              <div className="ws-alert-list">
                {overdueActivities.map(a => (
                  <div key={a.id} className="ws-alert-item">
                    <AlertDot tone="red" />
                    <div className="ws-alert-main">
                      <strong>{a.title} — Activity Overdue</strong>
                      <span>Scheduled security activity not completed</span>
                    </div>
                  </div>
                ))}
                {overdueTraining.map(p => (
                  <div key={p.id} className="ws-alert-item">
                    <AlertDot tone="red" />
                    <div className="ws-alert-main">
                      <strong>{p.name} — Training Overdue</strong>
                      <span>Personnel security training requirement not met</span>
                    </div>
                  </div>
                ))}
                {debriefPending.map(p => (
                  <div key={p.id} className="ws-alert-item">
                    <AlertDot tone="amber" />
                    <div className="ws-alert-main">
                      <strong>{p.name} — Foreign Travel Debrief Pending</strong>
                      <span>NISPOM post-travel debrief not completed</span>
                    </div>
                  </div>
                ))}
                {idsIssues.map(f => (
                  <div key={f.id} className="ws-alert-item">
                    <AlertDot tone="red" />
                    <div className="ws-alert-main">
                      <strong>{f.name} — IDS Issue</strong>
                      <span>{f.issue}</span>
                    </div>
                  </div>
                ))}
                {overdueMedia.map(m => (
                  <div key={m.id} className="ws-alert-item">
                    <AlertDot tone="amber" />
                    <div className="ws-alert-main">
                      <strong>{m.mediaId} — Media Return Overdue</strong>
                      <span>Assigned to {m.assignedTo || 'unknown'}</span>
                    </div>
                  </div>
                ))}
                {clearanceExpiring.map(p => (
                  <div key={p.id} className="ws-alert-item">
                    <AlertDot tone="blue" />
                    <div className="ws-alert-main">
                      <strong>{p.name} — Clearance Expiring</strong>
                      <span>PRD: {fmtDate(p.prd)} ({daysUntil(p.prd)} days)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Upcoming activities */}
          <div className="ws-card">
            <div className="ws-card-header">
              <h3>Upcoming Activities (30 days)</h3>
              <span>{(upcoming.activities || []).length} scheduled</span>
            </div>
            <div className="ws-card-body">
              {(upcoming.activities || []).length === 0 ? (
                <div className="ws-empty" style={{ padding: '0.75rem 0' }}>No upcoming activities.</div>
              ) : (
                <div className="ws-alert-list">
                  {(upcoming.activities || []).map(a => (
                    <div key={a.id} className="ws-alert-item">
                      <AlertDot tone="blue" />
                      <div className="ws-alert-main">
                        <strong>{a.title}</strong>
                        <span>{fmtShort(a.date)} · {a.category}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Activities summary */}
          <div className="ws-card">
            <div className="ws-card-header"><h3>Activities Summary</h3></div>
            <div className="ws-card-body">
              <table className="ws-table">
                <tbody>
                  <tr>
                    <td>Total Activities</td>
                    <td><strong>{activities.total ?? summary.activities ?? '—'}</strong></td>
                    <td><span className="badge badge-gray">In register</span></td>
                  </tr>
                  <tr>
                    <td>Overdue</td>
                    <td><strong>{overdueActivities.length}</strong></td>
                    <td>{overdueActivities.length > 0 ? <span className="badge badge-red">Action needed</span> : <span className="badge badge-green">Current</span>}</td>
                  </tr>
                  <tr>
                    <td>Scheduled / Pending</td>
                    <td><strong>{activities.scheduled ?? '—'}</strong></td>
                    <td><span className="badge badge-blue">Upcoming</span></td>
                  </tr>
                  <tr>
                    <td>Open Issues</td>
                    <td><strong>{activities.openIssues ?? '—'}</strong></td>
                    <td>{(activities.openIssues ?? 0) > 0 ? <span className="badge badge-amber">Action needed</span> : <span className="badge badge-gray">None</span>}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Document & Media status */}
          <div className="ws-card">
            <div className="ws-card-header"><h3>Document &amp; Media Status</h3></div>
            <div className="ws-card-body">
              <table className="ws-table">
                <tbody>
                  <tr>
                    <td>Controlled Documents</td>
                    <td><strong>{documents.total}</strong></td>
                    <td><span className="badge badge-gray">{documents.accountable} accountable</span></td>
                  </tr>
                  <tr>
                    <td>Inventory Due / Overdue</td>
                    <td><strong>{documents.pendingInventory}</strong></td>
                    <td>{documents.pendingInventory > 0 ? <span className="badge badge-amber">Action needed</span> : <span className="badge badge-green">Current</span>}</td>
                  </tr>
                  <tr>
                    <td>Document Exceptions</td>
                    <td><strong>{documents.exceptions ?? 0}</strong></td>
                    <td>{(documents.exceptions ?? 0) > 0 ? <span className="badge badge-red">Review required</span> : <span className="badge badge-green">None</span>}</td>
                  </tr>
                  <tr>
                    <td>Media Items</td>
                    <td><strong>{media.total}</strong></td>
                    <td><span className="badge badge-gray">{media.assigned} assigned</span></td>
                  </tr>
                  <tr>
                    <td>Overdue Media Returns</td>
                    <td><strong>{media.overdueReturn}</strong></td>
                    <td>{media.overdueReturn > 0 ? <span className="badge badge-red">Action needed</span> : <span className="badge badge-green">Current</span>}</td>
                  </tr>
                  <tr>
                    <td>Pending Destruction</td>
                    <td><strong>{media.pendingDestruction}</strong></td>
                    <td>{media.pendingDestruction > 0 ? <span className="badge badge-amber">Schedule</span> : <span className="badge badge-gray">None</span>}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* Findings summary */}
      {findings.open > 0 && (
        <div className="ws-card">
          <div className="ws-card-header">
            <h3>Open Self-Inspection Findings</h3>
            <span>{findings.open} open</span>
          </div>
          <div className="ws-card-body">
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {findings.bySeverity?.High > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-red">HIGH</span>
                  <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>{findings.bySeverity.High}</span>
                </div>
              )}
              {findings.bySeverity?.Medium > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-amber">MEDIUM</span>
                  <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>{findings.bySeverity.Medium}</span>
                </div>
              )}
              {findings.bySeverity?.Low > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-blue">LOW</span>
                  <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>{findings.bySeverity.Low}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
