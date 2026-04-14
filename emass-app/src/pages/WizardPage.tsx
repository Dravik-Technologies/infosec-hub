import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ChevronLeft, Check, Shield } from 'lucide-react'
import { useSystemStore } from '@/store/systemStore'
import { useSCTMStore } from '@/store/sctmStore'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { computeBaseline, getBaselineLabel, getBaselineControlCount, getDrivingFactor } from '@/data/baselines'
import { generateId, today } from '@/lib/utils'
import type { InfoSystem, CIAAnswers, ImpactLevel, SystemType, ATOStatus } from '@/types'

type Step = 'info' | 'cia' | 'review'

const STEPS: { id: Step; label: string }[] = [
  { id: 'info', label: 'System Info' },
  { id: 'cia', label: 'CIA Categorization' },
  { id: 'review', label: 'Review & Confirm' },
]

const IMPACT_OPTIONS: { value: ImpactLevel; label: string; desc: string }[] = [
  { value: 'Low', label: 'Low', desc: 'Limited adverse effect on organizational operations, assets, or individuals' },
  { value: 'Moderate', label: 'Moderate', desc: 'Serious adverse effect on organizational operations, assets, or individuals' },
  { value: 'High', label: 'High', desc: 'Severe or catastrophic adverse effect on organizational operations, assets, or individuals' },
]

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
      <div className="text-sm font-medium text-slate-200 mb-1">{label}</div>
      <div className="text-xs text-slate-400 mb-3">{description}</div>
      <div className="grid grid-cols-3 gap-3">
        {IMPACT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'p-3 rounded-lg border text-left transition-all',
              value === opt.value
                ? 'border-teal-500 bg-teal-500/10 text-teal-300'
                : 'border-navy-600 hover:border-navy-500 text-slate-400 hover:text-slate-200'
            )}
            style={value !== opt.value ? { background: 'var(--color-surface)' } : {}}
          >
            <div className="text-sm font-semibold mb-1">{opt.label}</div>
            <div className="text-[11px] leading-relaxed opacity-80">{opt.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function WizardPage() {
  const navigate = useNavigate()
  const addSystem = useSystemStore((s) => s.addSystem)
  const initializeSystem = useSCTMStore((s) => s.initializeSystem)

  const [step, setStep] = useState<Step>('info')

  // Step 1
  const [name, setName] = useState('')
  const [abbreviation, setAbbreviation] = useState('')
  const [systemType, setSystemType] = useState<SystemType>('Major Application')
  const [organization, setOrganization] = useState('')
  const [description, setDescription] = useState('')
  const [classificationMarking, setClassificationMarking] = useState('')
  const [systemOwner, setSystemOwner] = useState('')
  const [isso, setIsso] = useState('')
  const [issm, setIssm] = useState('')

  // Step 2
  const [confidentiality, setConfidentiality] = useState<ImpactLevel | ''>('')
  const [integrity, setIntegrity] = useState<ImpactLevel | ''>('')
  const [availability, setAvailability] = useState<ImpactLevel | ''>('')
  const [cRationale, setCRationale] = useState('')
  const [iRationale, setIRationale] = useState('')
  const [aRationale, setARationale] = useState('')

  const [errors, setErrors] = useState<Record<string, string>>({})

  const currentIndex = STEPS.findIndex((s) => s.id === step)

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
    if (!confidentiality) e.confidentiality = 'Select a confidentiality impact level'
    if (!integrity) e.integrity = 'Select an integrity impact level'
    if (!availability) e.availability = 'Select an availability impact level'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleNext() {
    if (step === 'info' && validateStep1()) setStep('cia')
    else if (step === 'cia' && validateStep2()) setStep('review')
  }

  function handleBack() {
    if (step === 'cia') setStep('info')
    else if (step === 'review') setStep('cia')
  }

  const [isCreating, setIsCreating] = useState(false)

  async function handleCreate() {
    setIsCreating(true)
    try {
      const baseline = computeBaseline(
        confidentiality as ImpactLevel,
        integrity as ImpactLevel,
        availability as ImpactLevel
      )
      const now = today()
      const id = generateId()
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
      navigate(`/systems/${id}/sctm`)
    } catch {
      setIsCreating(false)
    }
  }

  const recommendedBaseline =
    confidentiality && integrity && availability
      ? computeBaseline(confidentiality as ImpactLevel, integrity as ImpactLevel, availability as ImpactLevel)
      : null

  return (
    <div className="min-h-full flex flex-col items-center justify-start py-12 px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-teal-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Register New System</h1>
          <p className="text-sm text-slate-400 mt-1">Complete the wizard to create your system and generate the SCTM.</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-0 mb-8">
          {STEPS.map((s, idx) => {
            const isActive = s.id === step
            const isDone = currentIndex > idx
            return (
              <div key={s.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                      isActive
                        ? 'border-teal-500 bg-teal-500/20 text-teal-400'
                        : isDone
                        ? 'border-teal-600 bg-teal-600/20 text-teal-400'
                        : 'border-navy-600 text-slate-500'
                    )}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                  </div>
                  <span
                    className={cn(
                      'text-[11px] mt-1 font-medium',
                      isActive ? 'text-teal-400' : isDone ? 'text-teal-600' : 'text-slate-500'
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'w-16 h-0.5 mx-2 mb-4',
                      isDone ? 'bg-teal-600/60' : 'bg-navy-700'
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Step content */}
        <Card>
          {step === 'info' && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-base font-semibold text-slate-100 mb-1">System Information</h2>
                <p className="text-xs text-slate-400">Basic identification and ownership information for your information system.</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Input
                    label="System Name *"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    error={errors.name}
                    placeholder="e.g. Personnel Management System"
                  />
                </div>
                <Input
                  label="Abbreviation *"
                  value={abbreviation}
                  onChange={(e) => setAbbreviation(e.target.value.toUpperCase())}
                  error={errors.abbreviation}
                  placeholder="e.g. PMS"
                  maxLength={10}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="System Type"
                  value={systemType}
                  onChange={(e) => setSystemType(e.target.value as SystemType)}
                  options={[
                    { value: 'Major Application', label: 'Major Application' },
                    { value: 'General Support System', label: 'General Support System' },
                    { value: 'Minor Application', label: 'Minor Application' },
                  ]}
                />
                <Input
                  label="Organization *"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  error={errors.organization}
                  placeholder="e.g. Office of the CIO"
                />
              </div>
              <Textarea
                label="System Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the purpose and scope of this information system..."
                rows={3}
              />
              <Input
                label="Classification / Handling Marking"
                value={classificationMarking}
                onChange={(e) => setClassificationMarking(e.target.value)}
                placeholder="e.g. UNCLASSIFIED // FOR OFFICIAL USE ONLY"
              />
              <div className="grid grid-cols-3 gap-4 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <Input label="System Owner" value={systemOwner} onChange={(e) => setSystemOwner(e.target.value)} placeholder="Name / Title" />
                <Input label="ISSO" value={isso} onChange={(e) => setIsso(e.target.value)} placeholder="Name / Title" />
                <Input label="ISSM" value={issm} onChange={(e) => setIssm(e.target.value)} placeholder="Name / Title" />
              </div>
            </div>
          )}

          {step === 'cia' && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-base font-semibold text-slate-100 mb-1">CIA Impact Categorization</h2>
                <p className="text-xs text-slate-400">
                  Per FIPS 199 and NIST SP 800-60, assign impact levels for Confidentiality, Integrity, and Availability.
                  The recommended security control baseline is the <strong className="text-slate-300">high-water mark</strong> across all three values.
                </p>
              </div>
              <ImpactSelector
                value={confidentiality}
                onChange={setConfidentiality}
                label="Confidentiality"
                description="The potential impact if unauthorized disclosure of information occurred."
              />
              {errors.confidentiality && <p className="text-xs text-red-400 -mt-4">{errors.confidentiality}</p>}
              <ImpactSelector
                value={integrity}
                onChange={setIntegrity}
                label="Integrity"
                description="The potential impact if unauthorized modification or destruction of information occurred."
              />
              {errors.integrity && <p className="text-xs text-red-400 -mt-4">{errors.integrity}</p>}
              <ImpactSelector
                value={availability}
                onChange={setAvailability}
                label="Availability"
                description="The potential impact if disruption of access to or use of information or the system occurred."
              />
              {errors.availability && <p className="text-xs text-red-400 -mt-4">{errors.availability}</p>}

              {recommendedBaseline && (
                <div
                  className="rounded-lg p-4 border"
                  style={{ background: 'var(--color-surface-3)', borderColor: 'var(--color-border)' }}
                >
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Recommended Baseline</div>
                  <div className="text-sm font-semibold text-teal-400">{getBaselineLabel(recommendedBaseline)}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {getBaselineControlCount(recommendedBaseline)} controls · Driven by{' '}
                    <strong className="text-slate-300">
                      {getDrivingFactor(
                        confidentiality as ImpactLevel,
                        integrity as ImpactLevel,
                        availability as ImpactLevel
                      )}
                    </strong>{' '}
                    impact level
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-4 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <div className="text-xs font-medium text-slate-400">Rationale (optional — documented for SSP)</div>
                <Textarea
                  label="Confidentiality Rationale"
                  value={cRationale}
                  onChange={(e) => setCRationale(e.target.value)}
                  placeholder="Explain why this confidentiality level was selected..."
                  rows={2}
                />
                <Textarea
                  label="Integrity Rationale"
                  value={iRationale}
                  onChange={(e) => setIRationale(e.target.value)}
                  placeholder="Explain why this integrity level was selected..."
                  rows={2}
                />
                <Textarea
                  label="Availability Rationale"
                  value={aRationale}
                  onChange={(e) => setARationale(e.target.value)}
                  placeholder="Explain why this availability level was selected..."
                  rows={2}
                />
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-base font-semibold text-slate-100 mb-1">Review & Confirm</h2>
                <p className="text-xs text-slate-400">Verify the information below before creating the system and initializing the SCTM.</p>
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

              <div
                className="rounded-lg p-4 border"
                style={{ background: 'var(--color-surface-3)', borderColor: 'var(--color-border)' }}
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">CIA Categorization</div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Confidentiality', value: confidentiality },
                    { label: 'Integrity', value: integrity },
                    { label: 'Availability', value: availability },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center">
                      <div className="text-[11px] text-slate-500 mb-1">{label}</div>
                      <div
                        className={cn(
                          'text-sm font-bold px-3 py-1 rounded-lg',
                          value === 'High'
                            ? 'text-red-400 bg-red-400/10'
                            : value === 'Moderate'
                            ? 'text-yellow-400 bg-yellow-400/10'
                            : 'text-green-400 bg-green-400/10'
                        )}
                      >
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {recommendedBaseline && (
                <div
                  className="rounded-lg p-4 border border-teal-500/25"
                  style={{ background: 'rgba(20, 184, 166, 0.05)' }}
                >
                  <div className="text-xs font-semibold uppercase tracking-wider text-teal-600 mb-1">Selected Framework</div>
                  <div className="text-sm font-semibold text-teal-400">{getBaselineLabel(recommendedBaseline)}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {getBaselineControlCount(recommendedBaseline)} controls will be added to the SCTM
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-5">
          <Button
            variant="ghost"
            icon={<ChevronLeft className="w-4 h-4" />}
            onClick={step === 'info' ? () => navigate('/') : handleBack}
          >
            {step === 'info' ? 'Cancel' : 'Back'}
          </Button>
          {step === 'review' ? (
            <Button variant="primary" icon={<Check className="w-4 h-4" />} onClick={handleCreate} disabled={isCreating}>
              {isCreating ? 'Creating…' : 'Create System & Build SCTM'}
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleNext}
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
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
