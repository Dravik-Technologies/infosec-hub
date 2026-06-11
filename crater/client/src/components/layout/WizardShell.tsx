import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import type { Project } from '@/types/project'

interface WizardShellProps {
  project: Project
  activeStep: number
  title: string
  eyebrow?: string
  actions?: ReactNode
  children: ReactNode
}

export default function WizardShell({
  project,
  activeStep,
  title,
  eyebrow = 'RMF WIZARD',
  actions,
  children,
}: WizardShellProps) {
  return (
    <div className="space-y-5">
      {/* Step header card */}
      <div className="rmf-card active p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Link
              to={`/projects/${project.id}`}
              className="hud-label inline-flex items-center gap-2 text-slate-600 hover:text-cyan-neon transition-colors"
            >
              <ArrowLeft size={13} />
              {project.name}
            </Link>
            <p className="hud-label text-slate-600 mt-3">{eyebrow}</p>
            <h2 className="font-mono text-xl text-slate-100 mt-1">
              STEP {activeStep}: {title}
            </h2>
          </div>

          {actions && <div className="flex-shrink-0">{actions}</div>}
        </div>
      </div>

      {/* Step content — full width, no inner sidebar */}
      {children}
    </div>
  )
}
