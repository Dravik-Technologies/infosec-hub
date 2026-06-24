import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import PageHeader    from '../components/ui/PageHeader';
import Table         from '../components/ui/Table';
import Badge         from '../components/ui/Badge';
import Modal         from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Plus, Pencil, Trash2, Search, Upload, Download, RefreshCw, Link2 } from 'lucide-react';

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
import StatusDashboard, { StatTile } from '../components/ui/StatusDashboard';
import DonutChart from '../components/ui/DonutChart';
import BarList    from '../components/ui/BarList';
import ImportControlsModal from '../components/ImportControlsModal';
import EvidencePanel from '../components/EvidencePanel';
import { getRecordSiteLabel, guardSiteScopedCreate, isAllSitesView, requiresExplicitSiteSelection } from '../utils/siteSelectionGuard';

/* ── NIST families for dropdown ── */
const NIST_FAMILIES = [
  'Access Control', 'Awareness and Training', 'Audit and Accountability',
  'Assessment, Authorization, and Monitoring', 'Configuration Management',
  'Contingency Planning', 'Identification and Authentication', 'Incident Response',
  'Maintenance', 'Media Protection', 'Physical and Environmental Protection',
  'Planning', 'Program Management', 'Personnel Security',
  'Personally Identifiable Information Processing and Transparency',
  'Risk Assessment', 'System and Services Acquisition',
  'System and Communications Protection', 'System and Information Integrity',
  'Supply Chain Risk Management',
];

const EMPTY = {
  id: '', title: '', family: '', status: 'Not Implemented', baseline: '',
  last_review: '', findings: 0, notes: '',
  description: '', implementation_guidance: '',
  conmon_status: 'Open', conmon_group: '', conmon_frequency: '',
};

const CATALOG_EMPTY = {
  controlKey: '',
  title: '',
  family: '',
  baseline: '',
  description: '',
  source: '',
  implementation_default: '',
  owner_type: 'enterprise',
  owner_site_id: '',
  version: '',
};

const SITE_IMPL_EMPTY = {
  status: 'Not Implemented',
  last_review: '',
  findings: 0,
  notes: '',
  implementation_guidance: '',
  conmon_status: 'Open',
  conmon_group: '',
  conmon_frequency: '',
  assigned_to: '',
  evidence_summary: '',
};

function toFormState(row = {}) {
  return {
    ...EMPTY,
    ...row,
    id: row.control_id ?? row.id ?? '',
    last_review: row.last_review ?? row.lastReview ?? '',
    implementation_guidance: row.implementation_guidance ?? row.implementationGuidance ?? '',
    conmon_status: row.conmon_status ?? row.conmonStatus ?? 'Open',
    conmon_group: row.conmon_group ?? row.conmonGroup ?? '',
    conmon_frequency: row.conmon_frequency ?? row.conmonFrequency ?? '',
  };
}

function toCatalogFormState(row = {}) {
  return {
    ...CATALOG_EMPTY,
    ...row,
    controlKey: row.controlKey ?? row.control_key ?? '',
    implementation_default: row.implementationDefault ?? row.implementation_default ?? '',
    owner_type: row.ownerType ?? row.owner_type ?? 'enterprise',
    owner_site_id: row.ownerSiteId ?? row.owner_site_id ?? '',
  };
}

function toImplementationFormState(row = {}) {
  return {
    ...SITE_IMPL_EMPTY,
    ...row,
    last_review: row.last_review ?? row.lastReview ?? '',
    implementation_guidance: row.implementation_guidance ?? row.implementationGuidance ?? '',
    conmon_status: row.conmon_status ?? row.conmonStatus ?? 'Open',
    conmon_group: row.conmon_group ?? row.conmonGroup ?? '',
    conmon_frequency: row.conmon_frequency ?? row.conmonFrequency ?? '',
    assigned_to: row.assigned_to ?? row.assignedTo ?? '',
    evidence_summary: row.evidence_summary ?? row.evidenceSummary ?? '',
  };
}

function getControlRowClass(row) {
  const status = row.status || '';
  if (status === 'Not Implemented')     return 'row-critical';
  if (status === 'Partially Implemented') return 'row-medium';
  return '';
}

