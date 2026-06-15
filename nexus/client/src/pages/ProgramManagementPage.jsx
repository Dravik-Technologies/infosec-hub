import MetricCard from '../components/MetricCard.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import LineChart from '../components/LineChart.jsx';
import BarChart from '../components/BarChart.jsx';
import PieChart from '../components/PieChart.jsx';
import TimelineGantt from '../components/TimelineGantt.jsx';
import Calendar from '../components/Calendar.jsx';
import { fmtDate, pctClass } from '../app.js';

function statusBadge(status) {
  const s = (status || '').toLowerCase();
  if (/complete|active|approved|on.track/.test(s)) return 'badge-green';
  if (/critical|expired|overdue|risk|failed/.test(s)) return 'badge-red';
  if (/pending|review|in.progress|scheduled|planned|upcoming|watch|guarded/.test(s)) return 'badge-amber';
  if (/submitted|processing/.test(s)) return 'badge-blue';
  return 'badge-gray';
}

function scheduleColor(schedule) {
  const s = (schedule || '').toLowerCase();
  if (/on.track|ahead/.test(s)) return 'green';
  if (/at.risk|watch/.test(s)) return 'amber';
  if (/delayed|behind/.test(s)) return 'red';
  return 'blue';
}

function milestoneDotClass(status) {
  const s = (status || '').toLowerCase();
  if (/complete|active|approved/.test(s)) return 'dot-green';
  if (/critical|overdue|risk|behind/.test(s)) return 'dot-red';
  if (/watch|pending|upcoming|slipped/.test(s)) return 'dot-amber';
  return '';
}

function priorityBadge(priority) {
  const p = (priority || '').toLowerCase();
  if (/critical|high/.test(p)) return 'badge-red';
  if (/medium|watch/.test(p)) return 'badge-amber';
  if (/low/.test(p)) return 'badge-blue';
  return 'badge-gray';
}

