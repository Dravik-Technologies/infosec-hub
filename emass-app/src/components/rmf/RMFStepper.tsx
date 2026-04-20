import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle, Layers, Shield, ClipboardCheck, Lock, Activity } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface RMFStep {
  id: number
  key: string
  label: string
  sublabel: string
  icon: React.ReactNode
  path: (systemId: string) => string
}

export const RMF_STEPS: RMFStep[] = [
  {
    id: 1,
    key: 'categorize',
    label: 'Categorize',
    sublabel: 'CIA Impact',
    icon: <Layers className="w-4 h-4" />,
    path: (id) => `/systems/${id}/dashboard`,
  },
  {
    id: 2,
    key: 'select',
    label: 'Select',
    sublabel: 'Control Baseline',
    icon: <CheckCircle className="w-4 h-4" />,
    path: (id) => `/systems/${id}/sctm`,
  },
  {
    id: 3,
    key: 'implement',
    label: 'Implement',
    sublabel: 'Control Statements',
    icon: <ClipboardCheck className="w-4 h-4" />,
    path: (id) => `/systems/${id}/sctm`,
  },
  {
    id: 4,
    key: 'assess',
    label: 'Assess',
    sublabel: 'Test & Evaluate',
    icon: <Shield className="w-4 h-4" />,
    path: (id) => `/systems/${id}/poam`,
  },
  {
    id: 5,
    key: 'authorize',
    label: 'Authorize',
    sublabel: 'ATO Decision',
    icon: <Lock className="w-4 h-4" />,
    path: (id) => `/systems/${id}/reports`,
  },
  {
    id: 6,
    key: 'monitor',
    label: 'Monitor',
    sublabel: 'Continuous',
    icon: <Activity className="w-4 h-4" />,
    path: (id) => `/systems/${id}/vulnerabilities`,
  },
]

function resolveActiveStep(pathname: string): number {
  if (pathname.includes('/vulnerabilities')) return 6
  if (pathname.includes('/reports')) return 5
  if (pathname.includes('/poam')) return 4
  if (pathname.match(/\/sctm\/[^/]+/)) return 3
  if (pathname.includes('/sctm')) return 2
  return 1
}

interface RMFStepperProps {
  systemId: string
  compact?: boolean
}

export default function RMFStepper({ systemId, compact = false }: RMFStepperProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const activeStep = resolveActiveStep(pathname)

  return (
    <div className={cn('w-full', compact ? 'px-0' : 'px-0')}>
      <div className="flex items-center w-full">
        {RMF_STEPS.map((step, idx) => {
          const isActive = step.id === activeStep
          const isCompleted = step.id < activeStep
          const isLast = idx === RMF_STEPS.length - 1

          return (
            <div key={step.key} className="flex items-center flex-1 min-w-0">
              {/* Step node */}
              <button
                onClick={() => navigate(step.path(systemId))}
                className="flex flex-col items-center gap-1 group shrink-0 relative"
                title={`RMF Step ${step.id}: ${step.label}`}
              >
                {/* Circle */}
                <motion.div
                  initial={false}
                  animate={{
                    scale: isActive ? 1.12 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                  className={cn(
                    'relative w-9 h-9 rounded-full flex items-center justify-center transition-colors border-2',
                    isCompleted
                      ? 'bg-teal-500/20 border-teal-500 text-teal-400'
                      : isActive
                      ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300'
                      : 'bg-navy-800/60 border-navy-600 text-slate-500 group-hover:border-navy-500 group-hover:text-slate-400',
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    step.icon
                  )}
                  {isActive && (
                    <motion.span
                      layoutId="rmf-active-ring"
                      className="absolute inset-0 rounded-full border-2 border-cyan-400/40"
                      animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </motion.div>

                {/* Labels */}
                {!compact && (
                  <div className="text-center">
                    <div
                      className={cn(
                        'text-[10px] font-semibold tracking-wide whitespace-nowrap transition-colors',
                        isActive
                          ? 'text-cyan-300 cyan-glow'
                          : isCompleted
                          ? 'text-teal-400'
                          : 'text-slate-500 group-hover:text-slate-400',
                      )}
                    >
                      {step.label}
                    </div>
                    <div className="text-[9px] text-slate-600 whitespace-nowrap">{step.sublabel}</div>
                  </div>
                )}
              </button>

              {/* Connector */}
              {!isLast && (
                <div className="flex-1 mx-1.5 h-0.5 relative overflow-hidden rounded-full min-w-0">
                  <div className="absolute inset-0 bg-navy-700" />
                  <motion.div
                    initial={{ scaleX: 0, originX: 0 }}
                    animate={{ scaleX: isCompleted ? 1 : 0 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                    className="absolute inset-0 bg-gradient-to-r from-teal-500 to-cyan-400 origin-left"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
