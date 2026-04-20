import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Database, Cpu, Activity, Lock, Eye } from 'lucide-react'

const STEPS = [
  { label: 'Categorize', num: 1, Icon: Shield,   color: '#22d3ee', glow: 'rgba(34,211,238,0.35)',  desc: 'FIPS 199 / SP 800-60' },
  { label: 'Select',     num: 2, Icon: Database,  color: '#0ea5e9', glow: 'rgba(14,165,233,0.35)',  desc: 'NIST SP 800-53 Rev 5' },
  { label: 'Implement',  num: 3, Icon: Cpu,       color: '#818cf8', glow: 'rgba(129,140,248,0.35)', desc: 'Controls & Procedures' },
  { label: 'Assess',     num: 4, Icon: Activity,  color: '#facc15', glow: 'rgba(250,204,21,0.35)',  desc: 'NIST SP 800-53A' },
  { label: 'Authorize',  num: 5, Icon: Lock,      color: '#34d399', glow: 'rgba(52,211,153,0.35)',  desc: 'ATO Package / Risk' },
  { label: 'Monitor',    num: 6, Icon: Eye,       color: '#f87171', glow: 'rgba(248,113,113,0.35)', desc: 'ConMon / POAM' },
]

// Hexagonal prism geometry
// Face width 160px → apothem = 160 * √3/2 ≈ 138.6px
const FACE_W = 160
const FACE_H = 176
const APOTHEM = 139

interface Props {
  activeStep?: number   // 0-5
  onStepClick?: (idx: number) => void
  className?: string
}

export default function RMFHexagon({ activeStep = 0, onStepClick, className }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <div className={className}>
      {/* Label above */}
      <div className="text-center mb-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.25 }}
          >
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-0.5">RMF Step {STEPS[activeStep].num}</div>
            <div className="text-sm font-bold" style={{ color: STEPS[activeStep].color }}>
              {STEPS[activeStep].label}
            </div>
            <div className="text-[11px] text-slate-600">{STEPS[activeStep].desc}</div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 3D prism viewport */}
      <div
        style={{
          perspective: '900px',
          width: FACE_W * 2.4,
          height: FACE_H,
          margin: '0 auto',
          overflow: 'visible',
        }}
      >
        <motion.div
          style={{
            width: FACE_W,
            height: FACE_H,
            position: 'relative',
            transformStyle: 'preserve-3d',
            margin: '0 auto',
          }}
          animate={{ rotateY: -activeStep * 60 }}
          transition={{ duration: 0.65, ease: [0.34, 1.3, 0.64, 1] }}
        >
          {STEPS.map((step, i) => {
            const Icon = step.Icon
            const isActive = i === activeStep
            const isHov = hovered === i
            return (
              <div
                key={step.label}
                onClick={() => onStepClick?.(i)}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  position: 'absolute',
                  width: FACE_W,
                  height: FACE_H,
                  transform: `rotateY(${i * 60}deg) translateZ(${APOTHEM}px)`,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  cursor: 'pointer',
                  borderRadius: 12,
                  border: `1px solid ${isActive ? step.color : isHov ? `${step.color}80` : 'rgba(100,116,139,0.25)'}`,
                  background: isActive
                    ? `radial-gradient(ellipse at center, ${step.glow}, rgba(8,14,24,0.95))`
                    : 'rgba(8,14,24,0.88)',
                  boxShadow: isActive ? `0 0 32px ${step.glow}, inset 0 0 24px ${step.glow}` : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'border-color 0.2s, background 0.2s',
                  userSelect: 'none',
                }}
              >
                {/* Step number badge */}
                <div style={{
                  position: 'absolute',
                  top: 10,
                  right: 12,
                  fontSize: 10,
                  fontWeight: 700,
                  color: step.color,
                  opacity: 0.7,
                  fontFamily: 'monospace',
                }}>
                  0{step.num}
                </div>

                {/* Icon */}
                <motion.div
                  animate={isActive ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: isActive ? `${step.glow}` : 'rgba(100,116,139,0.15)',
                    border: `1px solid ${isActive ? step.color : 'rgba(100,116,139,0.3)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon style={{ width: 20, height: 20, color: isActive ? step.color : '#64748b' }} />
                </motion.div>

                {/* Label */}
                <div style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: isActive ? step.color : '#94a3b8',
                  letterSpacing: '0.02em',
                }}>
                  {step.label}
                </div>

                {/* Description */}
                <div style={{
                  fontSize: 10,
                  color: isActive ? `${step.color}99` : '#475569',
                  textAlign: 'center',
                  padding: '0 12px',
                  lineHeight: 1.4,
                }}>
                  {step.desc}
                </div>

                {/* Active indicator dot */}
                {isActive && (
                  <motion.div
                    animate={{ opacity: [0.6, 1, 0.6], scale: [0.9, 1.1, 0.9] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: step.color,
                      boxShadow: `0 0 8px ${step.color}`,
                    }}
                  />
                )}
              </div>
            )
          })}
        </motion.div>
      </div>

      {/* Step nav dots */}
      <div className="flex items-center justify-center gap-2 mt-4">
        {STEPS.map((step, i) => (
          <button
            key={i}
            onClick={() => onStepClick?.(i)}
            title={step.label}
            style={{
              width: i === activeStep ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background: i === activeStep ? step.color : 'rgba(100,116,139,0.4)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: i === activeStep ? `0 0 8px ${step.color}` : 'none',
            }}
          />
        ))}
      </div>
    </div>
  )
}
