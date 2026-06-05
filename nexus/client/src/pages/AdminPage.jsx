import { useEffect, useRef, useState } from 'react';
import { API, fmtDate } from '../app.js';

// ── Shared helpers ─────────────────────────────────────────────────────────────

function statusBadge(status) {
  const s = (status || '').toLowerCase();
  if (/complete|active|approved|on.track|authorized/.test(s)) return 'badge-green';
  if (/critical|expired|overdue|risk|failed/.test(s)) return 'badge-red';
  if (/pending|review|in.progress|scheduled|planned|upcoming|watch|guarded/.test(s)) return 'badge-amber';
  if (/submitted|processing/.test(s)) return 'badge-blue';
  return 'badge-gray';
}

function AdminMsg({ msg }) {
  if (!msg) return null;
  const isErr = msg.startsWith('Error');
  return (
    <div style={{
      margin: '0.5rem 0',
      padding: '0.4rem 0.75rem',
      borderRadius: '0.375rem',
      fontSize: '0.78rem',
      background: isErr ? 'var(--red-bg, #fef2f2)' : 'var(--green-bg, #f0fdf4)',
      color: isErr ? 'var(--red, #dc2626)' : 'var(--green, #16a34a)',
      border: `1px solid ${isErr ? 'var(--red-border, #fca5a5)' : 'var(--green-border, #86efac)'}`,
    }}>
      {msg}
    </div>
  );
}

