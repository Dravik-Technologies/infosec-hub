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
  Active: '#15803d',
  Authorized: '#15803d',
  Pending: '#d97706',
  'In Progress': '#1d4ed8',
  Expired: '#dc2626',
  Planned: '#0f766e',
};

const SEV_COLORS = {
  CRITICAL: '#991b1b',
  HIGH: '#dc2626',
  MEDIUM: '#d97706',
  LOW: '#15803d',
  Critical: '#991b1b',
  High: '#dc2626',
  Medium: '#d97706',
  Low: '#15803d',
};

export default function ProgramCyberPage({ data }) {
  if (!data || data._error) {
    const msg = data?._error || 'Cyber rollup unavailable.';
    return (
      <div className="page-shell">
        <div className="page-header">
          <div className="page-header-left">
            <h1>IT &amp; Cybersecurity</h1>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            Cyber rollup data is currently unavailable. {msg !== 'Cyber rollup unavailable.' && `Reason: ${msg}`}
          </div>
        </div>
      </div>
    );
  }

  const ato = data?.ato || {};
  const poams = data?.poams || {};
  const users = data?.users || {};
  const delivery = data?.delivery || {};
  const secEvents = data?.securityEvents || {};

  const generatedAt = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null;

  const atoSegments = Object.entries(ato.byStatus || {}).map(([key, value]) => ({
    label: key,
    value,
    color: ATO_COLORS[key] || '#94a3b8',
  }));

  const poamSegments = Object.entries(poams.bySeverity || {}).map(([key, value]) => ({
    label: key,
    value,
    color: SEV_COLORS[key] || '#94a3b8',
  }));

  const eventSegments = Object.entries(secEvents.bySeverity || {})
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ label: key, value, color: SEV_COLORS[key] || '#94a3b8' }));

  return (
    <div className="page-shell">

      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>IT &amp; Cybersecurity</h1>
          <p>Executive rollup — SCORVA remains the operational owner of cyber workflows.</p>
        </div>
        {generatedAt && <span className="page-badge gray">Updated {generatedAt}</span>}
      </div>

      {/* KPI strip */}
      <section className="kpi-strip">
        <MetricCard label="ATO Packages" value={ato.total || 0} hint={ato.expiringSoon ? `${ato.expiringSoon} expiring soon` : 'portfolio total'} />
        <MetricCard label="Open POA&Ms" value={poams.open || 0} hint={`${poams.bySeverity?.HIGH || poams.bySeverity?.High || 0} high severity`} tone={poams.open > 8 ? 'watch' : poams.open > 0 ? 'default' : 'good'} />
        <MetricCard label="Active Users" value={users.active || 0} hint={users.pendingRequests ? `${users.pendingRequests} pending SAARs` : 'in directory'} />
        <MetricCard
          label="Hardware Ready"
          value={delivery.hardwareProgress || 0}
          suffix="%"
          hint={`${delivery.hardwareInstalled || 0} of ${delivery.totalHardware || 0} workstations`}
          tone={delivery.hardwareProgress >= 80 ? 'good' : delivery.hardwareProgress >= 50 ? 'watch' : 'risk'}
        />
        {secEvents.criticalHigh > 0 && (
          <MetricCard label="Critical/High Events" value={secEvents.criticalHigh} hint={`${secEvents.open || 0} open events`} tone="risk" />
        )}
      </section>

      {/* ATO status + POAM breakdown */}
      <section className="split-grid-wide">

        {/* ATO systems */}
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
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            )}

            <div className="data-list">
              {(ato.systems || []).length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: 0 }}>No ATO packages available.</p>
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

        {/* Donuts column */}
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

      {/* POAM items + Installation + Workforce */}
      <section className="split-grid">

        {/* POAM items */}
        <div className="card">
          <div className="card-header">
            <h3>Outstanding POA&amp;Ms</h3>
            <span>{poams.open || 0} open records</span>
          </div>
          <div className="card-body">
            <div className="data-list">
              {(poams.items || []).length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: 0 }}>No open POA&Ms.</p>
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

        {/* Installation + Workforce */}
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

      {/* Security Events — shown only when data exists */}
      {(secEvents.total > 0 || secEvents.open > 0) && (
        <section className="split-grid">

          <div className="card">
            <div className="card-header">
              <h3>Security Events</h3>
              <span>{secEvents.open || 0} open · {secEvents.total || 0} total</span>
            </div>
            <div className="card-body">
              <div className="stat-grid-3" style={{ marginBottom: '1rem' }}>
                <div className="stat-cell">
                  <label>Open Events</label>
                  <strong style={{ color: secEvents.open > 0 ? 'var(--amber-val)' : undefined }}>
                    {secEvents.open || 0}
                  </strong>
                </div>
                <div className="stat-cell">
                  <label>Critical / High</label>
                  <strong style={{ color: secEvents.criticalHigh > 0 ? 'var(--red-val)' : undefined }}>
                    {secEvents.criticalHigh || 0}
                  </strong>
                </div>
                <div className="stat-cell">
                  <label>Total Tracked</label>
                  <strong>{secEvents.total || 0}</strong>
                </div>
              </div>

              <div className="data-list">
                {(secEvents.recent || []).length === 0 ? (
                  <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: 0 }}>No recent security events.</p>
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
      )}
    </div>
  );
}
