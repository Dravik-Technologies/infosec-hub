import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import {
  ChevronRight, ChevronLeft, Check, Shield, Zap, Database,
  Lock, AlertTriangle, Activity, Cpu, Wifi, Monitor, RefreshCw, Server
} from 'lucide-react'
import { useSystemStore } from '@/store/systemStore'
import { useSCTMStore } from '@/store/sctmStore'
import { useProjectControlsStore } from '@/store/projectControlsStore'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

interface ScorvaAsset {
  id: string
  assetTag: string | null
  hostname: string
  type: string
  os: string | null
  ip: string | null
  location: string | null
  classification: string
  status: string
  system: string | null
  lastSeen: string | null
  username: string | null
}
import {
  computeBaseline, getBaselineLabel, getBaselineControlCount, getDrivingFactor,
  getControlIdsForBaseline,
} from '@/data/baselines'
import { generateId, today } from '@/lib/utils'
import type { InfoSystem, ImpactLevel, SystemType } from '@/types'

type Step = 'info' | 'cia' | 'review'

const STEPS: { id: Step; label: string; icon: React.ReactNode }[] = [
  { id: 'info',   label: 'System Info',      icon: <Database className="w-3.5 h-3.5" /> },
  { id: 'cia',    label: 'CIA Categorize',   icon: <Shield className="w-3.5 h-3.5" /> },
  { id: 'review', label: 'Review & Launch',  icon: <Zap className="w-3.5 h-3.5" /> },
]

const IMPACT_OPTIONS: {
  value: ImpactLevel
  label: string
  desc: string
  icon: React.ReactNode
  color: string
  border: string
  bg: string
}[] = [
  {
    value: 'Low',
    label: 'Low',
    desc: 'Limited adverse effect on operations, assets, or individuals',
    icon: <Activity className="w-4 h-4" />,
    color: 'text-emerald-400',
    border: 'border-emerald-500/60',
    bg: 'bg-emerald-500/10',
  },
  {
    value: 'Moderate',
    label: 'Moderate',
    desc: 'Serious adverse effect on operations, assets, or individuals',
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'text-yellow-400',
    border: 'border-yellow-500/60',
    bg: 'bg-yellow-500/10',
  },
  {
    value: 'High',
    label: 'High',
    desc: 'Severe or catastrophic adverse effect on operations or individuals',
    icon: <Lock className="w-4 h-4" />,
    color: 'text-red-400',
    border: 'border-red-500/60',
    bg: 'bg-red-500/10',
  },
]

const stepVariants: Variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.28, ease: 'easeOut' } },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } }),
}

function ImpactCard({
  opt,
  selected,
  onSelect,
}: {
  opt: typeof IMPACT_OPTIONS[number]
  selected: boolean
  onSelect: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'relative p-4 rounded-xl border text-left transition-colors w-full',
        selected
          ? `${opt.border} ${opt.bg}`
          : 'border-slate-700 hover:border-slate-600'
      )}
      style={!selected ? { background: 'var(--color-surface-2)' } : undefined}
    >
      <AnimatePresence>
        {selected && (
          <motion.div
            key="check"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className={cn('absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center', opt.bg, opt.border, 'border')}
          >
            <Check className={cn('w-3 h-3', opt.color)} />
          </motion.div>
        )}
      </AnimatePresence>
      <div className={cn('flex items-center gap-2 mb-1.5', selected ? opt.color : 'text-slate-400')}>
        {opt.icon}
        <span className="text-sm font-bold">{opt.label}</span>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">{opt.desc}</p>
    </motion.button>
  )
}

function ImpactSelector({
  value,
  onChange,
  label,
  description,
}: {
  value: ImpactLevel | ''
  onChange: (v: ImpactLevel) => void
  label: string
  description: string
}) {
  return (
    <div>
      <div className="text-sm font-semibold text-slate-200 mb-0.5">{label}</div>
      <div className="text-xs text-slate-500 mb-3">{description}</div>
      <div className="grid grid-cols-3 gap-3">
        {IMPACT_OPTIONS.map(opt => (
          <ImpactCard
            key={opt.value}
            opt={opt}
            selected={value === opt.value}
            onSelect={() => onChange(opt.value)}
          />
        ))}
      </div>
    </div>
  )
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-slate-500 mb-0.5">{label}</div>
      <div className="text-sm text-slate-200">{value || '—'}</div>
    </div>
  )
}

