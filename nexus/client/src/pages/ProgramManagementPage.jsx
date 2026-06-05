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

function milestoneDotClass(status) {
  const s = (status || '').toLowerCase();
  if (/complete|active|approved/.test(s)) return 'dot-green';
  if (/critical|overdue|risk|behind/.test(s)) return 'dot-red';
  if (/watch|pending|upcoming|slipped/.test(s)) return 'dot-amber';
  return '';
}

export default function ProgramManagementPage({ data }) {
  const portfolio     = data?.portfolio     || {};
  const kpis          = portfolio.kpis      || [];
  const realEstate    = data?.realEstate    || [];
  const construction  = data?.construction  || [];
  const accreditations = data?.accreditations || [];
  const milestones    = data?.milestones    || [];

  const fy = String(portfolio.fiscalYear || '26').replace('FY', '');
  const budgetM = portfolio.budgetRemaining
    ? `$${Math.round(portfolio.budgetRemaining / 100000) / 10}M`
    : null;

  const hasData = kpis.length > 0 || construction.length > 0 || accreditations.length > 0 || realEstate.length > 0 || milestones.length > 0;

  return (
    <div className="page-shell">
      <section className="ops-hero">
        <div className="ops-hero-main">
          <div className="ops-hero-kicker">Portfolio operating picture</div>
          <div className="ops-hero-title">Capital execution, accreditations, and milestone pressure in one command view.</div>
          <div className="ops-hero-copy">
            Surface the portfolio signals that matter first, then drop into the workstreams, actions, and schedule friction underneath.
          </div>
        </div>
        <div className="ops-hero-side">
          <div className="signal-mini">
            <label>Budget remaining</label>
            <strong>{budgetM || '—'}</strong>
            <span>FY{fy} authority</span>
          </div>
          <div className="signal-mini">
            <label>Tracked workstreams</label>
            <strong>{construction.length + accreditations.length + milestones.length}</strong>
            <span>{construction.length} build · {milestones.length} milestones</span>
          </div>
        </div>
      </section>

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
                Open the Admin console to add construction projects, accreditations, real estate actions, and milestones.
              </p>
            </div>
          </div>
        </div>
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
                <div className="timeline-list">
                  {milestones.map(item => (
                    <div key={item.id} className="timeline-row">
                      <div className={`timeline-dot ${milestoneDotClass(item.status)}`} />
                      <div className="timeline-row-main">
                        <strong>{item.title}</strong>
                        <p>{fmtDate(item.date)}</p>
                      </div>
                      <span className={`badge ${statusBadge(item.status)}`}>{item.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