function ScoreCell({ label, value, tone = 'default' }) {
  const color = tone === 'good'
    ? 'var(--green)'
    : tone === 'watch'
      ? 'var(--amber-val)'
      : tone === 'risk'
        ? 'var(--red-val)'
        : 'var(--text)';
  return (
    <div style={{
      padding: '0.8rem 0.9rem',
      borderRadius: '0.7rem',
      border: '1px solid var(--border)',
      background: 'var(--bg-alt)',
    }}>
      <div style={{ font: '600 0.64rem \"IBM Plex Sans\", sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>
        {label}
      </div>
      <div style={{ marginTop: '0.2rem', font: '700 1.45rem \"IBM Plex Sans\", sans-serif', color }}>
        {value ?? '—'}
      </div>
    </div>
  );
}

function SnapshotPanel({ trend, onRefresh }) {
  const [msg, setMsg] = useState('');
  const [running, setRunning] = useState(false);
  const baseline = trend?.baselineAt ? new Date(trend.baselineAt).toLocaleString('en-US') : null;
  const scores = {
    program: trend?.program?.programScore?.current ?? null,
    security: trend?.security?.securityScore?.current ?? null,
    cyber: trend?.cyber?.cyberScore?.current ?? null,
  };

  function toneForScore(value) {
    if (value == null) return 'default';
    if (value >= 85) return 'good';
    if (value >= 70) return 'watch';
    return 'risk';
  }

  async function generateSnapshot() {
    setRunning(true);
    setMsg('');
    const result = await API.post('admin/snapshot', {});
    setRunning(false);
    if (!result || result._apiError) {
      setMsg(`Error: ${result?.message || 'Network error — snapshot not generated'}`);
      return;
    }
    setMsg(`Snapshot generated for ${result.created}/${result.scopeCount} scope${result.scopeCount === 1 ? '' : 's'}.`);
    onRefresh();
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>Rollup Snapshots</h3>
        <button type="button" style={btnStyle('primary')} onClick={generateSnapshot} disabled={running}>
          {running ? 'Generating…' : 'Generate Snapshot'}
        </button>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
          <ScoreCell label="Program Score" value={scores.program != null ? `${scores.program}%` : '—'} tone={toneForScore(scores.program)} />
          <ScoreCell label="Security Score" value={scores.security != null ? `${scores.security}%` : '—'} tone={toneForScore(scores.security)} />
          <ScoreCell label="Cyber Score" value={scores.cyber != null ? `${scores.cyber}%` : '—'} tone={toneForScore(scores.cyber)} />
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
          {baseline ? `Current trend baseline: ${baseline}` : 'No prior snapshot baseline yet. Generate the first snapshot to start trend history.'}
        </div>
        <AdminMsg msg={msg} />
      </div>
    </div>
  );
}

function Field({ label, children, required }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
      <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}{required && ' *'}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  padding: '0.35rem 0.6rem',
  border: '1px solid var(--border)',
  borderRadius: '0.375rem',
  fontSize: '0.82rem',
  background: 'var(--field-bg)',
  color: 'var(--text)',
  width: '100%',
  boxSizing: 'border-box',
};

const btnStyle = (variant = 'primary') => ({
  padding: '0.3rem 0.75rem',
  borderRadius: '0.375rem',
  cursor: 'pointer',
  fontSize: '0.78rem',
  fontWeight: 600,
  background: variant === 'primary' ? 'var(--primary)' : variant === 'danger' ? 'var(--red-bg, #fef2f2)' : 'var(--bg-alt)',
  color: variant === 'primary' ? 'var(--text-on-primary)' : variant === 'danger' ? 'var(--red, #dc2626)' : 'var(--text)',
  border: variant === 'primary' ? 'none' : variant === 'danger' ? '1px solid var(--red-border, #fca5a5)' : '1px solid var(--border)',
});

const formGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' };

// ── Tab: Portfolio ─────────────────────────────────────────────────────────────

function PortfolioTab({ portfolio, onChange }) {
  const [form, setForm] = useState({
    name: portfolio.name || '',
    fiscalYear: portfolio.fiscalYear || '',
    budgetTotal: portfolio.budgetTotal ?? '',
    budgetObligated: portfolio.budgetObligated ?? '',
    budgetRemaining: portfolio.budgetRemaining ?? '',
  });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    const payload = {
      ...form,
      budgetTotal: form.budgetTotal === '' ? null : Number(form.budgetTotal),
      budgetObligated: form.budgetObligated === '' ? null : Number(form.budgetObligated),
      budgetRemaining: form.budgetRemaining === '' ? null : Number(form.budgetRemaining),
    };
    const result = await API.put('admin/pm/portfolio', payload);
    setSaving(false);
    if (!result || result._apiError) { setMsg(`Error: ${result?.message || 'Network error — data not saved'}`); return; }
    setMsg('Portfolio saved.');
    onChange();
  }

  return (
    <div className="card">
      <div className="card-header"><h3>Portfolio Summary</h3></div>
      <div className="card-body">
        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={formGrid}>
            <Field label="Portfolio Name">
              <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Fiscal Year">
              <input style={inputStyle} value={form.fiscalYear} placeholder="FY26" onChange={e => setForm(f => ({ ...f, fiscalYear: e.target.value }))} />
            </Field>
            <Field label="Budget Total ($)">
              <input style={inputStyle} type="number" value={form.budgetTotal} onChange={e => setForm(f => ({ ...f, budgetTotal: e.target.value }))} />
            </Field>
            <Field label="Budget Obligated ($)">
              <input style={inputStyle} type="number" value={form.budgetObligated} onChange={e => setForm(f => ({ ...f, budgetObligated: e.target.value }))} />
            </Field>
            <Field label="Budget Remaining ($)">
              <input style={inputStyle} type="number" value={form.budgetRemaining} onChange={e => setForm(f => ({ ...f, budgetRemaining: e.target.value }))} />
            </Field>
          </div>
          <AdminMsg msg={msg} />
          <div>
            <button type="submit" style={btnStyle('primary')} disabled={saving}>
              {saving ? 'Saving…' : 'Save Portfolio'}
            </button>
          </div>
        </form>

        {/* KPI editor */}
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <KpiEditor kpis={portfolio.kpis || []} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}

const BLANK_KPI = { label: '', value: '', suffix: '', trend: '' };

function KpiEditor({ kpis, onChange }) {
  const [editing, setEditing] = useState(null); // null | 'new' | kpi.id
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const formRef = useRef(null);

  useEffect(() => {
    if (editing !== null && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [editing]);

  function startAdd() {
    setEditing('new');
    setForm({ ...BLANK_KPI });
    setMsg('');
  }

  function startEdit(kpi) {
    setEditing(kpi.id);
    setForm({ label: kpi.label || '', value: kpi.value ?? '', suffix: kpi.suffix || '', trend: kpi.trend || '' });
    setMsg('');
  }

  function cancel() {
    setEditing(null);
    setForm({});
    setMsg('');
  }

  async function save(e) {
    e.preventDefault();
    if (!editing) return;
    const id = editing === 'new' ? `kpi-${Date.now()}` : editing;
    const result = await API.put(`admin/pm/kpis/${id}`, {
      ...form,
      value: form.value === '' ? null : Number(form.value),
    });
    if (!result || result._apiError) { setMsg(`Error: ${result?.message || 'Network error — data not saved'}`); return; }
    setMsg(editing === 'new' ? 'KPI added.' : 'KPI saved.');
    setEditing(null);
    onChange();
  }

  async function del(id) {
    const result = await API.del(`admin/pm/kpis/${id}`);
    if (!result || result._apiError) { setMsg(`Error: ${result?.message || 'Network error — KPI not deleted'}`); return; }
    setConfirmDelete(null);
    onChange();
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div style={{ font: '600 0.78rem Inter, sans-serif' }}>KPI Cards</div>
        <button type="button" style={btnStyle('primary')} onClick={startAdd}>+ Add KPI</button>
      </div>
      <AdminMsg msg={msg} />
      {editing !== null && (
        <form ref={formRef} onSubmit={save} style={{ marginBottom: '0.75rem', background: 'var(--bg-alt)', borderRadius: '0.5rem', padding: '0.75rem' }}>
          <div style={{ font: '600 0.78rem Inter, sans-serif', marginBottom: '0.5rem', color: 'var(--muted)' }}>
            {editing === 'new' ? 'New KPI Card' : 'Edit KPI'}
          </div>
          <div style={formGrid}>
            <Field label="Label" required>
              <input style={inputStyle} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} required />
            </Field>
            <Field label="Value">
              <input style={inputStyle} type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
            </Field>
            <Field label="Suffix (e.g. %)">
              <input style={inputStyle} value={form.suffix} onChange={e => setForm(f => ({ ...f, suffix: e.target.value }))} />
            </Field>
            <Field label="Trend note">
              <input style={inputStyle} value={form.trend} onChange={e => setForm(f => ({ ...f, trend: e.target.value }))} />
            </Field>
          </div>
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
            <button type="submit" style={btnStyle('primary')}>{editing === 'new' ? 'Add KPI' : 'Save KPI'}</button>
            <button type="button" style={btnStyle()} onClick={cancel}>Cancel</button>
          </div>
        </form>
      )}
      <div className="data-list">
        {kpis.length === 0 && editing !== 'new' && (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No KPI cards. Click + Add KPI to create one.</p>
        )}
        {kpis.map(kpi => (
          <div key={kpi.id} className="data-row">
            <div className="data-row-main">
              <strong>{kpi.label}</strong>
              <p>{kpi.value}{kpi.suffix}{kpi.trend ? ` — ${kpi.trend}` : ''}</p>
            </div>
            <div className="data-row-meta" style={{ display: 'flex', gap: '0.3rem' }}>
              {confirmDelete === kpi.id ? (
                <>
                  <button type="button" style={btnStyle('danger')} onClick={() => del(kpi.id)}>Confirm</button>
                  <button type="button" style={btnStyle()} onClick={() => setConfirmDelete(null)}>No</button>
                </>
              ) : (
                <>
                  <button type="button" style={btnStyle()} onClick={() => editing === kpi.id ? cancel() : startEdit(kpi)}>
                    {editing === kpi.id ? 'Cancel' : 'Edit'}
                  </button>
                  <button type="button" style={btnStyle('danger')} onClick={() => setConfirmDelete(kpi.id)}>Del</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Generic CRUD section ───────────────────────────────────────────────────────

function CrudSection({ title, section, items, fields, onChange }) {
  const [editing, setEditing] = useState(null); // null = none, 'new' = adding, id = editing
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const formRef = useRef(null);

  useEffect(() => {
    if (editing !== null && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [editing]);

  function blank() {
    return Object.fromEntries(fields.map(f => [f.key, f.defaultValue ?? '']));
  }

  function startAdd() {
    setEditing('new');
    setForm(blank());
    setMsg('');
  }

  function startEdit(item) {
    setEditing(item.id);
    setForm(Object.fromEntries(fields.map(f => [f.key, item[f.key] ?? f.defaultValue ?? ''])));
    setMsg('');
  }

  function cancel() {
    setEditing(null);
    setForm({});
    setMsg('');
  }

  async function save(e) {
    e.preventDefault();
    const payload = {};
    fields.forEach(f => {
      payload[f.key] = f.type === 'number' ? (form[f.key] === '' ? null : Number(form[f.key])) : form[f.key] || null;
    });
    let result;
    if (editing === 'new') {
      result = await API.post(`admin/pm/${section}`, payload);
    } else {
      result = await API.put(`admin/pm/${section}/${editing}`, payload);
    }
    if (!result || result._apiError) { setMsg(`Error: ${result?.message || 'Network error — data not saved'}`); return; }
    setMsg(editing === 'new' ? 'Item added.' : 'Item saved.');
    setEditing(null);
    onChange();
  }

  async function del(id) {
    const result = await API.del(`admin/pm/${section}/${id}`);
    if (!result || result._apiError) { setMsg(`Error: ${result?.message || 'Network error — item not deleted'}`); return; }
    setConfirmDelete(null);
    onChange();
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>{title}</h3>
        <button type="button" style={btnStyle('primary')} onClick={startAdd}>+ Add</button>
      </div>
      <div className="card-body">
        <AdminMsg msg={msg} />

        {/* Edit/Add form */}
        {editing !== null && (
          <form ref={formRef} onSubmit={save} style={{ marginBottom: '0.75rem', background: 'var(--bg-alt)', borderRadius: '0.5rem', padding: '0.75rem' }}>
            <div style={{ font: '600 0.78rem Inter, sans-serif', marginBottom: '0.5rem', color: 'var(--muted)' }}>
              {editing === 'new' ? `New ${title.replace(/s$/, '')}` : 'Edit Item'}
            </div>
            <div style={formGrid}>
              {fields.map(f => (
                <Field key={f.key} label={f.label} required={f.required}>
                  {f.type === 'select' ? (
                    <select style={inputStyle} value={form[f.key] || ''} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}>
                      <option value="">— Select —</option>
                      {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      style={inputStyle}
                      type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                      value={form[f.key] ?? ''}
                      placeholder={f.placeholder || ''}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      required={f.required}
                    />
                  )}
                </Field>
              ))}
            </div>
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <button type="submit" style={btnStyle('primary')}>
                {editing === 'new' ? 'Add Item' : 'Save Changes'}
              </button>
              <button type="button" style={btnStyle()} onClick={cancel}>Cancel</button>
            </div>
          </form>
        )}

        {/* Table */}
        {items.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No items. Click + Add to create one.</p>
        ) : (
          <div className="ws-table-wrap" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {fields.filter(f => f.showInTable !== false).map(f => (
                    <th key={f.key} style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{f.label}</th>
                  ))}
                  <th style={{ padding: '0.4rem 0.6rem', width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    {fields.filter(f => f.showInTable !== false).map(f => (
                      <td key={f.key} style={{ padding: '0.4rem 0.6rem', verticalAlign: 'middle' }}>
                        {f.type === 'status' ? (
                          <span className={`badge ${statusBadge(item[f.key])}`}>{item[f.key] || '—'}</span>
                        ) : f.type === 'date' ? (
                          <span style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{fmtDate(item[f.key])}</span>
                        ) : f.type === 'number' ? (
                          <span>{item[f.key] != null ? item[f.key].toLocaleString() : '—'}</span>
                        ) : (
                          <span>{item[f.key] || '—'}</span>
                        )}
                      </td>
                    ))}
                    <td style={{ padding: '0.4rem 0.6rem', whiteSpace: 'nowrap' }}>
                      {confirmDelete === item.id ? (
                        <span style={{ display: 'flex', gap: '0.3rem' }}>
                          <button type="button" style={btnStyle('danger')} onClick={() => del(item.id)}>Confirm</button>
                          <button type="button" style={btnStyle()} onClick={() => setConfirmDelete(null)}>No</button>
                        </span>
                      ) : (
                        <span style={{ display: 'flex', gap: '0.3rem' }}>
                          <button type="button" style={btnStyle()} onClick={() => editing === item.id ? cancel() : startEdit(item)}>
                            {editing === item.id ? 'Cancel' : 'Edit'}
                          </button>
                          <button type="button" style={btnStyle('danger')} onClick={() => setConfirmDelete(item.id)}>Del</button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Field definitions per section ─────────────────────────────────────────────

const CONSTRUCTION_FIELDS = [
  { key: 'name', label: 'Project Name', required: true },
  { key: 'type', label: 'Type', type: 'select', options: ['New Construction', 'Renovation', 'Buildout', 'Upgrade', 'Other'] },
  { key: 'status', label: 'Status', type: 'select', options: ['Planning', 'Design', 'Design Freeze', 'Procurement', 'Execution', 'Complete', 'On Hold'] },
  { key: 'progress', label: 'Progress (%)', type: 'number', defaultValue: 0 },
  { key: 'budget', label: 'Budget ($)', type: 'number', defaultValue: 0 },
  { key: 'schedule', label: 'Schedule', type: 'select', options: ['On Track', 'Ahead', 'At Risk', 'Watch', 'Delayed', 'Behind'] },
  { key: 'accreditation', label: 'Accreditation Type', placeholder: 'SCIF / SAPF / Secret / None' },
];

const ACCREDITATION_FIELDS = [
  { key: 'name', label: 'Name / Location', required: true },
  { key: 'level', label: 'Level', type: 'select', options: ['SCIF', 'SAPF', 'Secret', 'Top Secret', 'SCI', 'Collateral', 'Other'] },
  { key: 'status', label: 'Status', type: 'select', options: ['Package Assembly', 'Design Review', 'Inspection Scheduled', 'Submitted', 'Approved', 'Approved with Conditions', 'Suspended', 'Revoked'] },
  { key: 'targetDate', label: 'Target Date', type: 'date' },
];

const REAL_ESTATE_FIELDS = [
  { key: 'site', label: 'Site / Location', required: true },
  { key: 'type', label: 'Action Type', type: 'select', options: ['Lease Renewal', 'New Lease', 'Expansion Option', 'Site Acquisition', 'Disposition', 'Market Survey', 'Sublease', 'Other'] },
  { key: 'status', label: 'Status', type: 'select', options: ['Market Survey', 'Negotiation', 'Approved', 'Executed', 'In Progress', 'On Hold', 'Complete', 'Expired'] },
  { key: 'dueDate', label: 'Due / Target Date', type: 'date' },
  { key: 'owner', label: 'Owner / POC' },
];

const MILESTONE_FIELDS = [
  { key: 'title', label: 'Milestone Title', required: true },
  { key: 'date', label: 'Target Date', type: 'date' },
  { key: 'status', label: 'Status', type: 'select', options: ['Planned', 'Upcoming', 'Critical', 'In Progress', 'Complete', 'Slipped', 'Cancelled'] },
];

const RISK_FIELDS = [
  { key: 'title', label: 'Risk Title', required: true },
  { key: 'severity', label: 'Severity', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] },
  { key: 'status', label: 'Status', type: 'select', options: ['Open', 'Mitigation', 'Watch', 'Accepted', 'Closed'] },
  { key: 'owner', label: 'Owner' },
  { key: 'dueDate', label: 'Due Date', type: 'date' },
  { key: 'source', label: 'Source' },
  { key: 'notes', label: 'Notes', showInTable: false },
];

const EXECUTIVE_ACTION_FIELDS = [
  { key: 'title', label: 'Action Title', required: true },
  { key: 'owner', label: 'Owner', required: true },
  { key: 'dueDate', label: 'Due Date', type: 'date' },
  { key: 'status', label: 'Status', type: 'select', options: ['Open', 'In Progress', 'Blocked', 'Closed'] },
  { key: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] },
  { key: 'source', label: 'Source' },
  { key: 'linkedTo', label: 'Linked To' },
];

// ── Main AdminPage ─────────────────────────────────────────────────────────────

const TABS = [
  { id: 'portfolio',       label: 'Portfolio & KPIs' },
  { id: 'construction',    label: 'Construction' },
  { id: 'accreditations',  label: 'Accreditations' },
  { id: 'realEstate',      label: 'Real Estate' },
  { id: 'milestones',      label: 'Milestones' },
  { id: 'risks',           label: 'Risks' },
  { id: 'executiveActions', label: 'Executive Actions' },
];

const ADMIN_CONTENT_STYLE = {
  width: '100%',
  maxWidth: '840px',
  margin: '0 auto',
};

export default function AdminPage({ pmData, trend, onSave }) {
  const [tab, setTab] = useState('portfolio');
  const pm = pmData || {};

  const tabBtnStyle = (id) => ({
    padding: '0.55rem 1rem',
    border: 'none',
    background: 'transparent',
    font: '500 0.82rem Inter, sans-serif',
    cursor: 'pointer',
    color: tab === id ? 'var(--primary)' : 'var(--muted)',
    borderBottom: tab === id ? '2px solid var(--primary)' : '2px solid transparent',
    marginBottom: -1,
  });

  return (
    <div className="page-shell">
      <div className="page-header" style={ADMIN_CONTENT_STYLE}>
        <div className="page-header-left">
          <h1>Admin Console</h1>
        </div>
        <span className="page-badge">NEXUS Admin</span>
      </div>

      <div style={{ ...ADMIN_CONTENT_STYLE, display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1rem' }}>
        {TABS.map(t => (
          <button key={t.id} type="button" style={tabBtnStyle(t.id)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={ADMIN_CONTENT_STYLE}>
        {tab === 'portfolio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <SnapshotPanel trend={trend} onRefresh={onSave} />
            <PortfolioTab portfolio={pm.portfolio || {}} onChange={onSave} />
          </div>
        )}

        {tab === 'construction' && (
          <CrudSection
            title="Construction Projects"
            section="construction"
            items={pm.construction || []}
            fields={CONSTRUCTION_FIELDS}
            onChange={onSave}
          />
        )}

        {tab === 'accreditations' && (
          <CrudSection
            title="Accreditations"
            section="accreditations"
            items={pm.accreditations || []}
            fields={ACCREDITATION_FIELDS}
            onChange={onSave}
          />
        )}

        {tab === 'realEstate' && (
          <CrudSection
            title="Real Estate Actions"
            section="realEstate"
            items={pm.realEstate || []}
            fields={REAL_ESTATE_FIELDS}
            onChange={onSave}
          />
        )}

        {tab === 'milestones' && (
          <CrudSection
            title="Milestones & Schedule Watch"
            section="milestones"
            items={pm.milestones || []}
            fields={MILESTONE_FIELDS}
            onChange={onSave}
          />
        )}

        {tab === 'risks' && (
          <CrudSection
            title="Risks"
            section="risks"
            items={pm.risks || []}
            fields={RISK_FIELDS}
            onChange={onSave}
          />
        )}

        {tab === 'executiveActions' && (
          <CrudSection
            title="Executive Actions"
            section="executiveActions"
            items={pm.executiveActions || []}
            fields={EXECUTIVE_ACTION_FIELDS}
            onChange={onSave}
          />
        )}
      </div>
    </div>
  );
}
