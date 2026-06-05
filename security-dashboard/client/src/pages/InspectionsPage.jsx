import { useState, useEffect } from 'react';
import { WS, fmtDate, statusBadge, sevBadge } from '../app.js';

function ProgressBar({ value = 0 }) {
  const tone = value >= 80 ? 'green' : value >= 50 ? 'amber' : 'red';
  return (
    <div className="ws-prog-wrap" style={{ minWidth: 100 }}>
      <div className="ws-prog-header">
        <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>Progress</span>
        <span style={{ fontWeight: 600, fontSize: '0.72rem' }}>{value}%</span>
      </div>
      <div className="ws-prog-track">
        <div className={`ws-prog-fill ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function InspectionCard({ insp, findings, onSelect }) {
  const relatedFindings = findings.filter(f => f.inspectionId === insp.id);
  const openFindings = relatedFindings.filter(f => f.status !== 'Closed');

  return (
    <div className="ws-card" style={{ cursor: 'pointer' }} onClick={() => onSelect(insp)}>
      <div className="ws-card-header">
        <div>
          <h3>{insp.title}</h3>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
            {insp.inspector} · Due {fmtDate(insp.dueDate)}
          </div>
        </div>
        <span className={`badge ${statusBadge(insp.status)}`}>{insp.status}</span>
      </div>
      <div className="ws-card-body">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <ProgressBar value={insp.progress || 0} />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ background: 'var(--bg-alt)', borderRadius: '0.375rem', padding: '0.4rem 0.65rem', fontSize: '0.75rem' }}>
              <div style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scope</div>
              <div style={{ fontWeight: 600 }}>{(insp.scope || []).length} areas</div>
            </div>
            <div style={{ background: 'var(--bg-alt)', borderRadius: '0.375rem', padding: '0.4rem 0.65rem', fontSize: '0.75rem' }}>
              <div style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Findings</div>
              <div style={{ fontWeight: 600, color: openFindings.length > 0 ? 'var(--red-val)' : 'var(--green)' }}>
                {openFindings.length} open / {relatedFindings.length} total
              </div>
            </div>
            <div style={{ background: 'var(--bg-alt)', borderRadius: '0.375rem', padding: '0.4rem 0.65rem', fontSize: '0.75rem' }}>
              <div style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Evidence</div>
              <div style={{ fontWeight: 600 }}>{(insp.evidence || []).length} items</div>
            </div>
            <div style={{ background: 'var(--bg-alt)', borderRadius: '0.375rem', padding: '0.4rem 0.65rem', fontSize: '0.75rem' }}>
              <div style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>KMP Briefed</div>
              <div style={{ fontWeight: 600 }}>
                {insp.kmaBriefed ? <span className="badge badge-green">Yes</span> : <span className="badge badge-gray">No</span>}
              </div>
            </div>
          </div>
        </div>

        {insp.notes && (
          <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-2)', background: 'var(--bg-alt)', borderRadius: '0.375rem', padding: '0.5rem 0.65rem' }}>
            {insp.notes}
          </div>
        )}

        {insp.scope && insp.scope.length > 0 && (
          <div style={{ marginTop: '0.65rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            {insp.scope.map((s, i) => (
              <span key={i} className="badge badge-gray">{s}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FindingsTable({ findings, filter }) {
  const filtered = filter === 'all' ? findings : findings.filter(f => filter === 'open' ? f.status !== 'Closed' : f.status === 'Closed');
  return (
    <div className="ws-table-wrap">
      <table className="ws-table">
        <thead>
          <tr>
            <th>Finding #</th>
            <th>Area / Requirement</th>
            <th>Finding</th>
            <th>Severity</th>
            <th>Owner</th>
            <th>Due Date</th>
            <th>Corrective Action</th>
            <th>Evidence</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan={9}><div className="ws-empty">No findings in this view.</div></td></tr>
          ) : filtered.map(f => (
            <tr key={f.id}>
              <td><strong>{f.findingNumber}</strong></td>
              <td>
                <strong style={{ display: 'block' }}>{f.area}</strong>
                <div className="cell-muted" style={{ maxWidth: 200, whiteSpace: 'normal', lineHeight: '1.3' }}>{f.requirement}</div>
              </td>
              <td style={{ maxWidth: 240, whiteSpace: 'normal', lineHeight: '1.3', fontSize: '0.78rem', color: 'var(--text-2)' }}>{f.finding}</td>
              <td><span className={`badge ${sevBadge(f.severity)}`}>{f.severity}</span></td>
              <td className="cell-muted">{f.owner}</td>
              <td className="cell-muted">{fmtDate(f.dueDate)}</td>
              <td style={{ maxWidth: 200, whiteSpace: 'normal', lineHeight: '1.3', fontSize: '0.75rem', color: 'var(--text-2)' }}>{f.corrective || '—'}</td>
              <td>
                {(f.evidence || []).length > 0 ? (
                  <span className="badge badge-blue">{f.evidence.length} item{f.evidence.length !== 1 ? 's' : ''}</span>
                ) : (
                  <span className="badge badge-gray">None</span>
                )}
              </td>
              <td><span className={`badge ${statusBadge(f.status)}`}>{f.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function InspectionsPage({ siteId }) {
  const [inspections, setInspections] = useState([]);
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [tab, setTab] = useState('campaigns');
  const [findFilter, setFindFilter] = useState('open');
  const [selectedInspection, setSelectedInspection] = useState(null);

  function load() {
    setLoading(true);
    setLoadError(null);
    const params = siteId ? { siteId } : {};
    Promise.all([
      WS.get('self_inspection_ops', params),
      WS.get('security_findings', params),
    ]).then(([insp, find]) => {
      const firstErr = insp?._wsError ? insp : find?._wsError ? find : null;
      if (firstErr) { setLoadError(firstErr.message); setLoading(false); return; }
      setInspections(Array.isArray(insp) ? insp : []);
      setFindings(Array.isArray(find) ? find : []);
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, [siteId]);

  const openFindings = findings.filter(f => f.status !== 'Closed');
  const highFindings = openFindings.filter(f => f.severity === 'High');
  const inProgressInsp = inspections.filter(i => i.status === 'In Progress').length;

  if (loading) return <div className="ws-empty">Loading inspection data…</div>;
  if (loadError) return <div className="ws-empty">Failed to load inspection data: {loadError}</div>;

  return (
    <div className="ws-page">
      <div className="ws-page-header">
        <div>
          <div className="ws-page-title">Self-Inspection &amp; Compliance Operations</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {highFindings.length > 0 && <span className="ws-count-badge" style={{ background: 'var(--red-bg)', color: 'var(--red)', borderColor: 'var(--red-border)' }}>{highFindings.length} high findings</span>}
          {openFindings.length > 0 && <span className="ws-count-badge" style={{ background: 'var(--amber-bg)', color: 'var(--amber)', borderColor: 'var(--amber-border)' }}>{openFindings.length} open findings</span>}
          <span className="ws-count-badge">{inProgressInsp} in progress</span>
        </div>
      </div>

      {/* Tab selector */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'campaigns', label: `Inspection Campaigns (${inspections.length})` },
          { id: 'findings', label: `Findings (${findings.length})` },
        ].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: '0.55rem 1rem', border: 'none', background: 'transparent',
              font: '500 0.82rem Inter, sans-serif', cursor: 'pointer',
              color: tab === t.id ? 'var(--primary)' : 'var(--muted)',
              borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'campaigns' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {inspections.length === 0 ? (
            <div className="ws-empty">No inspection campaigns found.</div>
          ) : (
            inspections.map(insp => (
              <InspectionCard key={insp.id} insp={insp} findings={findings} onSelect={setSelectedInspection} />
            ))
          )}
        </div>
      )}

      {tab === 'findings' && (
        <div className="ws-card">
          <div className="ws-card-header">
            <h3>Findings Register</h3>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {['all', 'open', 'closed'].map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFindFilter(f)}
                  style={{
                    padding: '0.25rem 0.6rem', border: '1px solid var(--border)',
                    borderRadius: '0.375rem', background: findFilter === f ? 'var(--primary-bg)' : 'white',
                    color: findFilter === f ? 'var(--primary)' : 'var(--muted)',
                    font: '600 0.72rem Inter, sans-serif', cursor: 'pointer',
                  }}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="ws-card-body" style={{ padding: 0 }}>
            <FindingsTable findings={findings} filter={findFilter} />
          </div>
        </div>
      )}
    </div>
  );
}
