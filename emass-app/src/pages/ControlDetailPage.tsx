import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Save, Plus, Trash2, ExternalLink, Info, CheckCircle2, ClipboardCheck, Shield } from 'lucide-react'
import { useSystemStore } from '@/store/systemStore'
import { useSCTMStore } from '@/store/sctmStore'
import { useProjectControlsStore } from '@/store/projectControlsStore'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select, Input } from '@/components/ui/Input'
import TipTapEditor from '@/components/editor/TipTapEditor'
import DeltaEditor from '@/components/rmf/DeltaEditor'
import RMFStepper from '@/components/rmf/RMFStepper'
import { getControlStatusColor, generateId, today, formatDate } from '@/lib/utils'
import { getControlById } from '@/data/controls'
import { getStandardImplementation, controlNeedsTailoring } from '@/lib/hydration'
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

const tabVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 20 : -20, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -20 : 20, opacity: 0 }),
}

export default function ControlDetailPage() {
  const { systemId, controlId } = useParams<{ systemId: string; controlId: string }>()
  const navigate = useNavigate()
  const system = useSystemStore((s) => s.getSystemById(systemId!))
  const entry = useSCTMStore((s) => s.getEntry(systemId!, controlId!))
  const updateEntry = useSCTMStore((s) => s.updateEntry)

  const control = getControlById(controlId!)
  const standardText = getStandardImplementation(controlId!)
  const needsTailoring = controlNeedsTailoring(controlId!)

  // PostgreSQL project control (assessor workflow)
  const user = useAuthStore(s => s.user)
  const projectControls = useProjectControlsStore(s => s.getControlsForSystem(systemId!))
  const signOffControl = useProjectControlsStore(s => s.signOffControl)
  const updatePgControl = useProjectControlsStore(s => s.updateControl)
  const fetchControls = useProjectControlsStore(s => s.fetchControlsForSystem)
  const pgControl = projectControls.find(c => c.controlId === controlId)
  const [signingOff, setSigningOff] = useState(false)
  const [markingReady, setMarkingReady] = useState(false)

  useEffect(() => { fetchControls(systemId!) }, [systemId, fetchControls])

  async function handleMarkReadyForAudit() {
    if (!pgControl) return
    setMarkingReady(true)
    try {
      await updatePgControl(systemId!, controlId!, { status: 'READY_FOR_AUDIT' })
      setStatus('Under Review')
      handleSave()
    } finally {
      setMarkingReady(false)
    }
  }

  async function handleValidate() {
    if (!pgControl) return
    setSigningOff(true)
    try {
      const name = (user as any)?.name ?? (user as any)?.username ?? 'Assessor'
      await signOffControl(systemId!, controlId!, name)
      setStatus('Implemented')
      handleSave()
    } finally {
      setSigningOff(false)
    }
  }

  const [activeTab, setActiveTab] = useState<TabId>('implementation')
  const [tabDir, setTabDir] = useState(1)
  const [status, setStatus] = useState<ControlStatus>(entry?.status ?? 'Not Implemented')
  const [origin, setOrigin] = useState<ImplementationOrigin>(entry?.implementationOrigin ?? 'System Specific')
  const [responsibleRole, setResponsibleRole] = useState(entry?.responsibleRole ?? '')
  const [implementation, setImplementation] = useState(entry?.implementationStatement ?? '')
  const [assessorNotes, setAssessorNotes] = useState(entry?.assessorNotes ?? '')
  const [evidenceLinks, setEvidenceLinks] = useState<EvidenceLink[]>(entry?.evidenceLinks ?? [])
  const [inheritedFrom, setInheritedFrom] = useState(entry?.inheritedFrom ?? '')
  const [targetDate, setTargetDate] = useState(entry?.targetCompletionDate ?? '')
  const [saved, setSaved] = useState(false)

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
  }, [controlId])

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

  function switchTab(tabId: TabId) {
    const ORDER: TabId[] = ['implementation', 'assessor', 'evidence', 'control-info']
    setTabDir(ORDER.indexOf(tabId) > ORDER.indexOf(activeTab) ? 1 : -1)
    setActiveTab(tabId)
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
        {/* Back + breadcrumb */}
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

        {/* RMF stepper strip */}
        <div className="mb-4">
          <RMFStepper systemId={systemId!} compact />
        </div>

        {/* Control title row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-lg font-bold text-cyan-400 cyan-glow">{controlId}</span>
              <Badge className={cn('text-[11px]', getControlStatusColor(status))}>{status}</Badge>
              {needsTailoring && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{
                    color: '#FF6B1A',
                    background: 'rgba(255,85,0,0.1)',
                    border: '1px solid rgba(255,85,0,0.3)',
                  }}
                >
                  Site-specific input required
                </span>
              )}
            </div>
            <h1 className="text-base font-semibold text-slate-100">{control.title}</h1>
            <div className="text-xs text-slate-500 mt-0.5">
              {control.family} family · Last updated {formatDate(entry?.updatedAt ?? '')}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <AnimatePresence>
              {saved && (
                <motion.span
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="text-xs text-teal-400 flex items-center gap-1"
                >
                  ✓ Saved
                </motion.span>
              )}
            </AnimatePresence>
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
              getControlStatusColor(status),
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
            onClick={() => switchTab(tab.id)}
            className={cn(
              'px-4 py-3 text-xs font-medium border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-300',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 p-8 overflow-auto">
        <AnimatePresence mode="wait" custom={tabDir}>
          <motion.div
            key={activeTab}
            custom={tabDir}
            variants={tabVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: 'easeInOut' }}
          >
            {activeTab === 'implementation' && (
              <div className="w-full">
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-slate-200 mb-1">Implementation Statement</h3>
                  <p className="text-xs text-slate-400">
                    Left pane shows the standard policy. Tailor the right pane with your site-specific implementation.
                    {needsTailoring && (
                      <span style={{ color: '#FF8040' }}> This control requires site-specific customization.</span>
                    )}
                  </p>
                </div>
                <DeltaEditor
                  controlId={controlId!}
                  standardText={standardText}
                  tailoredText={implementation}
                  onChange={setImplementation}
                />
              </div>
            )}

            {activeTab === 'assessor' && (
              <div className="max-w-4xl flex flex-col gap-5">
                {/* Validation status banner */}
                {pgControl?.validatedAt && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-4 rounded-xl"
                    style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)' }}
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-emerald-400">Control Validated</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Signed off by <strong className="text-slate-300">{pgControl.validatedBy}</strong> on{' '}
                        {new Date(pgControl.validatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} at{' '}
                        {new Date(pgControl.validatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono px-2 py-1 rounded"
                      style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                      VALIDATED
                    </div>
                  </motion.div>
                )}

                {/* Assessor workflow actions */}
                {pgControl && !pgControl.validatedAt && (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.15)' }}>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-cyan-400" />
                      Assessor Workflow
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Step 1: Mark Ready */}
                      <button
                        onClick={handleMarkReadyForAudit}
                        disabled={markingReady || pgControl.status === 'READY_FOR_AUDIT'}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          background: pgControl.status === 'READY_FOR_AUDIT'
                            ? 'rgba(250,204,21,0.15)' : 'rgba(34,211,238,0.1)',
                          border: `1px solid ${pgControl.status === 'READY_FOR_AUDIT' ? 'rgba(250,204,21,0.4)' : 'rgba(34,211,238,0.3)'}`,
                          color: pgControl.status === 'READY_FOR_AUDIT' ? '#facc15' : '#22d3ee',
                        }}
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        {pgControl.status === 'READY_FOR_AUDIT' ? 'Ready for Audit' : 'Mark Ready for Audit'}
                      </button>

                      {/* Separator */}
                      <div className="w-8 h-px bg-slate-700 hidden sm:block" />

                      {/* Step 2: Validate */}
                      <button
                        onClick={handleValidate}
                        disabled={signingOff || pgControl.status !== 'READY_FOR_AUDIT'}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          background: 'rgba(52,211,153,0.1)',
                          border: '1px solid rgba(52,211,153,0.35)',
                          color: '#34d399',
                        }}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {signingOff ? 'Signing off…' : 'Validate Control'}
                      </button>

                      <div className="text-[11px] text-slate-600 ml-auto">
                        Step 1 → Mark Ready → Step 2 → Validate
                      </div>
                    </div>

                    {/* Status indicator */}
                    <div className="mt-3 text-[11px] text-slate-600">
                      Current PG status:{' '}
                      <span className="font-mono" style={{ color: pgControl.status === 'READY_FOR_AUDIT' ? '#facc15' : '#64748b' }}>
                        {pgControl.status}
                      </span>
                      {pgControl.autoFilled && (
                        <span className="ml-3 px-1.5 py-0.5 rounded text-cyan-600 font-semibold" style={{ background: 'rgba(34,211,238,0.08)' }}>
                          AUTO-FILLED
                        </span>
                      )}
                      {pgControl.tailoringRequired && !pgControl.validatedAt && (
                        <span className="ml-2 px-1.5 py-0.5 rounded font-semibold" style={{ background: 'rgba(255,85,0,0.1)', color: '#FF6B1A' }}>
                          TAILORING REQUIRED
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Assessor notes */}
                <div>
                  <div className="mb-3">
                    <h3 className="text-sm font-medium text-slate-200 mb-1">Assessor Notes</h3>
                    <p className="text-xs text-slate-400">Assessment findings, testing notes, and recommendations from the assessor.</p>
                  </div>
                  <div className="glass-panel overflow-hidden">
                    <TipTapEditor
                      value={assessorNotes}
                      onChange={setAssessorNotes}
                      placeholder="Document assessment findings, test results, and any observations..."
                      minHeight="240px"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'evidence' && (
              <div className="max-w-2xl">
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-slate-200 mb-1">Evidence Links</h3>
                  <p className="text-xs text-slate-400">Link to artifacts, screenshots, policies, or other evidence supporting this control.</p>
                </div>

                {evidenceLinks.length > 0 && (
                  <div className="glass-card mb-4 divide-y divide-navy-800 overflow-hidden">
                    {evidenceLinks.map((link) => (
                      <div key={link.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-200 font-medium">{link.label}</div>
                          {link.url && (
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-cyan-400 hover:underline flex items-center gap-1 mt-0.5"
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

                <div className="glass-panel p-4">
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
                <div className="glass-panel p-5 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-semibold text-slate-200">Control Statement</span>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{control.description}</p>
                </div>

                {control.supplementalGuidance && (
                  <div className="glass-panel p-5 mb-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Supplemental Guidance</div>
                    <p className="text-sm text-slate-400 leading-relaxed">{control.supplementalGuidance}</p>
                  </div>
                )}

                {control.relatedControls.length > 0 && (
                  <div className="glass-panel p-5 mb-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Related Controls</div>
                    <div className="flex flex-wrap gap-2">
                      {control.relatedControls.map((id) => (
                        <button
                          key={id}
                          onClick={() => navigate(`/systems/${systemId}/sctm/${id}`)}
                          className="font-mono text-xs px-2 py-1 rounded border text-cyan-400 border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
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
                        <div key={enh.id} className="glass-panel p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-mono text-xs font-bold text-cyan-400">{enh.id}</span>
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
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
