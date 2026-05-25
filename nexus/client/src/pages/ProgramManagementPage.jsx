import MetricCard from '../components/MetricCard.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
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

export default function ProgramManagementPage({ data }) {
  const portfolio = data?.portfolio || {};
  const kpis = portfolio.kpis || [];
  const realEstate = data?.realEstate || [];
  const construction = data?.construction || [];
  const accreditations = data?.accreditations || [];
  const milestones = data?.milestones || [];

  const fy = String(portfolio.fiscalYear || '26').replace('FY', '');
  const budgetM = portfolio.budgetRemaining
    ? `$${Math.round(portfolio.budgetRemaining / 100000) / 10}M`
    : null;

  return (
    <div className="page-shell">

      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Program Management</h1>
          <p>Real estate, construction, accreditations, and milestone health across the portfolio.</p>
        </div>
        <span className="page-badge">FY{fy}</span>
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
          />
        ))}
        {budgetM && kpis.length === 0 && (
          <MetricCard label="Budget Remaining" value={budgetM} hint={`FY${fy} authority`} tone="blue" />
        )}
      </section>

      {/* Construction + Accreditations */}
      <section className="split-grid-wide">

        {/* Construction portfolio */}
        <div className="card">
          <div className="card-header">
            <h3>Construction &amp; Renovation Portfolio</h3>
            <span>{construction.length} active workstreams</span>
          </div>
          <div className="card-body">
            {construction.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: 0 }}>No active construction workstreams.</p>
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
                        <p style={{ marginBottom: '0.1rem' }}>{project.accreditation}</p>
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
            <div className="data-list">
              {accreditations.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: 0 }}>No accreditations tracked.</p>
              ) : accreditations.map(item => (
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
          </div>
        </div>
      </section>

      {/* Real Estate + Milestones */}
      <section className="split-grid">

        {/* Real estate */}
        <div className="card">
          <div className="card-header">
            <h3>Real Estate Actions</h3>
            <span>{realEstate.length} tracked</span>
          </div>
          <div className="card-body">
            <div className="data-list">
              {realEstate.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: 0 }}>No real estate actions tracked.</p>
              ) : realEstate.map(item => (
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
          </div>
        </div>

        {/* Milestones */}
        <div className="card">
          <div className="card-header">
            <h3>Milestones &amp; Schedule Watch</h3>
            <span>{milestones.length} upcoming</span>
          </div>
          <div className="card-body">
            <div className="timeline-list">
              {milestones.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: 0 }}>No milestones scheduled.</p>
              ) : milestones.map(item => (
                <div key={item.id} className="timeline-row">
                  <div className="timeline-dot" />
                  <div className="timeline-row-main">
                    <strong>{item.title}</strong>
                    <p>{fmtDate(item.date)}</p>
                  </div>
                  <span className={`badge ${statusBadge(item.status)}`}>{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
