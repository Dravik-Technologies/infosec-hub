import MetricCard from '../components/MetricCard.jsx';
import DonutChart from '../components/DonutChart.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import { fmtDate } from '../app.js';

function statusBadge(status) {
  const s = (status || '').toLowerCase();
  if (/active|authorized|current|ready|resolved|closed/.test(s)) return 'badge-green';
  if (/expired|critical|overdue|failed/.test(s)) return 'badge-red';
  if (/pending|review|in.progress|watch|expiring|new/.test(s)) return 'badge-amber';
  if (/planned|submitted/.test(s)) return 'badge-blue';
  return 'badge-gray';
}

const ATO_COLORS = {
  Active:       '#15803d',
  Authorized:   '#15803d',
  Pending:      '#d97706',
  'In Progress':'#1d4ed8',
  Expired:      '#dc2626',
  Planned:      '#0f766e',
};
const SEV_COLORS = {
  CRITICAL: '#991b1b', Critical: '#991b1b',
  HIGH:     '#dc2626', High:     '#dc2626',
  MEDIUM:   '#d97706', Medium:   '#d97706',
  LOW:      '#15803d', Low:      '#15803d',
};

function SectionLabel({ children, live }) {
  return (
    <div className="section-label" style={live ? {} : { '--dot-color': 'var(--muted)' }}>
      {children}
    </div>
  );
}