function ControlsSurfaceTabs({ active, onChange }) {
  const tabs = [
    { id: 'legacy', label: 'Legacy Workspace' },
    { id: 'catalog', label: 'Catalog Definitions' },
    { id: 'implementations', label: 'Site Implementations' },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            active === tab.id
              ? 'border-scorva-accent/50 bg-scorva-accent/12 text-scorva-accent'
              : 'border-scorva-border bg-scorva-panel text-scorva-muted hover:text-scorva-text'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ── Add / Edit form ── */
function ControlForm({ value, onChange, isNew }) {
  const f = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-4">
      {isNew && (
        <div>
          <label className="block text-xs text-scorva-muted mb-1">CONTROL ID *</label>
          <input className="input-base font-mono" placeholder="e.g. SI-2, AC-6, CUSTOM-001" value={value.id} onChange={e => f('id', e.target.value)} required />
        </div>
      )}
      <div className={isNew ? '' : 'col-span-2'}>
        <label className="block text-xs text-scorva-muted mb-1">TITLE *</label>
        <input className="input-base" placeholder="e.g. Flaw Remediation" value={value.title} onChange={e => f('title', e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">CONTROL FAMILY</label>
        <select className="input-base" value={value.family} onChange={e => f('family', e.target.value)}>
          <option value="">— Select —</option>
          {NIST_FAMILIES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">BASELINE</label>
        <select className="input-base" value={value.baseline} onChange={e => f('baseline', e.target.value)}>
          <option value="">—</option>
          {['Low','Moderate','High'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">IMPLEMENTATION STATUS</label>
        <select className="input-base" value={value.status} onChange={e => f('status', e.target.value)}>
          {['Not Implemented','Partially Implemented','Implemented'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">LAST REVIEW DATE</label>
        <input type="date" className="input-base" value={value.last_review || ''} onChange={e => f('last_review', e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">
          DESCRIPTION <span className="text-scorva-muted/60">(OPTIONAL — NIST CONTROL TEXT)</span>
        </label>
        <textarea className="input-base resize-none" rows={4} placeholder="Paste the official NIST SP 800-53 control description here..." value={value.description || ''} onChange={e => f('description', e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">
          IMPLEMENTATION GUIDANCE <span className="text-scorva-muted/60">(OPTIONAL)</span>
        </label>
        <textarea className="input-base resize-none" rows={3} placeholder="How is this control implemented in your environment?" value={value.implementation_guidance || ''} onChange={e => f('implementation_guidance', e.target.value)} />
      </div>

      {/* ConMon section */}
      <div className="col-span-2 border-t border-scorva-border pt-3 mt-1">
        <p className="text-[11px] text-scorva-muted uppercase tracking-wider mb-3">ConMon Tracking</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs text-scorva-muted mb-1">CONMON GROUP / ACTIVITY</label>
            <input className="input-base" placeholder="e.g. Monthly STIG/SCAP Review" value={value.conmon_group || ''} onChange={e => f('conmon_group', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-scorva-muted mb-1">CONMON STATUS</label>
            <select className="input-base" value={value.conmon_status || 'Open'} onChange={e => f('conmon_status', e.target.value)}>
              {['Open','Compliant','POA&M'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-scorva-muted mb-1">CONMON FREQUENCY</label>
            <select className="input-base" value={value.conmon_frequency || ''} onChange={e => f('conmon_frequency', e.target.value)}>
              <option value="">—</option>
              {['Weekly','Monthly','Quarterly','Annual','On Demand'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function CatalogDefinitionForm({ value, onChange, isHubAdmin, selectedSite, showSiteContext }) {
  const f = (k, v) => onChange({ ...value, [k]: v });
  const isSiteOwned = value.owner_type === 'site';

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-xs text-scorva-muted mb-1">CONTROL KEY *</label>
        <input className="input-base font-mono" placeholder="e.g. AC-2" value={value.controlKey} onChange={e => f('controlKey', e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">SOURCE</label>
        <input className="input-base" placeholder="e.g. NIST SP 800-53 Rev 5" value={value.source || ''} onChange={e => f('source', e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">TITLE *</label>
        <input className="input-base" placeholder="Control title" value={value.title} onChange={e => f('title', e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">FAMILY</label>
        <select className="input-base" value={value.family || ''} onChange={e => f('family', e.target.value)}>
          <option value="">— Select —</option>
          {NIST_FAMILIES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">BASELINE</label>
        <select className="input-base" value={value.baseline || ''} onChange={e => f('baseline', e.target.value)}>
          <option value="">—</option>
          {['Low', 'Moderate', 'High'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">OWNERSHIP MODEL</label>
        <select
          className="input-base"
          value={value.owner_type}
          onChange={e => f('owner_type', e.target.value)}
          disabled={!isHubAdmin && !isSiteOwned}
        >
          {isHubAdmin && <option value="enterprise">Enterprise Definition</option>}
          <option value="site">Site-Owned Definition</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-scorva-muted mb-1">OWNER SITE</label>
        <input
          className="input-base font-mono"
          value={isSiteOwned ? (value.owner_site_id || selectedSite || '') : 'Enterprise'}
          onChange={e => f('owner_site_id', e.target.value)}
          disabled={!isSiteOwned || !showSiteContext}
          placeholder={isSiteOwned ? 'Select from header or type site ID' : 'Enterprise-owned'}
        />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">DESCRIPTION</label>
        <textarea className="input-base resize-none" rows={4} placeholder="Reusable definition text for this control." value={value.description || ''} onChange={e => f('description', e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-scorva-muted mb-1">DEFAULT IMPLEMENTATION GUIDANCE</label>
        <textarea className="input-base resize-none" rows={3} placeholder="Optional default guidance copied into site implementations." value={value.implementation_default || ''} onChange={e => f('implementation_default', e.target.value)} />
      </div>
    </div>
  );
}

function SiteImplementationForm({ value, onChange, controlLabel }) {
  const f = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-scorva-border bg-scorva-panel/50 px-3 py-2">
        <div className="text-xs uppercase tracking-wider text-scorva-muted mb-1">Control</div>
        <div className="text-sm text-scorva-text">{controlLabel}</div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-scorva-muted mb-1">IMPLEMENTATION STATUS</label>
          <select className="input-base" value={value.status} onChange={e => f('status', e.target.value)}>
            {['Not Implemented', 'Partially Implemented', 'Implemented'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-scorva-muted mb-1">LAST REVIEW DATE</label>
          <input type="date" className="input-base" value={value.last_review || ''} onChange={e => f('last_review', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-scorva-muted mb-1">CONMON STATUS</label>
          <select className="input-base" value={value.conmon_status || 'Open'} onChange={e => f('conmon_status', e.target.value)}>
            {['Open', 'Compliant', 'POA&M'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-scorva-muted mb-1">CONMON FREQUENCY</label>
          <select className="input-base" value={value.conmon_frequency || ''} onChange={e => f('conmon_frequency', e.target.value)}>
            <option value="">—</option>
            {['Weekly', 'Monthly', 'Quarterly', 'Annual', 'On Demand'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-scorva-muted mb-1">CONMON GROUP</label>
          <input className="input-base" value={value.conmon_group || ''} onChange={e => f('conmon_group', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-scorva-muted mb-1">ASSIGNED TO</label>
          <input className="input-base" value={value.assigned_to || ''} onChange={e => f('assigned_to', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-scorva-muted mb-1">IMPLEMENTATION GUIDANCE</label>
          <textarea className="input-base resize-none" rows={3} value={value.implementation_guidance || ''} onChange={e => f('implementation_guidance', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-scorva-muted mb-1">EVIDENCE SUMMARY</label>
          <textarea className="input-base resize-none" rows={2} value={value.evidence_summary || ''} onChange={e => f('evidence_summary', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-scorva-muted mb-1">NOTES</label>
          <textarea className="input-base resize-none" rows={3} value={value.notes || ''} onChange={e => f('notes', e.target.value)} />
        </div>
      </div>
    </div>
  );
}

function SiteImplementationWorkspace({
  detail,
  onClose,
  onEdit,
  onAddFinding,
  onUpdateFinding,
  onCreateFindingPoam,
  onAddEvidence,
  addFindingPending,
  addEvidencePending,
  updateFindingPendingId,
  createFindingPoamPendingId,
  focusFindingId,
  mutationError,
}) {
  const [findingForm, setFindingForm] = useState({
    title: '',
    description: '',
    severity: 'Medium',
    status: 'Open',
  });
  const [findingSearch, setFindingSearch] = useState('');
  const [findingStatusFilter, setFindingStatusFilter] = useState('All');
  const [evidenceForm, setEvidenceForm] = useState({
    artifactType: 'Screenshot',
    fileName: '',
    url: '',
    notes: '',
  });
  const [poamDrafts, setPoamDrafts] = useState({});

  const findings = Array.isArray(detail?.findingsRecords) ? detail.findingsRecords : [];
  const evidence = Array.isArray(detail?.evidenceArtifacts) ? detail.evidenceArtifacts : [];
  const findingCounts = useMemo(() => ({
    all: findings.length,
    open: findings.filter(finding => (finding.status || 'Open') === 'Open').length,
    inProgress: findings.filter(finding => (finding.status || 'Open') === 'In Progress').length,
    resolved: findings.filter(finding => ['Resolved', 'Closed'].includes(finding.status || 'Open')).length,
  }), [findings]);
  const filteredFindings = useMemo(() => {
    const query = findingSearch.trim().toLowerCase();
    return findings.filter(finding => {
      const haystack = [
        finding.title,
        finding.description,
        finding.severity,
        finding.status,
        finding.poamId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      const normalizedStatus = finding.status || 'Open';
      const matchesStatus =
        findingStatusFilter === 'All' ||
        normalizedStatus === findingStatusFilter ||
        (findingStatusFilter === 'Resolved / Closed' && ['Resolved', 'Closed'].includes(normalizedStatus));
      return matchesSearch && matchesStatus;
    });
  }, [findings, findingSearch, findingStatusFilter]);

  useEffect(() => {
    const nextDrafts = {};
    findings.forEach(finding => {
      nextDrafts[finding.id] = poamDrafts[finding.id] || {
        title: `${detail.controlCatalog?.controlKey || 'Control'}: ${finding.title}`,
        responsible_party: detail.assignedTo || '',
        scheduled_completion: '',
        poam_type: 'Control Finding',
        comments: '',
        risk_decision: '',
        risk_rationale: '',
      };
    });
    setPoamDrafts(nextDrafts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id, findings.length]);

  useEffect(() => {
    if (!focusFindingId) return;
    const el = document.getElementById(`site-control-finding-${focusFindingId}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusFindingId, detail?.id]);

  function updatePoamDraft(findingId, patch) {
    setPoamDrafts(prev => ({
      ...prev,
      [findingId]: {
        ...(prev[findingId] || {}),
        ...patch,
      },
    }));
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-scorva-border bg-scorva-panel/50 px-3 py-3">
          <div className="text-xs uppercase tracking-wider text-scorva-muted mb-1">Control</div>
          <div className="text-sm text-scorva-text font-medium">
            {detail.controlCatalog?.controlKey || '—'} — {detail.controlCatalog?.title || 'Untitled control'}
          </div>
        </div>
        <div className="rounded-lg border border-scorva-border bg-scorva-panel/50 px-3 py-3">
          <div className="text-xs uppercase tracking-wider text-scorva-muted mb-1">Site</div>
          <div className="text-sm text-scorva-text font-mono">{getRecordSiteLabel(detail)}</div>
        </div>
        <div className="rounded-lg border border-scorva-border bg-scorva-panel/50 px-3 py-3">
          <div className="text-xs uppercase tracking-wider text-scorva-muted mb-1">Implementation Status</div>
          <div><Badge label={detail.status || 'Not Implemented'} /></div>
        </div>
        <div className="rounded-lg border border-scorva-border bg-scorva-panel/50 px-3 py-3">
          <div className="text-xs uppercase tracking-wider text-scorva-muted mb-1">ConMon Status</div>
          <div><Badge label={detail.conmon_status || 'Open'} /></div>
        </div>
      </div>

      <div className="rounded-xl border border-scorva-border bg-scorva-panel/40 p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-scorva-muted">Findings</div>
            <p className="mt-1 text-sm text-scorva-muted">Track open issues for this site control implementation.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-scorva-muted">
            <span>{findingCounts.all} recorded</span>
            <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-red-300">
              {findingCounts.open} open
            </span>
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-amber-300">
              {findingCounts.inProgress} in progress
            </span>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
              {findingCounts.resolved} resolved
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-scorva-muted mb-1">Title</label>
            <input
              className="input-base"
              value={findingForm.title}
              onChange={e => setFindingForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Finding title"
            />
          </div>
          <div>
            <label className="block text-xs text-scorva-muted mb-1">Severity</label>
            <select
              className="input-base"
              value={findingForm.severity}
              onChange={e => setFindingForm(prev => ({ ...prev, severity: e.target.value }))}
            >
              {['Low', 'Medium', 'High', 'Critical'].map(level => <option key={level}>{level}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-scorva-muted mb-1">Description</label>
            <textarea
              className="input-base resize-none"
              rows={2}
              value={findingForm.description}
              onChange={e => setFindingForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the implementation gap, evidence gap, or deficiency."
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="btn-secondary"
            disabled={!findingForm.title.trim() || addFindingPending}
            onClick={() => onAddFinding(findingForm, () => setFindingForm({ title: '', description: '', severity: 'Medium', status: 'Open' }))}
          >
            {addFindingPending ? 'Adding Finding…' : 'Add Finding'}
          </button>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_220px] gap-3">
          <input
            className="input-base"
            value={findingSearch}
            onChange={e => setFindingSearch(e.target.value)}
            placeholder="Search findings, severity, POA&M link..."
          />
          <select
            className="input-base"
            value={findingStatusFilter}
            onChange={e => setFindingStatusFilter(e.target.value)}
          >
            {['All', 'Open', 'In Progress', 'Resolved / Closed'].map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        {findings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-scorva-border px-4 py-5 text-sm text-scorva-muted">
            No findings recorded for this implementation yet.
          </div>
        ) : filteredFindings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-scorva-border px-4 py-5 text-sm text-scorva-muted">
            No findings match the current filter.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFindings.map(finding => (
              <div
                key={finding.id}
                id={`site-control-finding-${finding.id}`}
                className={`rounded-lg border bg-scorva-surface/40 px-4 py-3 transition-colors ${
                  focusFindingId === finding.id
                    ? 'border-orange-400/60 ring-1 ring-orange-400/40'
                    : 'border-scorva-border'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-scorva-text">{finding.title}</span>
                      <Badge label={finding.severity || 'Medium'} />
                    </div>
                    {finding.description && (
                      <div className="mt-1 text-sm text-scorva-muted whitespace-pre-wrap">{finding.description}</div>
                    )}
                  </div>
                  <select
                    className="input-base w-40"
                    value={finding.status || 'Open'}
                    onChange={e => onUpdateFinding(finding.id, { status: e.target.value })}
                    disabled={updateFindingPendingId === finding.id}
                  >
                    {['Open', 'In Progress', 'Resolved', 'Closed'].map(status => <option key={status}>{status}</option>)}
                  </select>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {finding.poamId ? (
                    <a
                      href={`/authorization/poam?poamId=${encodeURIComponent(finding.poamId)}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-2.5 py-1.5 text-xs text-orange-400"
                    >
                      <Link2 size={12} />
                      Open {finding.poamId}
                    </a>
                  ) : (
                    <>
                      <input
                        className="input-base h-9 min-w-[180px] flex-1"
                        placeholder="Responsible party"
                        value={poamDrafts[finding.id]?.responsible_party || ''}
                        onChange={e => updatePoamDraft(finding.id, { responsible_party: e.target.value })}
                      />
                      <input
                        type="date"
                        className="input-base h-9 w-44"
                        value={poamDrafts[finding.id]?.scheduled_completion || ''}
                        onChange={e => updatePoamDraft(finding.id, { scheduled_completion: e.target.value })}
                      />
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-scorva-border bg-scorva-surface px-2.5 py-1.5 text-xs text-scorva-muted hover:text-scorva-text transition-colors"
                        onClick={() => onCreateFindingPoam(finding.id, poamDrafts[finding.id] || {})}
                        disabled={createFindingPoamPendingId === finding.id}
                      >
                        <Link2 size={12} />
                        {createFindingPoamPendingId === finding.id ? 'Creating POA&M…' : 'Create POA&M'}
                      </button>
                    </>
                  )}
                  {finding.poamStatus && <Badge label={finding.poamStatus} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-scorva-border bg-scorva-panel/40 p-4 space-y-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-scorva-muted">Evidence References</div>
          <p className="mt-1 text-sm text-scorva-muted">Record links, filenames, and notes for implementation evidence tied to this control.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-scorva-muted mb-1">Artifact Type</label>
            <select
              className="input-base"
              value={evidenceForm.artifactType}
              onChange={e => setEvidenceForm(prev => ({ ...prev, artifactType: e.target.value }))}
            >
              {['Screenshot', 'Scan Report', 'Configuration Export', 'Plan', 'Memo', 'Other'].map(type => <option key={type}>{type}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-scorva-muted mb-1">File Name</label>
            <input
              className="input-base"
              value={evidenceForm.fileName}
              onChange={e => setEvidenceForm(prev => ({ ...prev, fileName: e.target.value }))}
              placeholder="e.g. AC-2-review.pdf"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-scorva-muted mb-1">URL</label>
            <input
              className="input-base"
              value={evidenceForm.url}
              onChange={e => setEvidenceForm(prev => ({ ...prev, url: e.target.value }))}
              placeholder="Optional evidence URL"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-scorva-muted mb-1">Notes</label>
            <textarea
              className="input-base resize-none"
              rows={2}
              value={evidenceForm.notes}
              onChange={e => setEvidenceForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="What does this artifact support?"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            className="btn-secondary"
            disabled={(!evidenceForm.fileName.trim() && !evidenceForm.url.trim()) || addEvidencePending}
            onClick={() => onAddEvidence(evidenceForm, () => setEvidenceForm({ artifactType: 'Screenshot', fileName: '', url: '', notes: '' }))}
          >
            {addEvidencePending ? 'Adding Evidence…' : 'Add Evidence Reference'}
          </button>
        </div>

        {evidence.length === 0 ? (
          <div className="rounded-lg border border-dashed border-scorva-border px-4 py-5 text-sm text-scorva-muted">
            No implementation evidence references recorded yet.
          </div>
        ) : (
          <div className="space-y-3">
            {evidence.map(item => (
              <div key={item.id} className="rounded-lg border border-scorva-border bg-scorva-surface/40 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-scorva-text">{item.fileName || item.url || 'Evidence reference'}</span>
                      {item.artifactType && <Badge label={item.artifactType} />}
                    </div>
                    {item.url && <div className="mt-1 text-xs text-scorva-accent-light break-all">{item.url}</div>}
                    {item.notes && <div className="mt-1 text-sm text-scorva-muted whitespace-pre-wrap">{item.notes}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {mutationError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {mutationError}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-scorva-border">
        <button type="button" className="btn-secondary" onClick={onEdit}>Edit Implementation</button>
        <button type="button" className="btn-primary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

/* ── Control Detail view ── */
function ControlDetail({ control, activities }) {
  const linked = activities.filter(a => (a.linked_controls || []).includes(control.control_id || control.id));

  function Field({ label, value, mono }) {
    if (!value && value !== 0) return null;
    return (
      <div>
        <div className="text-xs text-scorva-muted mb-0.5 uppercase tracking-wider">{label}</div>
        <div className={`text-sm text-scorva-text ${mono ? 'font-mono' : ''}`}>{value}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <Badge label={control.status} />
        <Badge label={control.conmon_status || 'Open'} />
        {control.baseline && <span className="px-2 py-0.5 rounded text-xs bg-scorva-surface text-scorva-muted border border-scorva-border">{control.baseline}</span>}
      </div>

      {/* Core fields */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <Field label="Family"       value={control.family} />
        <Field label="Baseline"     value={control.baseline} />
        <Field label="Last Review"  value={control.last_review} mono />
        <Field label="Findings"     value={control.findings > 0 ? control.findings : null} />
        <Field label="ConMon Group" value={control.conmon_group} />
        <Field label="Frequency"    value={control.conmon_frequency} />
      </div>

      {/* Description */}
      {control.description && (
        <div>
          <div className="text-xs text-scorva-muted mb-1 uppercase tracking-wider">Description</div>
          <div className="text-xs text-scorva-text whitespace-pre-wrap bg-scorva-surface rounded-lg p-3 border border-scorva-border leading-relaxed max-h-40 overflow-y-auto">{control.description}</div>
        </div>
      )}

      {/* Implementation Guidance */}
      {control.implementation_guidance && (
        <div>
          <div className="text-xs text-scorva-muted mb-1 uppercase tracking-wider">Implementation Guidance</div>
          <div className="text-sm text-scorva-text whitespace-pre-wrap bg-scorva-surface rounded-lg p-3 border border-scorva-border">{control.implementation_guidance}</div>
        </div>
      )}

      {/* Linked ConMon Activities */}
      {linked.length > 0 && (
        <div>
          <div className="text-xs text-scorva-muted uppercase tracking-wider mb-2">Linked ConMon Activities</div>
          <div className="space-y-2">
            {linked.map(a => (
              <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-scorva-hover/50 border border-scorva-border/50 text-xs">
                <div>
                  <span className="font-mono text-scorva-accent-light mr-2">{a.id}</span>
                  <span className="text-scorva-text">{a.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-scorva-muted">{a.frequency}</span>
                  <Badge label={a.status || 'Scheduled'} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {control.notes && (
        <div>
          <div className="text-xs text-scorva-muted mb-1 uppercase tracking-wider">Notes</div>
          <div className="text-sm text-scorva-text whitespace-pre-wrap bg-scorva-surface rounded-lg p-3 border border-scorva-border">{control.notes}</div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════ */
export default function ControlsPage() {
  const qc = useQueryClient();
  const { user, selectedSite } = useAuth();
  const needsExplicitSite = requiresExplicitSiteSelection(user, selectedSite);
  const showSiteContext = isAllSitesView(user, selectedSite);
  const siteScopeKey = selectedSite || user?.siteID || user?.siteId || 'active-site';
  const isHubAdmin = Boolean(
    user?.canSeeAllSites ||
    user?.hubRole === 'Hub Admin' ||
    user?.role === 'Hub Admin' ||
    user?.role === 'Corporate Admin'
  );
  const { data = [],           isLoading, isError, error }  = useQuery({ queryKey: ['controls', siteScopeKey], queryFn: api.controls.list });
  const { data: activities = [] }            = useQuery({ queryKey: ['conmon', siteScopeKey],   queryFn: api.conmon.list });
  const { data: catalogDefinitions = [], isLoading: catalogLoading } = useQuery({
    queryKey: ['control-catalog', siteScopeKey],
    queryFn: () => api.controlCatalog.list({ ownerScope: 'all', siteId: selectedSite || undefined }),
  });
  const { data: siteImplementations = [], isLoading: implementationLoading } = useQuery({
    queryKey: ['site-controls', siteScopeKey],
    queryFn: () => api.siteControls.list({ siteId: selectedSite || undefined }),
  });

  const [modal,        setModal]       = useState(null);   // 'create' | 'edit' | 'view'
  const [form,         setForm]        = useState(EMPTY);
  const [editing,      setEditing]     = useState(null);
  const [viewing,      setViewing]     = useState(null);
  const [delId,        setDelId]       = useState(null);
  const [search,       setSearch]      = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterConMon, setFilterConMon] = useState('All');
  const [importOpen,   setImportOpen]  = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteError, setBulkDeleteError] = useState('');
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [surface, setSurface] = useState('legacy');
  const [catalogModal, setCatalogModal] = useState(null); // 'create' | 'edit'
  const [catalogForm, setCatalogForm] = useState(CATALOG_EMPTY);
  const [editingCatalog, setEditingCatalog] = useState(null);
  const [catalogDeleteId, setCatalogDeleteId] = useState(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCatalogIds, setSelectedCatalogIds] = useState([]);
  const [implementationModal, setImplementationModal] = useState(null);
  const [implementationForm, setImplementationForm] = useState(SITE_IMPL_EMPTY);
  const [editingImplementation, setEditingImplementation] = useState(null);
  const [implementationDeleteId, setImplementationDeleteId] = useState(null);
  const [viewingImplementationId, setViewingImplementationId] = useState(null);
  const [focusFindingId, setFocusFindingId] = useState(null);
  const [implementationSearch, setImplementationSearch] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const { data: implementationDetail, isLoading: implementationDetailLoading } = useQuery({
    queryKey: ['site-controls-detail', viewingImplementationId],
    queryFn: () => api.siteControls.get(viewingImplementationId),
    enabled: Boolean(viewingImplementationId),
  });
  const controlsData = Array.isArray(data) ? data : [];
  const conmonActivities = Array.isArray(activities) ? activities : [];
  const catalogRows = Array.isArray(catalogDefinitions) ? catalogDefinitions : [];
  const implementationRows = Array.isArray(siteImplementations) ? siteImplementations : [];

  const create      = useMutation({ mutationFn: api.controls.create, onSuccess: () => { qc.invalidateQueries(['controls']); setModal(null); } });
  const update      = useMutation({ mutationFn: ({ id, d }) => api.controls.update(id, d), onSuccess: () => { qc.invalidateQueries(['controls']); qc.invalidateQueries(['conmon']); setModal(null); } });
  const remove      = useMutation({ mutationFn: api.controls.remove, onSuccess: () => { qc.invalidateQueries(['controls']); setDelId(null); } });
  const removeMany  = useMutation({
    mutationFn: api.controls.bulkDelete,
    onSuccess: () => {
      qc.invalidateQueries(['controls']);
      setSelectedIds([]);
      setBulkDeleteError('');
    },
    onError: err => {
      setBulkDeleteError(err?.response?.data?.error || err.message || 'Bulk delete failed.');
    },
  });
  const exportXlsx  = useMutation({ mutationFn: api.reports.controls, onSuccess: ({ blob, filename }) => triggerDownload(blob, filename) });
  const createCatalog = useMutation({
    mutationFn: api.controlCatalog.create,
    onSuccess: () => {
      qc.invalidateQueries(['control-catalog']);
      qc.invalidateQueries(['controls']);
      setCatalogModal(null);
      setEditingCatalog(null);
    },
  });
  const updateCatalog = useMutation({
    mutationFn: ({ id, d }) => api.controlCatalog.update(id, d),
    onSuccess: () => {
      qc.invalidateQueries(['control-catalog']);
      qc.invalidateQueries(['controls']);
      setCatalogModal(null);
      setEditingCatalog(null);
    },
  });
  const deleteCatalog = useMutation({
    mutationFn: api.controlCatalog.remove,
    onSuccess: () => {
      qc.invalidateQueries(['control-catalog']);
      qc.invalidateQueries(['controls']);
      setCatalogDeleteId(null);
    },
  });
  const deleteImplementation = useMutation({
    mutationFn: api.siteControls.remove,
    onSuccess: () => {
      qc.invalidateQueries(['site-controls']);
      qc.invalidateQueries(['controls']);
      if (viewingImplementationId === implementationDeleteId) setViewingImplementationId(null);
      setImplementationDeleteId(null);
    },
  });
  const syncSiteControls = useMutation({
    mutationFn: d => api.siteControls.syncFromCatalog(d),
    onSuccess: result => {
      qc.invalidateQueries(['site-controls']);
      qc.invalidateQueries(['controls']);
      setSelectedCatalogIds([]);
      setSyncMessage(`Synced ${result.created} controls to ${result.siteId}. Skipped ${result.skipped} existing records.`);
    },
  });
  const updateImplementation = useMutation({
    mutationFn: ({ id, d }) => api.siteControls.update(id, d),
    onSuccess: () => {
      qc.invalidateQueries(['site-controls']);
      qc.invalidateQueries(['controls']);
      if (viewingImplementationId) qc.invalidateQueries(['site-controls-detail', viewingImplementationId]);
      setImplementationModal(null);
      setEditingImplementation(null);
    },
  });
  const addImplementationFinding = useMutation({
    mutationFn: ({ id, d }) => api.siteControls.addFinding(id, d),
    onSuccess: () => {
      qc.invalidateQueries(['site-controls']);
      qc.invalidateQueries(['controls']);
      if (viewingImplementationId) qc.invalidateQueries(['site-controls-detail', viewingImplementationId]);
    },
  });
  const updateImplementationFinding = useMutation({
    mutationFn: ({ id, findingId, d }) => api.siteControls.updateFinding(id, findingId, d),
    onSuccess: () => {
      qc.invalidateQueries(['site-controls']);
      qc.invalidateQueries(['controls']);
      if (viewingImplementationId) qc.invalidateQueries(['site-controls-detail', viewingImplementationId]);
    },
  });
  const addImplementationEvidence = useMutation({
    mutationFn: ({ id, d }) => api.siteControls.addEvidence(id, d),
    onSuccess: () => {
      qc.invalidateQueries(['site-controls']);
      qc.invalidateQueries(['controls']);
      if (viewingImplementationId) qc.invalidateQueries(['site-controls-detail', viewingImplementationId]);
    },
  });
  const createImplementationFindingPoam = useMutation({
    mutationFn: ({ id, findingId, d }) => api.siteControls.createFindingPoam(id, findingId, d),
    onSuccess: () => {
      qc.invalidateQueries(['site-controls']);
      qc.invalidateQueries(['controls']);
      qc.invalidateQueries(['poam']);
      if (viewingImplementationId) qc.invalidateQueries(['site-controls-detail', viewingImplementationId]);
    },
  });

  const sorted = [...controlsData].sort((a, b) =>
    (a.control_id ?? a.id ?? '').localeCompare(b.control_id ?? b.id ?? '', undefined, { numeric: true, sensitivity: 'base' })
  );

  const filtered = sorted.filter(c => {
    const matchSearch = !search ||
      (c.control_id || c.id || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.conmon_group || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'All' || c.status === filterStatus;
    const matchConMon = filterConMon === 'All' || (c.conmon_status || 'Open') === filterConMon;
    return matchSearch && matchStatus && matchConMon;
  });

  useEffect(() => {
    setSelectedIds([]);
    setBulkDeleteError('');
  }, [siteScopeKey, search, filterStatus, filterConMon]);

  const filteredIds = filtered.map(row => row.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));

  function toggleSelectOne(id) {
    setBulkDeleteError('');
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleSelectAll() {
    setBulkDeleteError('');
    setSelectedIds(prev => {
      if (allFilteredSelected) return prev.filter(id => !filteredIds.includes(id));
      return [...new Set([...prev, ...filteredIds])];
    });
  }

  function resetErrors() {
    create.reset();
    update.reset();
  }

  function openCreate()  {
    if (!guardSiteScopedCreate({ user, selectedSite, entityLabel: 'control' })) return;
    resetErrors();
    setForm(EMPTY);
    setModal('create');
  }
  function openEdit(row) { resetErrors(); setForm(toFormState(row)); setEditing(row.id); setModal('edit'); }
  function openView(row) { setViewing(row); setModal('view'); }
  function handleSubmit(e) {
    e.preventDefault();
    if (modal === 'create') create.mutate(form);
    else update.mutate({ id: editing, d: form });
  }

  function openCatalogCreate() {
    if (!isHubAdmin && !guardSiteScopedCreate({ user, selectedSite, entityLabel: 'catalog control definition' })) return;
    createCatalog.reset();
    updateCatalog.reset();
    setCatalogForm({
      ...CATALOG_EMPTY,
      owner_type: isHubAdmin ? 'enterprise' : 'site',
      owner_site_id: selectedSite || '',
    });
    setEditingCatalog(null);
    setCatalogModal('create');
  }

  function openCatalogEdit(row) {
    createCatalog.reset();
    updateCatalog.reset();
    setCatalogForm(toCatalogFormState(row));
    setEditingCatalog(row.id);
    setCatalogModal('edit');
  }

  function handleCatalogSubmit(e) {
    e.preventDefault();
    const payload = {
      ...catalogForm,
      owner_site_id: catalogForm.owner_type === 'site'
        ? (catalogForm.owner_site_id || selectedSite || '')
        : null,
    };
    if (catalogModal === 'create') createCatalog.mutate(payload);
    else updateCatalog.mutate({ id: editingCatalog, d: payload });
  }

  function openImplementationEdit(row) {
    updateImplementation.reset();
    setImplementationForm(toImplementationFormState(row));
    setEditingImplementation(row);
    setImplementationModal('edit');
  }

  function openImplementationView(row) {
    addImplementationFinding.reset();
    updateImplementationFinding.reset();
    addImplementationEvidence.reset();
    createImplementationFindingPoam.reset();
    setViewingImplementationId(row.id);
  }

  useEffect(() => {
    if (!implementationRows.length) return;
    const params = new URLSearchParams(window.location.search);
    const findingId = params.get('findingId');
    if (!findingId) return;
    const matchedRow = implementationRows.find(row =>
      Array.isArray(row.findingsRecords) && row.findingsRecords.some(finding => finding.id === findingId)
    );
    if (!matchedRow) return;
    setSurface('implementations');
    setFocusFindingId(findingId);
    openImplementationView(matchedRow);
    params.delete('findingId');
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
    window.history.replaceState({}, '', nextUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [implementationRows]);

  useEffect(() => {
    setSelectedCatalogIds([]);
  }, [siteScopeKey, catalogSearch]);

  function handleImplementationSubmit(e) {
    e.preventDefault();
    updateImplementation.mutate({ id: editingImplementation.id, d: implementationForm });
  }

  function handleSyncFromCatalog() {
    if (!guardSiteScopedCreate({ user, selectedSite, entityLabel: 'site control implementation' })) return;
    setSyncMessage('');
    syncSiteControls.reset();
    syncSiteControls.mutate({ siteId: selectedSite, ownerScope: 'all' });
  }

  function handleSyncSelectedCatalog() {
    if (!guardSiteScopedCreate({ user, selectedSite, entityLabel: 'site control implementation' })) return;
    if (!selectedCatalogIds.length) return;
    setSyncMessage('');
    syncSiteControls.reset();
    syncSiteControls.mutate({ siteId: selectedSite, ownerScope: 'all', controlCatalogIds: selectedCatalogIds });
  }

  function toggleCatalogSelectOne(id) {
    setSelectedCatalogIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleCatalogSelectAll() {
    setSelectedCatalogIds(prev => {
      if (allFilteredCatalogSelected) return prev.filter(id => !filteredCatalogIds.includes(id));
      return [...new Set([...prev, ...filteredCatalogIds])];
    });
  }

  const cols = [
    {
      key: '_select',
      label: (
        <input
          type="checkbox"
          checked={allFilteredSelected}
          onChange={toggleSelectAll}
          onClick={e => e.stopPropagation()}
          aria-label="Select all controls"
        />
      ),
      width: 44,
      render: (_, row) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(row.id)}
          onChange={() => toggleSelectOne(row.id)}
          onClick={e => e.stopPropagation()}
          aria-label={`Select ${row.id}`}
        />
      ),
    },
    { key: 'control_id',     label: 'ID',     width: 100,
      render: v => <span className="font-mono text-scorva-accent-light text-xs">{v}</span> },
    ...(showSiteContext ? [{
      key: '_site',
      label: 'Site',
      width: 110,
      render: (_, row) => <span className="font-mono text-xs text-scorva-accent-light">{getRecordSiteLabel(row)}</span>,
    }] : []),
    { key: 'title',  label: 'Title', width: 320 },
    { key: 'family', label: 'Family', width: 160 },
    { key: 'conmon_group', label: 'ConMon Group', width: 180,
      render: v => <span className="text-xs text-scorva-muted">{v || '—'}</span> },
    { key: 'conmon_frequency', label: 'Frequency', width: 90,
      render: v => <span className="text-xs text-scorva-muted">{v || '—'}</span> },
    { key: 'conmon_status', label: 'ConMon Status', width: 120,
      render: v => <Badge label={v || 'Open'} /> },
    { key: 'last_review', label: 'Last Completed', width: 120,
      render: v => <span className="font-mono text-xs text-scorva-muted">{v || '—'}</span> },
    { key: 'status', label: 'Impl. Status', render: v => <Badge label={v} /> },
    { key: '_actions', label: '', render: (_, row) => (
      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        <button className="p-1.5 rounded text-scorva-muted hover:text-scorva-accent hover:bg-scorva-hover" onClick={() => openEdit(row)}><Pencil size={13} /></button>
        <button className="p-1.5 rounded text-scorva-muted hover:text-red-400 hover:bg-scorva-hover"  onClick={() => setDelId(row.id)}><Trash2 size={13} /></button>
      </div>
    )},
  ];

  const mutationError = create.error?.response?.data?.error || update.error?.response?.data?.error || create.error?.message || update.error?.message;
  const catalogMutationError = createCatalog.error?.response?.data?.error || updateCatalog.error?.response?.data?.error || createCatalog.error?.message || updateCatalog.error?.message;
  const implementationMutationError = updateImplementation.error?.response?.data?.error || updateImplementation.error?.message;
  const implementationWorkspaceError =
    addImplementationFinding.error?.response?.data?.error ||
    updateImplementationFinding.error?.response?.data?.error ||
    addImplementationEvidence.error?.response?.data?.error ||
    createImplementationFindingPoam.error?.response?.data?.error ||
    addImplementationFinding.error?.message ||
    updateImplementationFinding.error?.message ||
    addImplementationEvidence.error?.message ||
    createImplementationFindingPoam.error?.message;

  const implemented = controlsData.filter(r => r.status === 'Implemented').length;
  const partial     = controlsData.filter(r => r.status === 'Partially Implemented').length;
  const notImpl     = controlsData.filter(r => r.status === 'Not Implemented').length;
  const compliant   = controlsData.filter(r => (r.conmon_status || 'Open') === 'Compliant').length;
  const findings    = controlsData.reduce((s, r) => s + (r.findings || 0), 0);
  const implPct     = controlsData.length ? Math.round((implemented / controlsData.length) * 100) : 0;
  const filteredCatalog = catalogRows.filter(row => {
    if (!catalogSearch) return true;
    const q = catalogSearch.toLowerCase();
    return (
      (row.controlKey || row.control_key || '').toLowerCase().includes(q) ||
      (row.title || '').toLowerCase().includes(q) ||
      (row.family || '').toLowerCase().includes(q) ||
      (row.source || '').toLowerCase().includes(q)
    );
  });
  const filteredImplementations = implementationRows.filter(row => {
    if (!implementationSearch) return true;
    const q = implementationSearch.toLowerCase();
    const catalog = row.controlCatalog || {};
    return (
      (catalog.controlKey || '').toLowerCase().includes(q) ||
      (catalog.title || '').toLowerCase().includes(q) ||
      (catalog.family || '').toLowerCase().includes(q) ||
      (row.assigned_to || '').toLowerCase().includes(q) ||
      (row.notes || '').toLowerCase().includes(q)
    );
  });
  const filteredCatalogIds = filteredCatalog.map(row => row.id);
  const allFilteredCatalogSelected = filteredCatalogIds.length > 0 && filteredCatalogIds.every(id => selectedCatalogIds.includes(id));
  if (isLoading) return <LoadingSpinner />;
  if (isError) {
    return <div className="text-sm text-red-400">Failed to load Controls data: {error?.response?.data?.error || error?.message || 'Unknown error'}</div>;
  }
  const catalogCols = [
    {
      key: '_select',
      label: (
        <input
          type="checkbox"
          checked={allFilteredCatalogSelected}
          onChange={toggleCatalogSelectAll}
          onClick={e => e.stopPropagation()}
          aria-label="Select all catalog definitions"
        />
      ),
      width: 44,
      render: (_, row) => (
        <input
          type="checkbox"
          checked={selectedCatalogIds.includes(row.id)}
          onChange={() => toggleCatalogSelectOne(row.id)}
          onClick={e => e.stopPropagation()}
          aria-label={`Select catalog ${row.controlKey || row.id}`}
        />
      ),
    },
    { key: 'controlKey', label: 'Key', width: 110, render: v => <span className="font-mono text-scorva-accent-light text-xs">{v}</span> },
    ...(showSiteContext ? [{
      key: '_scope',
      label: 'Scope',
      width: 120,
      render: (_, row) => (
        <span className="text-xs text-scorva-muted">
          {row.owner_type === 'site' ? (row.owner_site_id || 'Site') : 'Enterprise'}
        </span>
      ),
    }] : []),
    { key: 'title', label: 'Title', width: 320 },
    { key: 'family', label: 'Family', width: 180 },
    { key: 'baseline', label: 'Baseline', width: 100, render: v => <span className="text-xs text-scorva-muted">{v || '—'}</span> },
    { key: 'source', label: 'Source', width: 200, render: v => <span className="text-xs text-scorva-muted">{v || '—'}</span> },
    { key: '_actions', label: '', width: 132, render: (_, row) => (
      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        <button
          className="p-1.5 rounded text-scorva-muted hover:text-scorva-accent hover:bg-scorva-hover"
          onClick={() => {
            if (!guardSiteScopedCreate({ user, selectedSite, entityLabel: 'site control implementation' })) return;
            setSyncMessage('');
            syncSiteControls.reset();
            syncSiteControls.mutate({ siteId: selectedSite, ownerScope: 'all', controlCatalogIds: [row.id] });
          }}
          title="Sync this definition into the active site"
        >
          <RefreshCw size={13} />
        </button>
        <button className="p-1.5 rounded text-scorva-muted hover:text-scorva-accent hover:bg-scorva-hover" onClick={() => openCatalogEdit(row)}><Pencil size={13} /></button>
        <button className="p-1.5 rounded text-scorva-muted hover:text-red-400 hover:bg-scorva-hover" onClick={() => setCatalogDeleteId(row.id)}><Trash2 size={13} /></button>
      </div>
    )},
  ];
  const implementationCols = [
    { key: '_control', label: 'Control', width: 140, render: (_, row) => <span className="font-mono text-scorva-accent-light text-xs">{row.controlCatalog?.controlKey || '—'}</span> },
    ...(showSiteContext ? [{
      key: '_site',
      label: 'Site',
      width: 110,
      render: (_, row) => <span className="font-mono text-xs text-scorva-accent-light">{getRecordSiteLabel(row)}</span>,
    }] : []),
    { key: '_title', label: 'Title', width: 320, render: (_, row) => row.controlCatalog?.title || 'Untitled control' },
    { key: '_family', label: 'Family', width: 180, render: (_, row) => row.controlCatalog?.family || '—' },
    { key: 'status', label: 'Impl. Status', width: 170, render: v => <Badge label={v} /> },
    { key: 'conmon_status', label: 'ConMon', width: 120, render: v => <Badge label={v || 'Open'} /> },
    { key: 'findingsRecords', label: 'Findings', width: 90, render: v => <span className="text-xs text-scorva-muted">{Array.isArray(v) ? v.length : 0}</span> },
    { key: 'last_review', label: 'Last Review', width: 120, render: v => <span className="font-mono text-xs text-scorva-muted">{v || '—'}</span> },
    { key: '_actions', label: '', width: 96, render: (_, row) => (
      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        <button className="p-1.5 rounded text-scorva-muted hover:text-scorva-accent hover:bg-scorva-hover" onClick={() => openImplementationEdit(row)}><Pencil size={13} /></button>
        <button className="p-1.5 rounded text-scorva-muted hover:text-red-400 hover:bg-scorva-hover" onClick={() => setImplementationDeleteId(row.id)}><Trash2 size={13} /></button>
      </div>
    )},
  ];
  const headerAction = surface === 'legacy' ? (
    <div className="flex gap-2">
      <button className="btn-secondary flex items-center gap-1.5" onClick={() => setImportOpen(true)}>
        <Upload size={14} /> Import
      </button>
      <button className="btn-secondary flex items-center gap-1.5" onClick={() => exportXlsx.mutate()} disabled={exportXlsx.isPending} title="Export controls to Excel">
        <Download size={14} className={exportXlsx.isPending ? 'animate-pulse' : ''} /> Export
      </button>
      <button className="btn-primary flex items-center gap-1.5" onClick={openCreate}>
        <Plus size={15} /> Add Control
      </button>
    </div>
  ) : surface === 'catalog' ? (
    <div className="flex gap-2">
      <button className="btn-secondary flex items-center gap-1.5" onClick={handleSyncFromCatalog} disabled={syncSiteControls.isPending}>
        <RefreshCw size={14} className={syncSiteControls.isPending ? 'animate-spin' : ''} /> Sync To Site
      </button>
      <button className="btn-primary flex items-center gap-1.5" onClick={openCatalogCreate}>
        <Plus size={15} /> Add Definition
      </button>
    </div>
  ) : (
    <div className="flex gap-2">
      <button className="btn-secondary flex items-center gap-1.5" onClick={handleSyncFromCatalog} disabled={syncSiteControls.isPending}>
        <Link2 size={14} className={syncSiteControls.isPending ? 'animate-pulse' : ''} /> Sync Missing Controls
      </button>
    </div>
  );

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Authorization', to: '/ato' }, { label: 'Controls' }]}
        title="Control Library"
        description={`${controlsData.length} controls · NIST SP 800-53 Rev 5`}
        action={headerAction}
      />
      <ControlsSurfaceTabs active={surface} onChange={setSurface} />
      {needsExplicitSite && (
        <div className="mx-4 mt-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/25 text-yellow-600 dark:text-yellow-400 text-sm">
          Select a site from the header before creating a new control.
        </div>
      )}

      <StatusDashboard>
        <div className="flex flex-wrap gap-6 items-start">
          <DonutChart
            label={`${implPct}%`}
            sublabel="implemented"
            segments={[
              { label: 'Implemented', value: implemented, color: 'green'  },
              { label: 'Partial',     value: partial,     color: 'yellow' },
              { label: 'Not Impl.',   value: notImpl,     color: 'red'    },
            ]}
          />
          <div className="flex-1 min-w-[180px]">
            <BarList
              title="Implementation Status"
              bars={[
                { label: 'Implemented', value: implemented, color: 'green'  },
                { label: 'Partial',     value: partial,     color: 'yellow' },
                { label: 'Not Impl.',   value: notImpl,     color: 'red'    },
              ]}
            />
          </div>
          <StatTile label="Total Controls"  value={data.length} />
          <StatTile label="ConMon Compliant" value={compliant} color={compliant > 0 ? 'green' : 'default'} />
          <StatTile label="Total Findings"  value={findings}  color={findings > 0 ? 'red' : 'green'} />
        </div>
      </StatusDashboard>

      {surface === 'legacy' && (
      <>
      <div className="sc-workbar mt-6 mb-4">
        <div className="sc-workbar-meta">
          <span className="sc-workbar-pill">{filtered.length} visible</span>
          <span className="sc-workbar-pill">{selectedIds.length} selected</span>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-scorva-muted" />
          <input className="input-base pl-9" placeholder="Search controls..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button
          className="btn-secondary flex items-center gap-1.5 text-red-400 border-red-500/30 hover:border-red-500/50"
          disabled={!selectedIds.length || removeMany.isPending}
          onClick={() => setShowBulkDeleteConfirm(true)}
        >
          <Trash2 size={14} /> {removeMany.isPending ? 'Deleting…' : `Delete Selected${selectedIds.length ? ` (${selectedIds.length})` : ''}`}
        </button>
        <select className="input-base w-48" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          {['All','Not Implemented','Partially Implemented','Implemented'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="input-base w-44" value={filterConMon} onChange={e => setFilterConMon(e.target.value)}>
          {['All','Open','Compliant','POA&M'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      {bulkDeleteError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {bulkDeleteError}
        </div>
      )}
      <div className="sc-surface-block">
        <Table
          columns={cols}
          data={filtered}
          onRowClick={openView}
          getRowClass={getControlRowClass}
          emptyText="No controls match your filters."
          minWidth={1420}
        />
      </div>
      </>
      )}

      {surface === 'catalog' && (
        <>
          <div className="sc-workbar mt-6 mb-4">
            <div className="sc-workbar-meta">
              <span className="sc-workbar-pill">{filteredCatalog.length} definitions</span>
              <span className="sc-workbar-pill">{catalogRows.filter(row => row.owner_type === 'enterprise').length} enterprise</span>
              <span className="sc-workbar-pill">{selectedCatalogIds.length} selected</span>
            </div>
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-scorva-muted" />
              <input className="input-base pl-9" placeholder="Search definitions..." value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} />
            </div>
            <button
              className="btn-secondary flex items-center gap-1.5"
              onClick={handleSyncSelectedCatalog}
              disabled={!selectedCatalogIds.length || syncSiteControls.isPending}
            >
              <Link2 size={14} className={syncSiteControls.isPending ? 'animate-pulse' : ''} />
              Sync Selected{selectedCatalogIds.length ? ` (${selectedCatalogIds.length})` : ''}
            </button>
          </div>
          {syncMessage && (
            <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-300">
              {syncMessage}
            </div>
          )}
          <div className="sc-surface-block">
            {catalogLoading ? (
              <LoadingSpinner />
            ) : (
              <Table columns={catalogCols} data={filteredCatalog} emptyText="No catalog definitions found." minWidth={1180} />
            )}
          </div>
        </>
      )}

      {surface === 'implementations' && (
        <>
          <div className="sc-workbar mt-6 mb-4">
            <div className="sc-workbar-meta">
              <span className="sc-workbar-pill">{filteredImplementations.length} implementations</span>
              <span className="sc-workbar-pill">{implementationRows.filter(row => row.status === 'Implemented').length} implemented</span>
            </div>
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-scorva-muted" />
              <input className="input-base pl-9" placeholder="Search implementations..." value={implementationSearch} onChange={e => setImplementationSearch(e.target.value)} />
            </div>
          </div>
          {syncMessage && (
            <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-300">
              {syncMessage}
            </div>
          )}
          <div className="sc-surface-block">
            {implementationLoading ? (
              <LoadingSpinner />
            ) : (
              <Table
                columns={implementationCols}
                data={filteredImplementations}
                onRowClick={openImplementationView}
                emptyText="No site implementations found."
                minWidth={1280}
              />
            )}
          </div>
        </>
      )}

      {/* View Modal */}
      {modal === 'view' && viewing && (
        <Modal title={`${viewing.control_id || viewing.id} — ${viewing.title}`} onClose={() => setModal(null)} size="lg">
          <ControlDetail control={viewing} activities={conmonActivities} />
          <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-scorva-border">
            <button className="btn-secondary" onClick={() => openEdit(viewing)}>Edit</button>
            <button className="btn-primary"   onClick={() => setModal(null)}>Close</button>
          </div>
        </Modal>
      )}

      {/* Create / Edit Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Add Control' : 'Edit Control'} onClose={() => setModal(null)} size="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <ControlForm value={form} onChange={setForm} isNew={modal === 'create'} />
            {modal === 'edit' && editing && (
              <EvidencePanel resourceType="control" resourceId={editing} />
            )}
            {mutationError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {mutationError}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>Save</button>
            </div>
          </form>
        </Modal>
      )}

      {delId && <ConfirmDialog title="Delete Control" message="This cannot be undone." onConfirm={() => remove.mutate(delId)} onCancel={() => setDelId(null)} />}
      {catalogDeleteId && (
        <ConfirmDialog
          title="Delete Catalog Definition"
          message="This will remove the selected catalog definition. Existing site implementation records will remain unless separately removed."
          onConfirm={() => deleteCatalog.mutate(catalogDeleteId)}
          onCancel={() => setCatalogDeleteId(null)}
        />
      )}
      {implementationDeleteId && (
        <ConfirmDialog
          title="Delete Site Implementation"
          message="This removes the selected site implementation, including its findings and evidence references. The catalog definition will remain available for future re-sync."
          onConfirm={() => deleteImplementation.mutate(implementationDeleteId)}
          onCancel={() => setImplementationDeleteId(null)}
        />
      )}
      {showBulkDeleteConfirm && (
        <ConfirmDialog
          title="Delete Selected Controls"
          message={`This will permanently remove ${selectedIds.length} selected control${selectedIds.length === 1 ? '' : 's'}. This cannot be undone.`}
          onConfirm={() => {
            setShowBulkDeleteConfirm(false);
            removeMany.mutate(selectedIds);
          }}
          onCancel={() => setShowBulkDeleteConfirm(false)}
        />
      )}

      {importOpen && (
        <ImportControlsModal
          currentCount={data.length}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            qc.invalidateQueries(['controls']);
            qc.invalidateQueries(['control-catalog']);
            qc.invalidateQueries(['site-controls']);
          }}
        />
      )}

      {(catalogModal === 'create' || catalogModal === 'edit') && (
        <Modal title={catalogModal === 'create' ? 'Add Catalog Definition' : 'Edit Catalog Definition'} onClose={() => setCatalogModal(null)} size="lg">
          <form onSubmit={handleCatalogSubmit} className="space-y-4">
            <CatalogDefinitionForm
              value={catalogForm}
              onChange={setCatalogForm}
              isHubAdmin={isHubAdmin}
              selectedSite={selectedSite}
              showSiteContext={showSiteContext}
            />
            {catalogMutationError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {catalogMutationError}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setCatalogModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={createCatalog.isPending || updateCatalog.isPending}>Save</button>
            </div>
          </form>
        </Modal>
      )}

      {implementationModal === 'edit' && editingImplementation && (
        <Modal
          title={`Edit Site Implementation — ${editingImplementation.controlCatalog?.controlKey || editingImplementation.id}`}
          onClose={() => setImplementationModal(null)}
          size="lg"
        >
          <form onSubmit={handleImplementationSubmit} className="space-y-4">
            <SiteImplementationForm
              value={implementationForm}
              onChange={setImplementationForm}
              controlLabel={`${editingImplementation.controlCatalog?.controlKey || 'Control'} — ${editingImplementation.controlCatalog?.title || 'Untitled control'}`}
            />
            {implementationMutationError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {implementationMutationError}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setImplementationModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={updateImplementation.isPending}>Save</button>
            </div>
          </form>
        </Modal>
      )}

      {viewingImplementationId && (
        <Modal
          title={implementationDetail?.controlCatalog?.controlKey
            ? `Site Implementation — ${implementationDetail.controlCatalog.controlKey}`
            : 'Site Implementation'}
          onClose={() => setViewingImplementationId(null)}
          size="xl"
        >
          {implementationDetailLoading || !implementationDetail ? (
            <LoadingSpinner />
          ) : (
            <SiteImplementationWorkspace
              detail={implementationDetail}
              onClose={() => setViewingImplementationId(null)}
              onEdit={() => {
                setViewingImplementationId(null);
                openImplementationEdit(implementationDetail);
              }}
              onAddFinding={(payload, onDone) => {
                addImplementationFinding.mutate(
                  { id: implementationDetail.id, d: payload },
                  { onSuccess: () => onDone?.() }
                );
              }}
              onUpdateFinding={(findingId, payload) => {
                updateImplementationFinding.mutate({ id: implementationDetail.id, findingId, d: payload });
              }}
              onCreateFindingPoam={(findingId, payload) => {
                createImplementationFindingPoam.mutate({ id: implementationDetail.id, findingId, d: payload });
              }}
              onAddEvidence={(payload, onDone) => {
                addImplementationEvidence.mutate(
                  { id: implementationDetail.id, d: payload },
                  { onSuccess: () => onDone?.() }
                );
              }}
              addFindingPending={addImplementationFinding.isPending}
              addEvidencePending={addImplementationEvidence.isPending}
              updateFindingPendingId={updateImplementationFinding.isPending ? updateImplementationFinding.variables?.findingId : null}
              createFindingPoamPendingId={createImplementationFindingPoam.isPending ? createImplementationFindingPoam.variables?.findingId : null}
              focusFindingId={focusFindingId}
              mutationError={implementationWorkspaceError}
            />
          )}
        </Modal>
      )}
    </div>
  );
}