export default function WizardPage() {
  const navigate = useNavigate()
  const addSystem = useSystemStore(s => s.addSystem)
  const initializeSystem = useSCTMStore(s => s.initializeSystem)
  const hydrateSystem = useProjectControlsStore(s => s.hydrateSystem)
  const user = useAuthStore(s => s.user)

  const [step, setStep] = useState<Step>('info')
  const dirRef = useRef(1)

  // Step 1 fields
  const [name, setName] = useState('')
  const [abbreviation, setAbbreviation] = useState('')
  const [systemType, setSystemType] = useState<SystemType>('Major Application')
  const [organization, setOrganization] = useState('')
  const [description, setDescription] = useState('')
  const [classificationMarking, setClassificationMarking] = useState('')
  const [systemOwner, setSystemOwner] = useState('')
  const [isso, setIsso] = useState('')
  const [issm, setIssm] = useState('')

  // Step 2 fields
  const [confidentiality, setConfidentiality] = useState<ImpactLevel | ''>('')
  const [integrity, setIntegrity] = useState<ImpactLevel | ''>('')
  const [availability, setAvailability] = useState<ImpactLevel | ''>('')
  const [cRationale, setCRationale] = useState('')
  const [iRationale, setIRationale] = useState('')
  const [aRationale, setARationale] = useState('')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [hydrationPhase, setHydrationPhase] = useState<'idle' | 'system' | 'controls' | 'done'>('idle')

  // SCORVA asset sync
  const [scorvaAssets, setScorvaAssets] = useState<ScorvaAsset[]>([])
  const [syncingAssets, setSyncingAssets] = useState(false)
  const [showAssets, setShowAssets] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  async function handleSyncAssets() {
    setSyncingAssets(true)
    setSyncError(null)
    try {
      const siteId = (user as any)?.siteId ?? 'crater-default'
      const data = await api.get<{ assets: ScorvaAsset[]; total: number }>(`/crater/assets?siteId=${encodeURIComponent(siteId)}`)
      setScorvaAssets(data.assets)
      setShowAssets(true)
    } catch (err: any) {
      setSyncError(err.message ?? 'Failed to sync assets')
      setShowAssets(true)
    } finally {
      setSyncingAssets(false)
    }
  }

  const currentIndex = STEPS.findIndex(s => s.id === step)

  const recommendedBaseline =
    confidentiality && integrity && availability
      ? computeBaseline(confidentiality as ImpactLevel, integrity as ImpactLevel, availability as ImpactLevel)
      : null

  function validateStep1() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'System name is required'
    if (!abbreviation.trim()) e.abbreviation = 'Abbreviation is required'
    if (!organization.trim()) e.organization = 'Organization is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep2() {
    const e: Record<string, string> = {}
    if (!confidentiality) e.confidentiality = 'Select a confidentiality level'
    if (!integrity) e.integrity = 'Select an integrity level'
    if (!availability) e.availability = 'Select an availability level'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function go(nextStep: Step, dir: 1 | -1) {
    dirRef.current = dir
    setErrors({})
    setStep(nextStep)
  }

  function handleNext() {
    if (step === 'info' && validateStep1()) go('cia', 1)
    else if (step === 'cia' && validateStep2()) go('review', 1)
  }

  function handleBack() {
    if (step === 'cia') go('info', -1)
    else if (step === 'review') go('cia', -1)
  }

  async function handleCreate() {
    setIsCreating(true)
    setCreateError(null)
    try {
      const baseline = computeBaseline(
        confidentiality as ImpactLevel,
        integrity as ImpactLevel,
        availability as ImpactLevel,
      )
      const now = today()
      const id = generateId()

      // Phase 1: create system in MongoDB
      setHydrationPhase('system')
      const system: InfoSystem = {
        id,
        name: name.trim(),
        abbreviation: abbreviation.trim().toUpperCase(),
        systemType,
        organization: organization.trim(),
        description: description.trim(),
        classificationMarking: classificationMarking.trim() || undefined,
        ciaAnswers: {
          confidentiality: confidentiality as ImpactLevel,
          integrity: integrity as ImpactLevel,
          availability: availability as ImpactLevel,
          confidentialityRationale: cRationale,
          integrityRationale: iRationale,
          availabilityRationale: aRationale,
        },
        recommendedBaseline: baseline,
        selectedBaseline: baseline,
        atoStatus: 'Pre-ATO',
        atoExpirationDate: null,
        systemOwner: systemOwner.trim(),
        isso: isso.trim(),
        issm: issm.trim(),
        createdAt: now,
        updatedAt: now,
      }
      await addSystem(system)
      await initializeSystem(id, baseline)

      // Phase 2: hydrate ProjectControls in PostgreSQL
      setHydrationPhase('controls')
      const controlIds = getControlIdsForBaseline(baseline)
      const siteId = (user as any)?.siteId ?? 'crater-default'
      await hydrateSystem(id, {
        externalId: id,
        name: name.trim(),
        abbreviation: abbreviation.trim().toUpperCase(),
        systemType,
        organization: organization.trim(),
        description: description.trim(),
        classificationMarking: classificationMarking.trim() || undefined,
        systemOwner: systemOwner.trim(),
        isso: isso.trim(),
        issm: issm.trim(),
        confidentiality: confidentiality as string,
        integrity: integrity as string,
        availability: availability as string,
        baseline,
        controlIds,
        siteId,
      })

      setHydrationPhase('done')
      await new Promise(r => setTimeout(r, 600))
      navigate(`/systems/${id}/dashboard`)
    } catch (err: any) {
      setIsCreating(false)
      setHydrationPhase('idle')
      setCreateError(err.message ?? 'Failed to create system. Check that the server is running.')
    }
  }

  const phaseLabel: Record<string, string> = {
    idle: '',
    system: 'Registering system & building SCTM…',
    controls: 'Hydrating controls from NIST baseline…',
    done: 'System online — launching dashboard…',
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-start py-12 px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.3)' }}>
              <Cpu className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Register New System</h1>
          <p className="text-sm text-slate-500 mt-1">
            Categorize your system per FIPS 199 · Auto-hydrate NIST 800-53 baseline controls
          </p>
        </motion.div>

        {/* Step indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex items-center justify-center gap-0 mb-8"
        >
          {STEPS.map((s, idx) => {
            const isActive = s.id === step
            const isDone = currentIndex > idx
            return (
              <div key={s.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <motion.div
                    animate={isActive
                      ? { boxShadow: '0 0 0 3px rgba(34,211,238,0.2)', borderColor: 'rgb(34,211,238)' }
                      : isDone
                      ? { borderColor: 'rgba(34,211,238,0.5)' }
                      : { borderColor: 'rgb(51,65,85)' }
                    }
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors',
                      isActive ? 'text-cyan-400' : isDone ? 'text-cyan-600' : 'text-slate-600'
                    )}
                    style={isActive ? { background: 'rgba(34,211,238,0.12)' } : isDone ? { background: 'rgba(34,211,238,0.08)' } : { background: 'var(--color-surface-2)' }}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5 text-cyan-500" /> : s.icon}
                  </motion.div>
                  <span className={cn('text-[11px] mt-1 font-medium',
                    isActive ? 'text-cyan-400' : isDone ? 'text-cyan-700' : 'text-slate-600')}>
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <motion.div
                    animate={{ scaleX: isDone ? 1 : 0.4, opacity: isDone ? 1 : 0.3 }}
                    style={{ originX: 0 }}
                    className="w-16 h-0.5 mx-2 mb-4 bg-cyan-500/50"
                  />
                )}
              </div>
            )
          })}
        </motion.div>

        {/* Step content — animated slide */}
        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" custom={dirRef.current}>
            <motion.div
              key={step}
              custom={dirRef.current}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <Card>
                {step === 'info' && (
                  <div className="flex flex-col gap-5">
                    <div>
                      <h2 className="text-base font-semibold text-slate-100 mb-1">System Information</h2>
                      <p className="text-xs text-slate-500">Identification and ownership details for your information system.</p>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <Input label="System Name *" value={name} onChange={e => setName(e.target.value)}
                          error={errors.name} placeholder="e.g. Personnel Management System" />
                      </div>
                      <Input label="Abbreviation *" value={abbreviation}
                        onChange={e => setAbbreviation(e.target.value.toUpperCase())}
                        error={errors.abbreviation} placeholder="PMS" maxLength={10} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Select label="System Type" value={systemType}
                        onChange={e => setSystemType(e.target.value as SystemType)}
                        options={[
                          { value: 'Major Application', label: 'Major Application' },
                          { value: 'General Support System', label: 'General Support System' },
                          { value: 'Minor Application', label: 'Minor Application' },
                        ]} />
                      <Input label="Organization *" value={organization}
                        onChange={e => setOrganization(e.target.value)}
                        error={errors.organization} placeholder="Office of the CIO" />
                    </div>
                    <Textarea label="System Description" value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Describe the purpose and scope of this information system…" rows={3} />
                    <Input label="Classification / Handling Marking" value={classificationMarking}
                      onChange={e => setClassificationMarking(e.target.value)}
                      placeholder="e.g. UNCLASSIFIED // FOR OFFICIAL USE ONLY" />
                    <div className="grid grid-cols-3 gap-4 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <Input label="System Owner" value={systemOwner} onChange={e => setSystemOwner(e.target.value)} placeholder="Name / Title" />
                      <Input label="ISSO" value={isso} onChange={e => setIsso(e.target.value)} placeholder="Name / Title" />
                      <Input label="ISSM" value={issm} onChange={e => setIssm(e.target.value)} placeholder="Name / Title" />
                    </div>

                    {/* SCORVA Asset Sync */}
                    <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                            SCORVA Asset Inventory
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">Sync managed devices from the shared asset database</div>
                        </div>
                        <button
                          type="button"
                          onClick={handleSyncAssets}
                          disabled={syncingAssets}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          style={{
                            background: 'rgba(34,211,238,0.1)',
                            border: '1px solid rgba(34,211,238,0.3)',
                            color: '#22d3ee',
                            opacity: syncingAssets ? 0.6 : 1,
                            cursor: syncingAssets ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <RefreshCw className={cn('w-3.5 h-3.5', syncingAssets && 'animate-spin')} />
                          {syncingAssets ? 'Syncing…' : 'Sync Assets'}
                        </button>
                      </div>

                      <AnimatePresence>
                        {showAssets && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            {syncError ? (
                              <div className="text-xs text-red-400 p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                {syncError} — SCORVA may not be running or siteId is not set.
                              </div>
                            ) : scorvaAssets.length === 0 ? (
                              <div className="text-xs text-slate-500 p-2">No assets found for this site.</div>
                            ) : (
                              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(34,211,238,0.15)', background: 'rgba(34,211,238,0.03)' }}>
                                <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(34,211,238,0.1)' }}>
                                  <span className="text-[10px] uppercase tracking-wider text-cyan-700 font-semibold">{scorvaAssets.length} assets synced</span>
                                  <span className="text-[10px] text-slate-600">Reference for system boundary</span>
                                </div>
                                <div className="max-h-40 overflow-y-auto">
                                  {scorvaAssets.map(asset => (
                                    <div key={asset.id} className="flex items-center gap-3 px-3 py-2 hover:bg-white/3 transition-colors" style={{ borderBottom: '1px solid rgba(34,211,238,0.06)' }}>
                                      <Server className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-mono text-slate-300 truncate">{asset.hostname}</div>
                                        <div className="text-[10px] text-slate-600">{asset.type} · {asset.os ?? 'Unknown OS'} · {asset.ip ?? 'No IP'}</div>
                                      </div>
                                      <div className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0',
                                        asset.status === 'Active' || asset.status === 'Available' ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-500 bg-slate-800'
                                      )}>
                                        {asset.status}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {step === 'cia' && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <h2 className="text-base font-semibold text-slate-100 mb-1">CIA Impact Categorization</h2>
                      <p className="text-xs text-slate-500">
                        Per FIPS 199 and NIST SP 800-60, assign impact levels for C, I, and A.
                        The <strong className="text-slate-400">high-water mark</strong> determines your baseline.
                      </p>
                    </div>
                    <ImpactSelector value={confidentiality} onChange={setConfidentiality}
                      label="Confidentiality"
                      description="Potential impact if unauthorized disclosure of information occurred." />
                    {errors.confidentiality && <p className="text-xs text-red-400 -mt-4">{errors.confidentiality}</p>}

                    <ImpactSelector value={integrity} onChange={setIntegrity}
                      label="Integrity"
                      description="Potential impact if unauthorized modification or destruction of information occurred." />
                    {errors.integrity && <p className="text-xs text-red-400 -mt-4">{errors.integrity}</p>}

                    <ImpactSelector value={availability} onChange={setAvailability}
                      label="Availability"
                      description="Potential impact if disruption of access to or use of the system occurred." />
                    {errors.availability && <p className="text-xs text-red-400 -mt-4">{errors.availability}</p>}

                    <AnimatePresence>
                      {recommendedBaseline && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.96, y: 8 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          className="rounded-xl p-4 border"
                          style={{ background: 'rgba(34,211,238,0.05)', borderColor: 'rgba(34,211,238,0.2)' }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Zap className="w-3.5 h-3.5 text-cyan-400" />
                            <div className="text-xs font-semibold uppercase tracking-wider text-cyan-600">Auto-Computed Baseline</div>
                          </div>
                          <div className="text-sm font-bold text-cyan-400">{getBaselineLabel(recommendedBaseline)}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            {getBaselineControlCount(recommendedBaseline).toLocaleString()} controls · Driven by{' '}
                            <strong className="text-slate-400">
                              {getDrivingFactor(confidentiality as ImpactLevel, integrity as ImpactLevel, availability as ImpactLevel)}
                            </strong> impact level
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex flex-col gap-4 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="text-xs font-medium text-slate-500">Rationale (optional — documented in SSP)</div>
                      <Textarea label="Confidentiality Rationale" value={cRationale}
                        onChange={e => setCRationale(e.target.value)}
                        placeholder="Explain why this confidentiality level was selected…" rows={2} />
                      <Textarea label="Integrity Rationale" value={iRationale}
                        onChange={e => setIRationale(e.target.value)}
                        placeholder="Explain why this integrity level was selected…" rows={2} />
                      <Textarea label="Availability Rationale" value={aRationale}
                        onChange={e => setARationale(e.target.value)}
                        placeholder="Explain why this availability level was selected…" rows={2} />
                    </div>
                  </div>
                )}

                {step === 'review' && (
                  <div className="flex flex-col gap-5">
                    <div>
                      <h2 className="text-base font-semibold text-slate-100 mb-1">Review & Launch</h2>
                      <p className="text-xs text-slate-500">
                        Confirm below, then CRATER will register the system, build the SCTM, and
                        auto-hydrate all baseline controls from the StandardLibrary.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <ReviewField label="System Name" value={name} />
                      <ReviewField label="Abbreviation" value={abbreviation} />
                      <ReviewField label="System Type" value={systemType} />
                      <ReviewField label="Organization" value={organization} />
                    </div>
                    {description && <ReviewField label="Description" value={description} />}
                    {(systemOwner || isso || issm) && (
                      <div className="grid grid-cols-3 gap-4">
                        {systemOwner && <ReviewField label="System Owner" value={systemOwner} />}
                        {isso && <ReviewField label="ISSO" value={isso} />}
                        {issm && <ReviewField label="ISSM" value={issm} />}
                      </div>
                    )}

                    {/* CIA summary */}
                    <div className="rounded-lg p-4 border" style={{ background: 'var(--color-surface-3)', borderColor: 'var(--color-border)' }}>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">CIA Categorization</div>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Confidentiality', value: confidentiality },
                          { label: 'Integrity', value: integrity },
                          { label: 'Availability', value: availability },
                        ].map(({ label, value }) => (
                          <div key={label} className="text-center">
                            <div className="text-[11px] text-slate-500 mb-1">{label}</div>
                            <div className={cn('text-sm font-bold px-3 py-1 rounded-lg',
                              value === 'High' ? 'text-red-400 bg-red-400/10'
                              : value === 'Moderate' ? 'text-yellow-400 bg-yellow-400/10'
                              : 'text-emerald-400 bg-emerald-400/10')}>
                              {value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {recommendedBaseline && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl p-4 border"
                        style={{ background: 'rgba(34,211,238,0.05)', borderColor: 'rgba(34,211,238,0.2)' }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-cyan-600 mb-1">Selected Baseline</div>
                            <div className="text-sm font-bold text-cyan-400">{getBaselineLabel(recommendedBaseline)}</div>
                            <div className="text-xs text-slate-500 mt-1">
                              {getBaselineControlCount(recommendedBaseline).toLocaleString()} controls will be inserted &amp; auto-hydrated
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-600 mb-1">AUTO-PILOT</div>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                              style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.25)' }}>
                              <Zap className="w-3.5 h-3.5 text-cyan-400" />
                              <span className="text-xs font-bold text-cyan-400">ENABLED</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Hydration progress */}
                    <AnimatePresence>
                      {isCreating && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="rounded-xl p-4 border"
                            style={{ background: 'rgba(34,211,238,0.06)', borderColor: 'rgba(34,211,238,0.2)' }}>
                            <div className="flex items-center gap-3">
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                              >
                                <Cpu className="w-4 h-4 text-cyan-400" />
                              </motion.div>
                              <div>
                                <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider">CRATER ENGINE</div>
                                <div className="text-xs text-slate-400 mt-0.5">{phaseLabel[hydrationPhase]}</div>
                              </div>
                            </div>
                            {/* Progress bar */}
                            <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(34,211,238,0.1)' }}>
                              <motion.div
                                className="h-full rounded-full"
                                style={{ background: 'linear-gradient(90deg, #22d3ee, #0ea5e9)' }}
                                initial={{ width: '0%' }}
                                animate={{
                                  width: hydrationPhase === 'system' ? '40%'
                                       : hydrationPhase === 'controls' ? '75%'
                                       : hydrationPhase === 'done' ? '100%'
                                       : '5%'
                                }}
                                transition={{ duration: 0.5 }}
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Error */}
        <AnimatePresence>
          {createError && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 text-red-400 text-sm bg-red-400/10 rounded-lg p-3 border border-red-400/20"
            >
              {createError}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between mt-5"
        >
          <Button
            variant="ghost"
            icon={<ChevronLeft className="w-4 h-4" />}
            onClick={step === 'info' ? () => navigate('/') : handleBack}
            disabled={isCreating}
          >
            {step === 'info' ? 'Cancel' : 'Back'}
          </Button>

          {step === 'review' ? (
            <motion.button
              whileHover={!isCreating ? { scale: 1.02 } : {}}
              whileTap={!isCreating ? { scale: 0.97 } : {}}
              onClick={handleCreate}
              disabled={isCreating}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: isCreating ? 'rgba(34,211,238,0.15)' : 'linear-gradient(135deg, #22d3ee 0%, #0ea5e9 100%)',
                color: isCreating ? '#22d3ee' : '#0a1628',
                boxShadow: isCreating ? 'none' : '0 0 20px rgba(34,211,238,0.3)',
              }}
            >
              {hydrationPhase === 'done' ? (
                <Check className="w-4 h-4" />
              ) : isCreating ? (
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                  <Cpu className="w-4 h-4" />
                </motion.span>
              ) : (
                <Zap className="w-4 h-4" />
              )}
              {isCreating
                ? hydrationPhase === 'done' ? 'Launching…' : 'Processing…'
                : 'Launch System & Auto-Hydrate'}
            </motion.button>
          ) : (
            <Button variant="primary" onClick={handleNext}>
              Continue
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </motion.div>
      </div>
    </div>
  )
}