export default function ProgramCyberPage({ data }) {
  if (!data || data._error) {
    const msg = data?._error || 'Cyber rollup unavailable.';
    return (
      <div className="page-shell">
        <div className="page-header">
          <div className="page-header-left">
            <h1>IT &amp; Cybersecurity</h1>
            <p>Executive posture rollup from SCORVA.</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">📡</div>
              <p>Cyber rollup data is currently unavailable.</p>
              {msg !== 'Cyber rollup unavailable.' && (
                <p style={{ fontSize: '0.78rem', opacity: 0.7 }}>Reason: {msg}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const ato       = data?.ato         || {};
  const poams     = data?.poams        || {};
  const users     = data?.users        || {};
  const delivery  = data?.delivery     || {};
  const secEvents = data?.securityEvents || {};

  const generatedAt = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null;

  const atoSegments = Object.entries(ato.byStatus || {}).map(([key, value]) => ({
    label: key, value, color: ATO_COLORS[key] || '#94a3b8',
  }));
  const poamSegments = Object.entries(poams.bySeverity || {}).map(([key, value]) => ({
    label: key, value, color: SEV_COLORS[key] || '#94a3b8',
  }));
  const eventSegments = Object.entries(secEvents.bySeverity || {})
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ label: key, value, color: SEV_COLORS[key] || '#94a3b8' }));

  // Derive a simple posture colour from open critical/high POAMs and expired ATOs
  const expiredAtos    = ato.byStatus?.Expired || 0;
  const critHighPoams  = (poams.bySeverity?.CRITICAL || poams.bySeverity?.Critical || 0)
                       + (poams.bySeverity?.HIGH     || poams.bySeverity?.High     || 0);
  const overallPosture = expiredAtos > 0 || critHighPoams > 3 ? 'risk'
    : critHighPoams > 0 ? 'watch' : 'good';
  const postureLabel   = { good: 'Nominal', watch: 'Guarded', risk: 'Elevated' }[overallPosture];
  const postureColor   = { good: 'var(--green)', watch: 'var(--amber-val)', risk: 'var(--red-val)' }[overallPosture];

  return (
    <div className="page-shell">
      <section className="ops-hero">
        <div className="ops-hero-main">
          <div className="ops-hero-kicker">Cyber operating picture</div>
          <div className="ops-hero-title">Authorization health, remediation pressure, and delivery readiness in one view.</div>
          <div className="ops-hero-copy">
            Give executives a faster read on where cyber posture is stable, where POA&M pressure is growing, and where delivery readiness needs intervention.
          </div>
        </div>
        <div className="ops-hero-side">
          <div className="signal-mini">
            <label>Posture</label>
            <strong>{postureLabel}</strong>
            <span>{critHighPoams} critical/high POA&amp;Ms</span>
          </div>
          <div className="signal-mini">
            <label>ATO pressure</label>
            <strong>{expiredAtos}</strong>
            <span>{ato.expiringSoon || 0} expiring soon</span>
          </div>
        </div>
      </section>

      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>IT &amp; Cybersecurity</h1>
          <p>Executive posture rollup — SCORVA is the operational owner of cyber workflows.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: postureColor, background: 'var(--bg-alt)', border: `1px solid ${postureColor}33`, borderRadius: '999px', padding: '0.3rem 0.75rem', whiteSpace: 'nowrap' }}>
            {postureLabel} Posture
          </span>
          {generatedAt && <span className="page-badge gray">Updated {generatedAt}</span>}
        </div>
      </div>

      {/* KPI strip */}
      <section className="kpi-strip">
        <MetricCard
          label="ATO Packages"
          value={ato.total || 0}
          hint={ato.expiringSoon ? `${ato.expiringSoon} expiring soon` : 'portfolio total'}
          tone={expiredAtos > 0 ? 'risk' : 'blue'}
        />
        <MetricCard
          label="Open POA&Ms"
          value={poams.open || 0}
          hint={`${poams.bySeverity?.HIGH || poams.bySeverity?.High || 0} high severity`}
          tone={poams.open > 8 ? 'watch' : poams.open > 0 ? 'default' : 'good'}
        />
        <MetricCard
          label="Active Users"
          value={users.active || 0}
          hint={users.pendingRequests ? `${users.pendingRequests} pending SAARs` : 'in directory'}
        />
        <MetricCard
          label="Hardware Ready"
          value={delivery.hardwareProgress || 0}
          suffix="%"
          hint={`${delivery.hardwareInstalled || 0} of ${delivery.totalHardware || 0} workstations`}
          tone={delivery.hardwareProgress >= 80 ? 'good' : delivery.hardwareProgress >= 50 ? 'watch' : 'risk'}
        />
        {secEvents.criticalHigh > 0 && (
          <MetricCard
            label="Critical/High Events"
            value={secEvents.criticalHigh}
            hint={`${secEvents.open || 0} open events`}
            tone="risk"
          />
        )}
      </section>

      <div className="ops-summary-strip">
        <div className="ops-summary-cell">
          <label>ATOs</label>
          <strong>{ato.total || 0}</strong>
        </div>
        <div className="ops-summary-cell">
          <label>Open POA&amp;Ms</label>
          <strong>{poams.open || 0}</strong>
        </div>
        <div className="ops-summary-cell">
          <label>Users</label>
          <strong>{users.active || 0}</strong>
        </div>
        <div className="ops-summary-cell">
          <label>Events</label>
          <strong>{secEvents.open || 0}</strong>
        </div>
      </div>

      {/* ATO section */}
      <SectionLabel live>Authorization to Operate</SectionLabel>
      <section className="split-grid-wide">

        <div className="card">
          <div className="card-header">
            <h3>ATO System Status</h3>
            <span>{ato.total || 0} packages</span>
          </div>
          <div className="card-body">
            {Object.keys(ato.byStatus || {}).length > 0 && (
              <div className="stat-grid-3" style={{ marginBottom: '1.25rem' }}>
                {Object.entries(ato.byStatus).map(([key, value]) => (
                  <div key={key} className="stat-cell">
                    <label>{key}</label>
                    <strong style={{ color: ATO_COLORS[key] || undefined }}>{value}</strong>
                  </div>
                ))}
              </div>
            )}
            <div className="data-list">
              {(ato.systems || []).length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🛡</div>
                  <p>No ATO packages available.</p>
                </div>
              ) : (ato.systems || []).map(item => (
                <div key={item.id} className="data-row">
                  <div className="data-row-main">
                    <strong>{item.system}</strong>
                    <p>{item.siteId || 'No site assigned'}</p>
                  </div>
                  <div className="data-row-meta">
                    <span className={`badge ${statusBadge(item.status)}`}>{item.status}</span>
                    {item.expires && <small>Exp. {fmtDate(item.expires)}</small>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Donut column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {atoSegments.length > 0 && (
            <div className="card">
              <div className="card-header"><h3>ATO by Status</h3></div>
              <div className="card-body">
                <div className="donut-wrap">
                  <DonutChart
                    segments={atoSegments}
                    size={128}
                    strokeWidth={20}
                    centerValue={String(ato.total || 0)}
                    centerLabel="total"
                  />
                  <div className="donut-legend">
                    {atoSegments.map(seg => (
                      <div key={seg.label} className="legend-item">
                        <div className="legend-dot" style={{ background: seg.color }} />
                        <span>{seg.label}</span>
                        <span className="legend-value">{seg.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {poamSegments.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3>POA&amp;M Severity</h3>
                <span>{poams.open || 0} open</span>
              </div>
              <div className="card-body">
                <div className="donut-wrap">
                  <DonutChart
                    segments={poamSegments}
                    size={100}
                    strokeWidth={16}
                    centerValue={String(poams.open || 0)}
                    centerLabel="open"
                  />
                  <div className="donut-legend">
                    {poamSegments.map(seg => (
                      <div key={seg.label} className="legend-item">
                        <div className="legend-dot" style={{ background: seg.color }} />
                        <span>{seg.label}</span>
                        <span className="legend-value">{seg.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* POAM + Delivery + Workforce */}
      <SectionLabel>Remediation &amp; Provisioning</SectionLabel>
      <section className="split-grid">

        <div className="card">
          <div className="card-header">
            <h3>Outstanding POA&amp;Ms</h3>
            <span>{poams.open || 0} open records</span>
          </div>
          <div className="card-body">
            <div className="data-list">
              {(poams.items || []).length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">✅</div>
                  <p>No open POA&Ms.</p>
                </div>
              ) : (poams.items || []).map(item => (
                <div key={item.id} className="data-row">
                  <div className="data-row-main">
                    <strong>{item.title}</strong>
                    <p>{item.siteId || 'No site'} · {item.severity || 'Unknown severity'}</p>
                  </div>
                  <div className="data-row-meta">
                    <span className={`badge ${statusBadge(item.status)}`}>{item.status}</span>
                    {item.dueDate && <small>Due {fmtDate(item.dueDate)}</small>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card">
            <div className="card-header">
              <h3>Installation &amp; Provisioning</h3>
              <span>LAVA + shared asset telemetry</span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <ProgressBar
                label="Hardware installation"
                value={delivery.hardwareInstalled || 0}
                max={delivery.totalHardware || 0}
                tone={delivery.hardwareProgress >= 80 ? 'green' : delivery.hardwareProgress >= 50 ? 'amber' : 'red'}
              />
              {delivery.softwareFulfillment != null && (
                <ProgressBar
                  label="Software fulfillment"
                  value={delivery.softwareFulfillment || 0}
                  max={100}
                  tone="teal"
                />
              )}
              <div className="data-list" style={{ marginTop: '0.25rem' }}>
                {delivery.systemRequestsPending != null && (
                  <div className="data-row">
                    <div className="data-row-main"><strong>System Requests Pending</strong></div>
                    <div className="data-row-meta"><strong>{delivery.systemRequestsPending}</strong></div>
                  </div>
                )}
                {delivery.provisionedAssets != null && (
                  <div className="data-row">
                    <div className="data-row-main"><strong>Provisioned Assets</strong></div>
                    <div className="data-row-meta"><strong>{delivery.provisionedAssets}</strong></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Workforce Readiness</h3>
              <span>User directory</span>
            </div>
            <div className="card-body">
              <div className="stat-grid-3">
                <div className="stat-cell">
                  <label>Disabled</label>
                  <strong>{users.disabled || 0}</strong>
                  <span>accounts</span>
                </div>
                <div className="stat-cell">
                  <label>Overdue</label>
                  <strong style={{ color: users.overdueTraining > 0 ? 'var(--red-val)' : undefined }}>
                    {users.overdueTraining || 0}
                  </strong>
                  <span>training</span>
                </div>
                <div className="stat-cell">
                  <label>Due Soon</label>
                  <strong style={{ color: users.dueSoonTraining > 0 ? 'var(--amber-val)' : undefined }}>
                    {users.dueSoonTraining || 0}
                  </strong>
                  <span>within 30 days</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security events — shown only when data exists */}
      {(secEvents.total > 0 || secEvents.open > 0) && (
        <>
          <SectionLabel>Security Events</SectionLabel>
          <section className="split-grid">
            <div className="card">
              <div className="card-header">
                <h3>Security Events</h3>
                <span>{secEvents.open || 0} open · {secEvents.total || 0} total</span>
              </div>
              <div className="card-body">
                <div className="posture-strip" style={{ marginBottom: '1rem' }}>
                  <div className="posture-cell tone-watch">
                    <label>Open</label>
                    <strong>{secEvents.open || 0}</strong>
                  </div>
                  <div className="posture-divider" />
                  <div className="posture-cell tone-risk">
                    <label>Critical / High</label>
                    <strong>{secEvents.criticalHigh || 0}</strong>
                  </div>
                  <div className="posture-divider" />
                  <div className="posture-cell tone-blue">
                    <label>Total Tracked</label>
                    <strong>{secEvents.total || 0}</strong>
                  </div>
                </div>
                <div className="data-list">
                  {(secEvents.recent || []).length === 0 ? (
                    <p className="empty-inline">No recent security events.</p>
                  ) : (secEvents.recent || []).map(e => (
                    <div key={e.id} className="data-row">
                      <div className="data-row-main">
                        <strong>{e.type || 'Security Event'}</strong>
                        <p>{e.siteId || 'No site'}</p>
                      </div>
                      <div className="data-row-meta">
                        {e.severity && <span className={`badge ${statusBadge(e.severity)}`}>{e.severity}</span>}
                        <span className={`badge ${statusBadge(e.status)}`}>{e.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {eventSegments.length > 0 && (
              <div className="card">
                <div className="card-header"><h3>Event Severity Distribution</h3></div>
                <div className="card-body">
                  <div className="donut-wrap">
                    <DonutChart
                      segments={eventSegments}
                      size={110}
                      strokeWidth={18}
                      centerValue={String(secEvents.total || 0)}
                      centerLabel="events"
                    />
                    <div className="donut-legend">
                      {eventSegments.map(seg => (
                        <div key={seg.label} className="legend-item">
                          <div className="legend-dot" style={{ background: seg.color }} />
                          <span>{seg.label}</span>
                          <span className="legend-value">{seg.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
