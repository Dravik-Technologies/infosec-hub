import { useMemo, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Badge from '../components/ui/Badge';
import EvidencePanel from '../components/EvidencePanel';
import {
  ClipboardList, Paperclip, Search, Plus, ChevronLeft,
  CheckCircle2, Circle, Clock, AlertCircle,
  FileText, ListTodo, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Shared helpers ────────────────────────────────────────────────────────

const LIBRARY_FILTERS = ['All Risk Levels', 'Critical', 'Significant', 'Minor', 'Evidence Required', 'Has Control Ref'];

function filterButtonClass(active) {
  return active
    ? 'bg-scorva-accent/15 text-scorva-accent border-scorva-accent/40'
    : 'bg-scorva-surface text-scorva-muted border-scorva-border hover:text-scorva-text';
}

function riskTone(value) {
  if (value === 'Critical')    return 'Critical';
  if (value === 'Significant') return 'High';
  return value || 'Minor';
}

function statusColor(s) {
  if (s === 'Complete')    return 'text-emerald-400';
  if (s === 'In Progress') return 'text-yellow-400';
  return 'text-scorva-muted';
}

function statusIcon(s) {
  if (s === 'Complete')    return <CheckCircle2 size={14} className="text-emerald-400" />;
  if (s === 'In Progress') return <Clock        size={14} className="text-yellow-400"  />;
  return                          <Circle       size={14} className="text-scorva-muted" />;
}

function campaignStatusBadge(status) {
  const map = {
    'Draft':       'border-scorva-border bg-scorva-surface text-scorva-muted',
    'In Progress': 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400',
    'Complete':    'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
    'Cancelled':   'border-red-500/40 bg-red-500/10 text-red-400',
  };
  return `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${map[status] || map['Draft']}`;
}

function formatDate(val) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ProgressBar({ complete, inProgress, total }) {
  if (!total) return null;
  const completePct   = Math.round((complete   / total) * 100);
  const inProgressPct = Math.round((inProgress / total) * 100);
  return (
    <div className="h-1.5 w-full rounded-full bg-scorva-border overflow-hidden flex">
      <div className="bg-emerald-500 h-full transition-all" style={{ width: `${completePct}%` }} />
      <div className="bg-yellow-500 h-full transition-all" style={{ width: `${inProgressPct}%` }} />
    </div>
  );
}

// ─── Tab bar ───────────────────────────────────────────────────────────────

function TabBar({ active, onChange }) {
  const tabs = [
    { label: 'Library', value: 'library' },
    { label: 'Campaigns', value: 'campaigns' },
  ];

  return (
    <div className="flex gap-1 border-b border-scorva-border mb-6">
      {tabs.map(tab => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            active === tab.value
              ? 'border-scorva-accent text-scorva-accent'
              : 'border-transparent text-scorva-muted hover:text-scorva-text'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Library view (read-only, Sprint 1A) ───────────────────────────────────

function LibraryView() {
  const [selectedSection, setSelectedSection] = useState('all');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All Risk Levels');

  const { data: templates = [], isLoading: tLoading, isError: tErr, error: tError } = useQuery({
    queryKey: ['checklist-templates'],
    queryFn:  api.checklist.templates,
  });

  const activeTemplateId = templates[0]?.id || null;

  const { data: templateDetail, isLoading: tdLoading, isError: tdErr, error: tdError } = useQuery({
    queryKey: ['checklist-template', activeTemplateId],
    queryFn:  () => api.checklist.template(activeTemplateId),
    enabled:  Boolean(activeTemplateId),
  });

  const riskCategory = ['Critical', 'Significant', 'Minor'].includes(filter) ? filter : '';
  const sectionId    = selectedSection === 'all' ? '' : selectedSection;

  const { data: rawItems = [], isLoading: iLoading, isError: iErr, error: iError } = useQuery({
    queryKey: ['checklist-items', { templateId: activeTemplateId, sectionId, search, riskCategory }],
    queryFn:  () => api.checklist.items({ templateId: activeTemplateId, sectionId, search, riskCategory }),
    enabled:  Boolean(activeTemplateId),
  });

  const items = useMemo(() => {
    if (filter === 'Evidence Required') return rawItems.filter(i => i.evidenceRequired);
    if (filter === 'Has Control Ref')   return rawItems.filter(i => i.controlRef);
    return rawItems;
  }, [filter, rawItems]);

  const totalItems = useMemo(() => (
    (templateDetail?.sections || []).reduce((sum, s) => sum + (s._count?.items || 0), 0)
  ), [templateDetail]);

  if (tLoading || tdLoading || iLoading) return <LoadingSpinner />;

  if (tErr || tdErr || iErr) {
    const msg = tError?.response?.data?.error || tdError?.response?.data?.error || iError?.response?.data?.error
             || tError?.message || tdError?.message || iError?.message || 'Unknown error';
    return <div className="text-sm text-red-400">Failed to load checklist library: {msg}</div>;
  }

  if (!activeTemplateId || !templateDetail) {
    return <div className="text-sm text-scorva-muted">No checklist templates are available yet.</div>;
  }

  const sections     = templateDetail.sections || [];
  const activeSection = sections.find(s => s.id === selectedSection);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-xl border border-scorva-border bg-scorva-panel/40 p-4 flex-1">
          <div className="text-xs uppercase tracking-[0.22em] text-scorva-muted">Library Metadata</div>
          <div className="mt-2 text-sm text-scorva-muted">
            <span className="text-scorva-text font-medium">{templateDetail.name}</span>
            {templateDetail.source  ? ` · ${templateDetail.source}`  : ''}
            {templateDetail.version ? ` · ${templateDetail.version}` : ''}
          </div>
          {templateDetail.description && (
            <p className="mt-2 text-sm text-scorva-muted max-w-4xl">{templateDetail.description}</p>
          )}
        </div>
        <div className="relative w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-scorva-muted" />
          <input
            className="input-base pl-9"
            placeholder="Search items, refs, or codes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
        <aside className="rounded-xl border border-scorva-border bg-scorva-card overflow-hidden">
          <div className="px-5 py-4 border-b border-scorva-border">
            <div className="text-xs uppercase tracking-[0.22em] text-scorva-muted">Sections</div>
          </div>
          <div className="p-3 space-y-2">
            <button
              type="button"
              onClick={() => setSelectedSection('all')}
              className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${selectedSection === 'all' ? 'border-scorva-accent/50 bg-scorva-accent/10' : 'border-transparent hover:border-scorva-border hover:bg-scorva-hover/60'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-scorva-text">All</div>
                  <div className="text-xs text-scorva-muted">{totalItems} items total</div>
                </div>
                <span className="text-xs font-mono text-scorva-muted">({totalItems})</span>
              </div>
            </button>
            {sections.map(section => (
              <button
                key={section.id}
                type="button"
                onClick={() => setSelectedSection(section.id)}
                className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${selectedSection === section.id ? 'border-scorva-accent/50 bg-scorva-accent/10' : 'border-transparent hover:border-scorva-border hover:bg-scorva-hover/60'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-scorva-text truncate">
                      {section.sectionCode ? `${section.sectionCode} · ` : ''}{section.title}
                    </div>
                    <div className="text-xs text-scorva-muted">{section._count?.items || 0} items</div>
                  </div>
                  <span className="text-xs font-mono text-scorva-muted">({section._count?.items || 0})</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-xl border border-scorva-border bg-scorva-card overflow-hidden">
          <div className="px-5 py-4 border-b border-scorva-border space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-scorva-muted">Items</div>
                <div className="mt-1 text-sm text-scorva-muted">
                  {selectedSection === 'all'
                    ? `${items.length} items across all sections`
                    : `${items.length} items in ${activeSection?.sectionCode ? `${activeSection.sectionCode} · ` : ''}${activeSection?.title || 'selected section'}`}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-scorva-muted">
                <ClipboardList size={14} />
                Read-only library
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {LIBRARY_FILTERS.map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${filterButtonClass(filter === option)}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5 space-y-4">
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-scorva-border px-5 py-10 text-center text-sm text-scorva-muted">
                No checklist items match the current section and filter selection.
              </div>
            ) : items.map(item => (
              <div key={item.id} className="rounded-xl border border-scorva-border bg-scorva-panel/40 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.itemCode  && <span className="font-mono text-sm text-scorva-accent-light">{item.itemCode}</span>}
                      {item.nispomRef && <span className="text-xs text-scorva-muted">{item.nispomRef}</span>}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-scorva-text whitespace-pre-wrap">{item.questionText}</div>
                  </div>
                  <Badge label={riskTone(item.riskCategory)} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {item.evidenceRequired && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-scorva-border bg-scorva-surface px-2.5 py-1 text-xs text-scorva-muted">
                      <Paperclip size={12} />Evidence Required
                    </span>
                  )}
                  {item.controlRef && (
                    <span className="rounded-full border border-scorva-accent/30 bg-scorva-accent/10 px-2.5 py-1 text-xs font-mono text-scorva-accent-light">
                      {item.controlRef}
                    </span>
                  )}
                  <span className="rounded-full border border-scorva-border bg-scorva-surface px-2.5 py-1 text-xs text-scorva-muted">
                    {item.section?.sectionCode ? `${item.section.sectionCode} · ` : ''}{item.section?.title}
                  </span>
                </div>
                {item.applicabilityNote && (
                  <div className="mt-3 text-xs text-scorva-muted whitespace-pre-wrap">{item.applicabilityNote}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Create campaign modal ─────────────────────────────────────────────────

function CreateCampaignModal({ onClose, onCreated }) {
  const qc = useQueryClient();
  const { data: templates = [] } = useQuery({ queryKey: ['checklist-templates'], queryFn: api.checklist.templates });
  const { data: sites    = [] } = useQuery({ queryKey: ['sites'],               queryFn: api.sites.list });
  const { user } = useAuth();

  const [form, setForm] = useState({
    name: '', templateId: templates[0]?.id || '', siteId: '', startDate: '', targetDate: '', ownerName: '', notes: '',
  });
  const [error, setError] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: d => api.campaigns.create(d),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      onCreated(created.id);
    },
    onError: (err) => setError(err.response?.data?.error || err.message),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim())       { setError('Campaign name is required'); return; }
    if (!form.templateId)        { setError('Select a template'); return; }
    const isCorp = user?.role === 'Corporate Admin';
    if (isCorp && !form.siteId)  { setError('Select a site'); return; }
    mutation.mutate({
      name:       form.name,
      templateId: form.templateId,
      siteId:     isCorp ? form.siteId : undefined,
      startDate:  form.startDate  || undefined,
      targetDate: form.targetDate || undefined,
      ownerName:  form.ownerName  || undefined,
      notes:      form.notes      || undefined,
    });
  }

  const isCorp = user?.role === 'Corporate Admin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-scorva-border bg-scorva-card shadow-2xl">
        <div className="px-6 py-5 border-b border-scorva-border">
          <div className="text-base font-semibold text-scorva-text">New Inspection Campaign</div>
          <div className="text-xs text-scorva-muted mt-0.5">Creates a snapshot of the selected checklist template.</div>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs text-scorva-muted mb-1.5">Campaign Name *</label>
            <input className="input-base w-full" placeholder="e.g. DCSA Annual Self-Inspection 2026" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-scorva-muted mb-1.5">Checklist Template *</label>
            <select className="input-base w-full" value={form.templateId} onChange={e => set('templateId', e.target.value)}>
              <option value="">— Select template —</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}{t.version ? ` (${t.version})` : ''}</option>)}
            </select>
          </div>
          {isCorp && (
            <div>
              <label className="block text-xs text-scorva-muted mb-1.5">Site *</label>
              <select className="input-base w-full" value={form.siteId} onChange={e => set('siteId', e.target.value)}>
                <option value="">— Select site —</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-scorva-muted mb-1.5">Start Date</label>
              <input type="date" className="input-base w-full" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-scorva-muted mb-1.5">Target Completion</label>
              <input type="date" className="input-base w-full" value={form.targetDate} onChange={e => set('targetDate', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-scorva-muted mb-1.5">Owner</label>
            <input className="input-base w-full" placeholder="Name or role responsible" value={form.ownerName} onChange={e => set('ownerName', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-scorva-muted mb-1.5">Notes</label>
            <textarea className="input-base w-full resize-none" rows={2} placeholder="Optional context…" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
          {error && <div className="text-sm text-red-400">{error}</div>}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost text-sm">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary text-sm">
              {mutation.isPending ? 'Creating…' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Campaigns list ────────────────────────────────────────────────────────

function CampaignsList({ onSelect }) {
  const { user } = useAuth();
  const admin = user?.role === 'Corporate Admin' || user?.role === 'Site Admin';
  const [showCreate, setShowCreate] = useState(false);

  const { data: campaigns = [], isLoading, isError, error } = useQuery({
    queryKey: ['campaigns'],
    queryFn:  api.campaigns.list,
  });

  if (isLoading) return <LoadingSpinner />;
  if (isError)   return <div className="text-sm text-red-400">Failed to load campaigns: {error?.response?.data?.error || error?.message}</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-scorva-text">{campaigns.length} Campaign{campaigns.length !== 1 ? 's' : ''}</div>
          <div className="text-xs text-scorva-muted mt-0.5">Inspection campaigns for your site</div>
        </div>
        {admin && (
          <button type="button" onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} />New Campaign
          </button>
        )}
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-scorva-border px-5 py-16 text-center">
          <ClipboardList size={32} className="mx-auto text-scorva-muted mb-3" />
          <div className="text-sm text-scorva-muted">No inspection campaigns yet.</div>
          {admin && (
            <div className="mt-2 text-xs text-scorva-muted">
              Create one to start a site self-inspection workflow.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className="w-full text-left rounded-xl border border-scorva-border bg-scorva-card hover:border-scorva-accent/40 hover:bg-scorva-hover/30 transition-colors px-5 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-scorva-text">{c.name}</span>
                    <span className={campaignStatusBadge(c.status)}>{c.status}</span>
                  </div>
                  <div className="mt-1 text-xs text-scorva-muted">
                    {c.templateName}{c.templateVersion ? ` · ${c.templateVersion}` : ''}
                    {c.ownerName ? ` · ${c.ownerName}` : ''}
                  </div>
                </div>
                <div className="text-right text-xs text-scorva-muted shrink-0">
                  {c.targetDate ? <div>Target: {formatDate(c.targetDate)}</div> : null}
                  <div>Created {formatDate(c.createdAt)}</div>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <ProgressBar complete={c.complete} inProgress={c.inProgress} total={c.totalItems} />
                <div className="flex items-center gap-4 text-xs text-scorva-muted">
                  <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-400" />{c.complete} complete</span>
                  <span className="flex items-center gap-1"><Clock size={12} className="text-yellow-400" />{c.inProgress} in progress</span>
                  <span className="flex items-center gap-1"><Circle size={12} />{c.notStarted} not started</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateCampaignModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); onSelect(id); }}
        />
      )}
    </div>
  );
}

// ─── Campaign item card ────────────────────────────────────────────────────

function CampaignItemCard({ item, isAdmin, onSave, onItemAction }) {
  const qc = useQueryClient();
  const [status, setStatus]         = useState(item.status);
  const [notes, setNotes]           = useState(item.workNotes || '');
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [taskId, setTaskId]         = useState(item.taskId || null);
  const [poamId, setPoamId]         = useState(item.poamId || null);
  const [actionError, setActionError] = useState('');
  const notesRef                    = useRef(notes);
  notesRef.current                  = notes;

  async function save(patch) {
    setSaving(true);
    try {
      await onSave(item.id, patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (_) {}
    setSaving(false);
  }

  function handleStatusChange(e) {
    const val = e.target.value;
    setStatus(val);
    save({ status: val });
  }

  function handleNotesBlur() {
    if (notesRef.current !== (item.workNotes || '')) {
      save({ workNotes: notesRef.current });
    }
  }

  async function handleCreateTask() {
    setActionError('');
    try {
      const result = await api.campaigns.createItemTask(item.id);
      setTaskId(result.taskId);
      if (onItemAction) onItemAction();
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      if (err.response?.status === 409) setTaskId(err.response.data.taskId);
      else setActionError(`Task: ${msg}`);
    }
  }

  async function handleCreatePoam() {
    setActionError('');
    try {
      const result = await api.campaigns.createItemPoam(item.id);
      setPoamId(result.poamId);
      if (onItemAction) onItemAction();
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      if (err.response?.status === 409) setPoamId(err.response.data.poamId);
      else setActionError(`POA&M: ${msg}`);
    }
  }

  return (
    <div className="rounded-xl border border-scorva-border bg-scorva-panel/40 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {item.itemCode  && <span className="font-mono text-sm text-scorva-accent-light">{item.itemCode}</span>}
            {item.nispomRef && <span className="text-xs text-scorva-muted">{item.nispomRef}</span>}
          </div>
          <div className="mt-2 text-sm leading-6 text-scorva-text whitespace-pre-wrap">{item.questionText}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge label={riskTone(item.riskCategory)} />
          {isAdmin ? (
            <select
              value={status}
              onChange={handleStatusChange}
              disabled={saving}
              className={`rounded-lg border px-2.5 py-1 text-xs bg-scorva-surface transition-colors cursor-pointer ${
                status === 'Complete'    ? 'border-emerald-500/40 text-emerald-400' :
                status === 'In Progress' ? 'border-yellow-500/40  text-yellow-400'  :
                                           'border-scorva-border   text-scorva-muted'
              }`}
            >
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Complete">Complete</option>
            </select>
          ) : (
            <span className={`flex items-center gap-1 text-xs ${statusColor(status)}`}>
              {statusIcon(status)}{status}
            </span>
          )}
          {saved && <span className="text-xs text-emerald-400">✓ Saved</span>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {item.evidenceRequired && (
          <span className="inline-flex items-center gap-1 rounded-full border border-scorva-border bg-scorva-surface px-2.5 py-1 text-xs text-scorva-muted">
            <Paperclip size={12} />Evidence Required
          </span>
        )}
        {item.controlRef && (
          <span className="rounded-full border border-scorva-accent/30 bg-scorva-accent/10 px-2.5 py-1 text-xs font-mono text-scorva-accent-light">
            {item.controlRef}
          </span>
        )}
        {item.section && (
          <span className="rounded-full border border-scorva-border bg-scorva-surface px-2.5 py-1 text-xs text-scorva-muted">
            {item.section.sectionCode ? `${item.section.sectionCode} · ` : ''}{item.section.title}
          </span>
        )}
        {item.statusUpdatedAt && (
          <span className="text-xs text-scorva-muted">
            Updated {formatDate(item.statusUpdatedAt)}{item.updatedBy ? ` by ${item.updatedBy}` : ''}
          </span>
        )}
      </div>

      {isAdmin && (
        <div className="mt-3">
          <textarea
            className="input-base w-full resize-none text-xs"
            rows={2}
            placeholder="Work notes…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
          />
        </div>
      )}

      {!isAdmin && item.workNotes && (
        <div className="mt-3 text-xs text-scorva-muted whitespace-pre-wrap">{item.workNotes}</div>
      )}

      {item.applicabilityNote && (
        <div className="mt-2 text-xs text-scorva-muted/70 whitespace-pre-wrap border-t border-scorva-border/50 pt-2">
          {item.applicabilityNote}
        </div>
      )}

      {/* ── Action row ──────────────────────────────────────────── */}
      <div className="mt-3 pt-3 border-t border-scorva-border/50 flex flex-wrap items-center gap-2">
        {/* Evidence toggle */}
        <button
          type="button"
          onClick={() => setShowEvidence(v => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-scorva-border bg-scorva-surface px-2.5 py-1.5 text-xs text-scorva-muted hover:text-scorva-text transition-colors"
        >
          <Paperclip size={12} />
          Evidence
          {showEvidence ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {/* Task link / create */}
        {taskId ? (
          <a
            href={`/monitoring/tasks`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-400"
          >
            <ListTodo size={12} />{taskId}
          </a>
        ) : isAdmin ? (
          <button
            type="button"
            onClick={handleCreateTask}
            className="inline-flex items-center gap-1.5 rounded-lg border border-scorva-border bg-scorva-surface px-2.5 py-1.5 text-xs text-scorva-muted hover:text-scorva-text transition-colors"
          >
            <ListTodo size={12} />Create Task
          </button>
        ) : null}

        {/* POA&M link / create */}
        {poamId ? (
          <a
            href={`/authorization/poam`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-2.5 py-1.5 text-xs text-orange-400"
          >
            <FileText size={12} />{poamId}
          </a>
        ) : isAdmin ? (
          <button
            type="button"
            onClick={handleCreatePoam}
            className="inline-flex items-center gap-1.5 rounded-lg border border-scorva-border bg-scorva-surface px-2.5 py-1.5 text-xs text-scorva-muted hover:text-scorva-text transition-colors"
          >
            <FileText size={12} />Create POA&M
          </button>
        ) : null}

        {actionError && <span className="text-xs text-red-400">{actionError}</span>}
      </div>

      {/* Evidence panel (admin only) */}
      {showEvidence && isAdmin && (
        <div className="mt-3">
          <EvidencePanel resourceType="inspectioncampaignitem" resourceId={item.id} />
        </div>
      )}
    </div>
  );
}

// ─── Campaign detail view ──────────────────────────────────────────────────

function CampaignDetail({ campaignId, onBack }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const admin = user?.role === 'Corporate Admin' || user?.role === 'Site Admin';

  const [selectedSection, setSelectedSection] = useState('all');
  const [search, setSearch]                   = useState('');
  const [statusFilter, setStatusFilter]       = useState('');
  const [editingStatus, setEditingStatus]     = useState(false);

  const { data: campaign, isLoading: cLoading, isError: cErr, error: cError } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn:  () => api.campaigns.get(campaignId),
  });

  const sectionId = selectedSection === 'all' ? '' : selectedSection;

  const { data: items = [], isLoading: iLoading } = useQuery({
    queryKey: ['campaign-items', { campaignId, sectionId, search, status: statusFilter }],
    queryFn:  () => api.campaigns.items({ campaignId, sectionId, search, status: statusFilter || undefined }),
    enabled:  Boolean(campaignId),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, data }) => api.campaigns.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', campaignId] }),
  });

  async function handleSaveItem(itemId, patch) {
    await api.campaigns.updateItem(itemId, patch);
    qc.invalidateQueries({ queryKey: ['campaign-items', { campaignId, sectionId, search, status: statusFilter }] });
    qc.invalidateQueries({ queryKey: ['campaign', campaignId] });
  }

  if (cLoading || iLoading) return <LoadingSpinner />;
  if (cErr) return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-2 text-sm text-scorva-muted hover:text-scorva-text">
        <ChevronLeft size={16} />Back to Campaigns
      </button>
      <div className="text-sm text-red-400">Failed to load campaign: {cError?.response?.data?.error || cError?.message}</div>
    </div>
  );

  const { sections = [], progress = {} } = campaign;
  const activeSection = sections.find(s => s.id === selectedSection);
  const ITEM_STATUSES = ['', 'Not Started', 'In Progress', 'Complete'];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onBack} className="flex items-center gap-2 text-sm text-scorva-muted hover:text-scorva-text shrink-0 mt-0.5">
          <ChevronLeft size={16} />Back
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-scorva-text">{campaign.name}</span>
            {admin ? (
              <select
                value={campaign.status}
                onChange={e => statusMutation.mutate({ id: campaignId, data: { status: e.target.value } })}
                className={`rounded-lg border px-2.5 py-1 text-xs bg-scorva-surface cursor-pointer ${
                  campaign.status === 'Complete'    ? 'border-emerald-500/40 text-emerald-400' :
                  campaign.status === 'In Progress' ? 'border-yellow-500/40  text-yellow-400'  :
                  campaign.status === 'Cancelled'   ? 'border-red-500/40     text-red-400'      :
                                                      'border-scorva-border   text-scorva-muted'
                }`}
              >
                {['Draft','In Progress','Complete','Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <span className={campaignStatusBadge(campaign.status)}>{campaign.status}</span>
            )}
          </div>
          <div className="mt-1 text-xs text-scorva-muted">
            {campaign.templateName}{campaign.templateVersion ? ` · ${campaign.templateVersion}` : ''}
            {campaign.ownerName ? ` · ${campaign.ownerName}` : ''}
            {campaign.targetDate ? ` · Target: ${formatDate(campaign.targetDate)}` : ''}
          </div>
        </div>
        <div className="relative w-56 shrink-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-scorva-muted" />
          <input
            className="input-base pl-9 text-sm"
            placeholder="Search items…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Progress summary */}
      <div className="rounded-xl border border-scorva-border bg-scorva-panel/40 p-4">
        <div className="flex flex-wrap items-center gap-6 mb-3">
          <div className="text-xs text-scorva-muted">{progress.totalItems} total items</div>
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 size={13} />{progress.complete} complete
          </span>
          <span className="flex items-center gap-1.5 text-xs text-yellow-400">
            <Clock size={13} />{progress.inProgress} in progress
          </span>
          <span className="flex items-center gap-1.5 text-xs text-scorva-muted">
            <Circle size={13} />{progress.notStarted} not started
          </span>
        </div>
        <ProgressBar complete={progress.complete} inProgress={progress.inProgress} total={progress.totalItems} />
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {ITEM_STATUSES.map(s => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${filterButtonClass(statusFilter === s)}`}
          >
            {s || 'All Statuses'}
          </button>
        ))}
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-6">
        <aside className="rounded-xl border border-scorva-border bg-scorva-card overflow-hidden">
          <div className="px-5 py-4 border-b border-scorva-border">
            <div className="text-xs uppercase tracking-[0.22em] text-scorva-muted">Sections</div>
          </div>
          <div className="p-3 space-y-1.5">
            <button
              type="button"
              onClick={() => setSelectedSection('all')}
              className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${selectedSection === 'all' ? 'border-scorva-accent/50 bg-scorva-accent/10' : 'border-transparent hover:border-scorva-border hover:bg-scorva-hover/60'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-scorva-text">All</div>
                <span className="text-xs font-mono text-scorva-muted">({progress.totalItems})</span>
              </div>
              <ProgressBar complete={progress.complete} inProgress={progress.inProgress} total={progress.totalItems} />
            </button>
            {sections.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSection(s.id)}
                className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${selectedSection === s.id ? 'border-scorva-accent/50 bg-scorva-accent/10' : 'border-transparent hover:border-scorva-border hover:bg-scorva-hover/60'}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-scorva-text truncate">
                      {s.sectionCode ? `${s.sectionCode} · ` : ''}{s.title}
                    </div>
                    <div className="text-xs text-scorva-muted">{s.complete}/{s.totalItems} complete</div>
                  </div>
                  {admin && (
                    <button
                      type="button"
                      title={s.status === 'Complete' ? 'Reopen section' : 'Mark section complete'}
                      onClick={async (e) => {
                        e.stopPropagation();
                        const next = s.status === 'Complete' ? 'Not Started' : 'Complete';
                        await api.campaigns.updateSection(s.id, { status: next });
                        qc.invalidateQueries({ queryKey: ['campaign', campaignId] });
                      }}
                      className={`shrink-0 rounded-full p-1 hover:bg-scorva-hover/60 transition-colors ${s.status === 'Complete' ? 'text-emerald-400' : 'text-scorva-muted'}`}
                    >
                      {s.status === 'Complete' ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                    </button>
                  )}
                </div>
                <ProgressBar complete={s.complete} inProgress={s.inProgress} total={s.totalItems} />
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-xl border border-scorva-border bg-scorva-card overflow-hidden">
          <div className="px-5 py-4 border-b border-scorva-border">
            <div className="text-xs uppercase tracking-[0.22em] text-scorva-muted">Items</div>
            <div className="mt-1 text-sm text-scorva-muted">
              {selectedSection === 'all'
                ? `${items.length} items across all sections`
                : `${items.length} items in ${activeSection?.sectionCode ? `${activeSection.sectionCode} · ` : ''}${activeSection?.title || 'selected section'}`}
            </div>
          </div>
          <div className="p-5 space-y-4">
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-scorva-border px-5 py-10 text-center text-sm text-scorva-muted">
                No items match the current selection.
              </div>
            ) : items.map(item => (
              <CampaignItemCard
                key={item.id}
                item={item}
                isAdmin={admin}
                onSave={handleSaveItem}
                onItemAction={() => qc.invalidateQueries({ queryKey: ['campaign-items', { campaignId, sectionId, search, status: statusFilter }] })}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────

export default function ChecklistLibrary() {
  const [activeTab,        setActiveTab]        = useState('library');
  const [activeCampaignId, setActiveCampaignId] = useState(null);

  if (activeCampaignId) {
    return (
      <CampaignDetail
        campaignId={activeCampaignId}
        onBack={() => setActiveCampaignId(null)}
      />
    );
  }

  return (
    <div className="space-y-0">
      <PageHeader
        title="DCSA Self-Inspection"
        description="Checklist library and inspection campaigns"
      />
      <TabBar active={activeTab} onChange={setActiveTab} />
      {activeTab === 'library'   && <LibraryView />}
      {activeTab === 'campaigns' && <CampaignsList onSelect={setActiveCampaignId} />}
    </div>
  );
}
