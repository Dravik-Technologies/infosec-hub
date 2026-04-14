import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ArrowLeft, Save, Plus, Trash2, ExternalLink, Info } from 'lucide-react'
import { useSystemStore } from '@/store/systemStore'
import { useSCTMStore } from '@/store/sctmStore'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select, Input } from '@/components/ui/Input'
import TipTapEditor from '@/components/editor/TipTapEditor'
import { getControlStatusColor, generateId, today, formatDate } from '@/lib/utils'
import { getControlById } from '@/data/controls'
import type { ControlStatus, ImplementationOrigin, EvidenceLink } from '@/types'
import { cn } from '@/lib/cn'

const STATUSES: ControlStatus[] = [
  'Implemented', 'Partially Implemented', 'Planned',
  'Not Implemented', 'Not Applicable', 'Inherited', 'Under Review',
]

const ORIGINS: ImplementationOrigin[] = [
  'System Specific', 'Inherited', 'Hybrid', 'Common',
]

type TabId = 'implementation' | 'assessor' | 'evidence' | 'control-info'

export default function ControlDetailPage() {
  const { systemId, controlId } = useParams<{ systemId: string; controlId: string }>()
  const navigate = useNavigate()
  const system = useSystemStore((s) => s.getSystemById(systemId!))
  const entry = useSCTMStore((s) => s.getEntry(systemId!, controlId!))
  const updateEntry = useSCTMStore((s) => s.updateEntry)

  const control = getControlById(controlId!)

  const [activeTab, setActiveTab] = useState<TabId>('implementation')
  const [status, setStatus] = useState<ControlStatus>(entry?.status ?? 'Not Implemented')
  const [origin, setOrigin] = useState<ImplementationOrigin>(entry?.implementationOrigin ?? 'System Specific')
  const [responsibleRole, setResponsibleRole] = useState(entry?.responsibleRole ?? '')
  const [implementation, setImplementation] = useState(entry?.implementationStatement ?? '')
  const [assessorNotes, setAssessorNotes] = useState(entry?.assessorNotes ?? '')
  const [evidenceLinks, setEvidenceLinks] = useState<EvidenceLink[]>(entry?.evidenceLinks ?? [])
  const [inheritedFrom, setInheritedFrom] = useState(entry?.inheritedFrom ?? '')
  const [targetDate, setTargetDate] = useState(entry?.targetCompletionDate ?? '')
  const [saved, setSaved] = useState(false)

  // New evidence form
  const [newEvidenceLabel, setNewEvidenceLabel] = useState('')
  const [newEvidenceUrl, setNewEvidenceUrl] = useState('')

  useEffect(() => {
    if (entry) {
      setStatus(entry.status)
      setOrigin(entry.implementationOrigin)
      setResponsibleRole(entry.responsibleRole)
      setImplementation(entry.implementationStatement)
      setAssessorNotes(entry.assessorNotes)
      setEvidenceLinks(entry.evidenceLinks)
      setInheritedFrom(entry.inheritedFrom ?? '')
      setTargetDate(entry.targetCompletionDate ?? '')
    }
  }, [controlId]) // reload when navigating to different control

  function handleSave() {
    updateEntry(systemId!, controlId!, {
      status,
      implementationOrigin: origin,
      responsibleRole,
      implementationStatement: implementation,
      assessorNotes,
      evidenceLinks,
      inheritedFrom: inheritedFrom || null,
      targetCompletionDate: targetDate || null,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function addEvidence() {
    if (!newEvidenceLabel.trim()) return
    const link: EvidenceLink = {
      id: generateId(),
      label: newEvidenceLabel.trim(),
      url: newEvidenceUrl.trim(),
      addedAt: today(),
    }
    setEvidenceLinks((prev) => [...prev, link])
    setNewEvidenceLabel('')
    setNewEvidenceUrl('')
  }

  function removeEvidence(id: string) {
    setEvidenceLinks((prev) => prev.filter((e) => e.id !== id))
  }

  if (!control) {
    return <div className="p-8 text-slate-400">Control not found.</div>
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'implementation', label: 'Implementation' },
    { id: 'assessor', label: 'Assessor Notes' },
    { id: 'evidence', label: `Evidence (${evidenceLinks.length})` },
    { id: 'control-info', label: 'Control Info' },
  ]

  return (
    <div className="min-h-full flex flex-col">
      {/* Header */}
      <div
        className="px-8 py-4 border-b"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate(`/systems/${systemId}/sctm`)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to SCTM
          </button>
          <span className="text-slate-600">·</span>
          <span className="text-xs text-slate-500">{system?.name}</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-lg font-bold text-teal-400">{controlId}</span>
              <Badge className={cn('text-[11px]', getControlStatusColor(status))}>{status}</Badge>
            </div>
            <h1 className="text-base font-semibold text-slate-100">{control.title}</h1>
            <div className="text-xs text-slate-500 mt-0.5">{control.family} family · Last updated {formatDate(entry?.updatedAt ?? '')}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saved && <span className="text-xs text-teal-400">Saved ✓</span>}
            <Button variant="primary" size="sm" icon={<Save className="w-3.5 h-3.5" />} onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* Meta controls */}
      <div
        className="px-8 py-4 border-b grid grid-cols-2 lg:grid-cols-4 gap-4"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-slate-400">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ControlStatus)}
            className={cn(
              'h-8 px-2 text-xs rounded-lg border bg-navy-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/50',
              getControlStatusColor(status)
            )}
            style={{ borderColor: 'var(--color-border)' }}
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-slate-400">Origin</label>
          <select
            value={origin}
            onChange={(e) => setOrigin(e.target.value as ImplementationOrigin)}
            className="h-8 px-2 text-xs rounded-lg border bg-navy-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {ORIGINS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <Input
          label="Responsible Role"
          value={responsibleRole}
          onChange={(e) => setResponsibleRole(e.target.value)}
          placeholder="e.g. System Administrator"
          className="h-8 text-xs"
        />
        <Input
          label="Target Completion"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      {origin === 'Inherited' && (
        <div
          className="px-8 py-3 border-b"
          style={{ background: 'rgba(168, 85, 247, 0.05)', borderColor: 'var(--color-border)' }}
        >
          <Input
            label="Inherited From (System Name)"
            value={inheritedFrom}
            onChange={(e) => setInheritedFrom(e.target.value)}
            placeholder="e.g. Enterprise Active Directory"
            className="h-8 text-xs max-w-sm"
          />
        </div>
      )}

      {/* Tabs */}
      <div
        className="px-8 border-b flex items-center gap-0"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-3 text-xs font-medium border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-teal-500 text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 p-8">
        {activeTab === 'implementation' && (
          <div className="max-w-4xl">
            <div className="mb-3">
              <h3 className="text-sm font-medium text-slate-200 mb-1">Implementation Statement</h3>
              <p className="text-xs text-slate-400">Describe how this control is implemented in the system. This text will appear in the SSP.</p>
            </div>
            <TipTapEditor
              value={implementation}
              onChange={setImplementation}
              placeholder="Describe the implementation approach, responsible parties, frequency of review, and any compensating controls..."
              minHeight="200px"
            />
          </div>
        )}

        {activeTab === 'assessor' && (
          <div className="max-w-4xl">
            <div className="mb-3">
              <h3 className="text-sm font-medium text-slate-200 mb-1">Assessor Notes</h3>
              <p className="text-xs text-slate-400">Assessment findings, testing notes, and recommendations from the assessor.</p>
            </div>
            <TipTapEditor
              value={assessorNotes}
              onChange={setAssessorNotes}
              placeholder="Document assessment findings, test results, and any observations..."
              minHeight="200px"
            />
          </div>
        )}

        {activeTab === 'evidence' && (
          <div className="max-w-2xl">
            <div className="mb-4">
              <h3 className="text-sm font-medium text-slate-200 mb-1">Evidence Links</h3>
              <p className="text-xs text-slate-400">Link to artifacts, screenshots, policies, or other evidence supporting this control.</p>
            </div>

            {evidenceLinks.length > 0 && (
              <div
                className="rounded-lg border mb-4 divide-y"
                style={{ borderColor: 'var(--color-border)', borderSpacing: 0 }}
              >
                {evidenceLinks.map((link) => (
                  <div key={link.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200 font-medium">{link.label}</div>
                      {link.url && (
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-teal-400 hover:underline flex items-center gap-1 mt-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {link.url}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <div className="text-[11px] text-slate-500 mt-0.5">Added {formatDate(link.addedAt)}</div>
                    </div>
                    <button
                      onClick={() => removeEvidence(link.id)}
                      className="p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div
              className="rounded-lg border p-4"
              style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
            >
              <div className="text-xs font-medium text-slate-400 mb-3">Add Evidence</div>
              <div className="flex flex-col gap-3">
                <Input
                  label="Label / Description"
                  value={newEvidenceLabel}
                  onChange={(e) => setNewEvidenceLabel(e.target.value)}
                  placeholder="e.g. Password Policy Document"
                />
                <Input
                  label="URL (optional)"
                  value={newEvidenceUrl}
                  onChange={(e) => setNewEvidenceUrl(e.target.value)}
                  placeholder="https://..."
                />
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={addEvidence}
                  disabled={!newEvidenceLabel.trim()}
                >
                  Add Evidence
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'control-info' && (
          <div className="max-w-3xl">
            <div
              className="rounded-lg border p-5 mb-5"
              style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-teal-400" />
                <span className="text-sm font-semibold text-slate-200">Control Statement</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{control.description}</p>
            </div>

            {control.supplementalGuidance && (
              <div
                className="rounded-lg border p-5 mb-5"
                style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Supplemental Guidance</div>
                <p className="text-sm text-slate-400 leading-relaxed">{control.supplementalGuidance}</p>
              </div>
            )}

            {control.relatedControls.length > 0 && (
              <div
                className="rounded-lg border p-5 mb-5"
                style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Related Controls</div>
                <div className="flex flex-wrap gap-2">
                  {control.relatedControls.map((id) => (
                    <button
                      key={id}
                      onClick={() => navigate(`/systems/${systemId}/sctm/${id}`)}
                      className="font-mono text-xs px-2 py-1 rounded border text-teal-400 border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 transition-colors"
                    >
                      {id}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {control.enhancements.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Control Enhancements</div>
                <div className="flex flex-col gap-3">
                  {control.enhancements.map((enh) => (
                    <div
                      key={enh.id}
                      className="rounded-lg border p-4"
                      style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-xs font-bold text-teal-400">{enh.id}</span>
                        <span className="text-xs font-medium text-slate-200">{enh.title}</span>
                        <div className="ml-auto flex gap-1">
                          {enh.lowBaseline && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20">LOW</span>}
                          {enh.moderateBaseline && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">MOD</span>}
                          {enh.highBaseline && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">HIGH</span>}
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{enh.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
