import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

interface ReadinessMeterProps {
  score: number        // 0–100
  size?: number        // SVG diameter px
  strokeWidth?: number
  label?: string
  className?: string
}

function scoreToColor(score: number): string {
  if (score >= 80) return '#22d3ee'   // cyan — ATO-ready
  if (score >= 50) return '#facc15'   // yellow — in progress
  if (score >= 25) return '#fb923c'   // orange — early
  return '#FF5500'                    // magma — not started
}

function scoreToLabel(score: number): string {
  if (score >= 90) return 'ATO Ready'
  if (score >= 75) return 'Near Ready'
  if (score >= 50) return 'In Progress'
  if (score >= 25) return 'Early Stage'
  return 'Not Started'
}

export default function ReadinessMeter({
  score,
  size = 160,
  strokeWidth = 10,
  label,
  className,
}: ReadinessMeterProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  // Show 270° arc (three-quarters circle, starting from bottom-left)
  const arcLength = circumference * 0.75
  const dashOffset = arcLength - (arcLength * clamped) / 100
  const color = scoreToColor(clamped)
  const statusLabel = label ?? scoreToLabel(clamped)

  // Rotation: start at 135° (bottom-left)
  const rotation = 135

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            stroke="rgba(30, 58, 95, 0.8)"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            stroke={color}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
            initial={{ strokeDashoffset: arcLength }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.4, ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              filter: `drop-shadow(0 0 6px ${color}80)`,
            }}
          />
        </svg>

        {/* Center text */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ paddingBottom: '8px' }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="text-3xl font-bold font-mono"
            style={{ color }}
          >
            {clamped}%
          </motion.div>
          <div className="text-[10px] text-slate-500 tracking-wide uppercase mt-0.5">
            Readiness
          </div>
        </div>
      </div>

      {/* Status badge */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="text-xs font-semibold px-3 py-1 rounded-full border"
        style={{
          color,
          borderColor: `${color}40`,
          background: `${color}12`,
        }}
      >
        {statusLabel}
      </motion.div>
    </div>
  )
}
