import { Navigate, useParams } from 'react-router-dom'

const RMF_STEPS = [
  'Prepare',
  'Categorize',
  'Select',
  'Implement',
  'Assess',
  'Authorize',
  'Monitor',
] as const

export default function RmfStepPage() {
  const { stepNumber } = useParams<{ stepNumber: string }>()
  const index = Number(stepNumber)
  const label = RMF_STEPS[index]

  if (!Number.isInteger(index) || !label) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="hud-label text-slate-600">RMF STEP {index}</p>
        <h1 className="font-mono text-xl text-slate-100">{label.toUpperCase()}</h1>
      </div>

      <div className="rmf-card p-8">
        <p className="hud-label mb-2">WORKSPACE PLACEHOLDER</p>
        <p className="text-sm text-slate-500">
          This route is reserved for the step wizard, evidence collection, control mapping, and diagram workflows.
        </p>
      </div>
    </div>
  )
}