export default function ProgramManagementPage({ data, trend }) {
  const portfolio     = data?.portfolio     || {};
  const kpis          = portfolio.kpis      || [];
  const realEstate    = data?.realEstate    || [];
  const construction  = data?.construction  || [];
  const accreditations = data?.accreditations || [];
  const milestones    = data?.milestones    || [];
  const risks         = data?.risks         || [];
  const executiveActions = data?.executiveActions || [];

  const fy = String(portfolio.fiscalYear || '26').replace('FY', '');
  const budgetM = portfolio.budgetRemaining
    ? `$${Math.round(portfolio.budgetRemaining / 100000) / 10}M`
    : null;
  const openRisks = risks.filter(item => !['closed', 'accepted'].includes(String(item.status || '').toLowerCase()));
  const highPriorityActions = executiveActions.filter(item =>
    !['closed', 'complete', 'completed'].includes(String(item.status || '').toLowerCase())
    && ['critical', 'high'].includes(String(item.priority || '').toLowerCase())
  );

  const hasData = kpis.length > 0 || construction.length > 0 || accreditations.length > 0 || realEstate.length > 0 || milestones.length > 0 || risks.length > 0 || executiveActions.length > 0;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Program Management</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {budgetM && <span className="page-badge gray">{budgetM}</span>}
          <span className="page-badge">FY{fy}</span>
        </div>
      </div>

      {/* KPI strip */}
      <section className="kpi-strip">
        {kpis.map(item => (
          <MetricCard
            key={item.id}
            label={item.label}
            value={item.value}
            suffix={item.suffix}
            hint={item.trend}
            tone={item.id === 'budget-health' ? pctClass(item.value) : 'default'}
            trend={item.id === 'budget-health' ? trend?.program?.budgetHealth : null}
          />
        ))}
        {budgetM && kpis.length === 0 && (
          <MetricCard label="Budget Remaining" value={budgetM} hint={`FY${fy} authority`} tone="blue" />
        )}
      </section>

      {hasData && (
        <div className="ops-summary-strip">
          <div className="ops-summary-cell">
            <label>Construction</label>
            <strong>{construction.length}</strong>
          </div>
          <div className="ops-summary-cell">
            <label>Accreditations</label>
            <strong>{accreditations.length}</strong>
          </div>
          <div className="ops-summary-cell">
            <label>Real Estate</label>
            <strong>{realEstate.length}</strong>
          </div>
          <div className="ops-summary-cell">
            <label>Milestones</label>
            <strong>{milestones.length}</strong>
          </div>
          <div className="ops-summary-cell">
            <label>Open Risks</label>
            <strong>{openRisks.length}</strong>
          </div>
          <div className="ops-summary-cell">
            <label>Exec Actions</label>
            <strong>{executiveActions.length}</strong>
          </div>
        </div>
      )}

      {/* Empty state when no data is loaded yet */}
      {!hasData && (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <p>No portfolio data loaded.</p>
              <p style={{ fontSize: '0.78rem', opacity: 0.7 }}>
                Open the Admin console to add program data, risks, and executive actions.
              </p>
            </div>
          </div>
        </div>
      )}

      {(openRisks.length > 0 || executiveActions.length > 0) && (
        <section className="split-grid">
          <div className="card">
            <div className="card-header">
              <h3>Open Risks</h3>
              <span>{openRisks.length} active</span>
            </div>
            <div className="card-body">
              {openRisks.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">⚠️</div>
                  <p>No open risks tracked.</p>
                </div>
              ) : (
                <div className="data-list">
                  {openRisks.map(item => (
                    <div key={item.id} className="data-row">
                      <div className="data-row-main">
                        <strong>{item.title}</strong>
                        <p>{item.source || 'General'}{item.owner ? ` · ${item.owner}` : ''}</p>
                      </div>
                      <div className="data-row-meta">
                        {item.severity && <span className={`badge ${priorityBadge(item.severity)}`}>{item.severity}</span>}
                        <small>{fmtDate(item.dueDate)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Executive Actions</h3>
              <span>{highPriorityActions.length} high priority</span>
            </div>
            <div className="card-body">
              {executiveActions.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🧭</div>
                  <p>No executive actions tracked.</p>
                </div>
              ) : (
                <div className="timeline-list">
                  {executiveActions.map(item => (
                    <div key={item.id} className="timeline-row">
                      <div className={`timeline-dot ${['critical', 'high'].includes(String(item.priority || '').toLowerCase()) ? 'dot-red' : ['medium'].includes(String(item.priority || '').toLowerCase()) ? 'dot-amber' : ''}`} />
                      <div className="timeline-row-main">
                        <strong>{item.title}</strong>
                        <p>{item.owner}{item.linkedTo ? ` · ${item.linkedTo}` : ''}</p>
                      </div>
                      <div className="data-row-meta">
                        {item.status && <span className={`badge ${statusBadge(item.status)}`}>{item.status}</span>}
                        <small>{fmtDate(item.dueDate)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Construction + Accreditations */}
      {(construction.length > 0 || accreditations.length > 0) && (
        <section className="split-grid-wide">

          {/* Construction portfolio */}
          <div className="card">
            <div className="card-header">
              <h3>Construction &amp; Renovation Portfolio</h3>
              <span>{construction.length} active workstreams</span>
            </div>
            <div className="card-body">
              {construction.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🏗</div>
                  <p>No active construction workstreams.</p>
                </div>
              ) : (
                <div className="card-grid-3">
                  {construction.map(project => {
                    const tone = scheduleColor(project.schedule);
                    return (
                      <div key={project.id} className="project-card">
                        <div className="project-card-top">
                          <div>
                            <h4>{project.name}</h4>
                            <p>{project.type}</p>
                          </div>
                          <span className={`badge badge-${tone === 'green' ? 'green' : tone === 'amber' ? 'amber' : tone === 'red' ? 'red' : 'blue'}`}>
                            {project.schedule}
                          </span>
                        </div>
                        {project.accreditation && (
                          <p style={{ marginBottom: '0.1rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
                            {project.accreditation}
                          </p>
                        )}
                        <ProgressBar
                          value={project.progress || 0}
                          max={100}
                          tone={tone}
                        />
                        <div className="project-card-foot">
                          <span>{project.progress || 0}% complete</span>
                          {project.budget > 0 && (
                            <strong>${Math.round(project.budget / 1000)}K</strong>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Accreditation queue */}
          <div className="card">
            <div className="card-header">
              <h3>Accreditation Queue</h3>
              <span>Secret / SCIF / SAPF</span>
            </div>
            <div className="card-body">
              {accreditations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🔐</div>
                  <p>No accreditations tracked.</p>
                </div>
              ) : (
                <div className="data-list">
                  {accreditations.map(item => (
                    <div key={item.id} className="data-row">
                      <div className="data-row-main">
                        <strong>{item.name}</strong>
                        <p>{item.level}</p>
                      </div>
                      <div className="data-row-meta">
                        <span className={`badge ${statusBadge(item.status)}`}>{item.status}</span>
                        <small>{fmtDate(item.targetDate)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Construction Progress Chart */}
      {construction.length > 1 && (
        <div className="card">
          <div className="card-header">
            <h3>Construction Progress Comparison</h3>
            <span>Active projects by completion</span>
          </div>
          <div className="card-body" style={{ minHeight: 320 }}>
            <BarChart
              data={construction.map(p => ({ name: p.name.slice(0, 12), value: p.progress || 0 }))}
              dataKey="value"
              label="% Complete"
              colors={['#0f766e']}
              height={300}
            />
          </div>
        </div>
      )}

      {/* Risk Severity Distribution */}
      {openRisks.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Risk Severity Breakdown</h3>
            <span>{openRisks.length} active risks</span>
          </div>
          <div className="card-body" style={{ minHeight: 340 }}>
            <PieChart
              data={(() => {
                const severityMap = {};
                openRisks.forEach(risk => {
                  const sev = risk.severity || 'Medium';
                  severityMap[sev] = (severityMap[sev] || 0) + 1;
                });
                return Object.entries(severityMap).map(([name, value]) => ({ name, value }));
              })()}
              label="Risks"
              height={320}
            />
          </div>
        </div>
      )}

      {/* Real Estate + Milestones */}
      {(realEstate.length > 0 || milestones.length > 0) && (
        <section className="split-grid">

          <div className="card">
            <div className="card-header">
              <h3>Real Estate Actions</h3>
              <span>{realEstate.length} tracked</span>
            </div>
            <div className="card-body">
              {realEstate.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🏙</div>
                  <p>No real estate actions tracked.</p>
                </div>
              ) : (
                <div className="data-list">
                  {realEstate.map(item => (
                    <div key={item.id} className="data-row">
                      <div className="data-row-main">
                        <strong>{item.site}</strong>
                        <p>{item.type}</p>
                      </div>
                      <div className="data-row-meta">
                        <span className={`badge ${statusBadge(item.status)}`}>{item.status}</span>
                        <small>{fmtDate(item.dueDate)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Milestones &amp; Schedule Watch</h3>
              <span>{milestones.length} upcoming</span>
            </div>
            <div className="card-body">
              {milestones.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📅</div>
                  <p>No milestones scheduled.</p>
                </div>
              ) : (
                <div style={{ minHeight: 300 }}>
                  <TimelineGantt items={milestones} />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Milestone Calendar */}
      {milestones.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Milestone Calendar</h3>
            <span>Track upcoming dates</span>
          </div>
          <div className="card-body">
            <Calendar events={milestones} />
          </div>
        </div>
      )}
    </div>
  );
}
