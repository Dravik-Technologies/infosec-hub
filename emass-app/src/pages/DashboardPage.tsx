import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, type Variants } from 'framer-motion'
import {
  Shield, AlertTriangle, CheckCircle, Clock, FileText,
  ChevronRight, TrendingUp, Zap, AlertCircle, Database, Cpu,
} from 'lucide-react'
import { useSystemStore } from '@/store/systemStore'
import { useSCTMStore } from '@/store/sctmStore'
import { usePOAMStore } from '@/store/poamStore'
import { useVulnStore } from '@/store/vulnStore'
import { useProjectControlsStore } from '@/store/projectControlsStore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageHeader, PageContent } from '@/components/ui/PageHeader'
import RMFStepper from '@/components/rmf/RMFStepper'
import ReadinessMeter from '@/components/rmf/ReadinessMeter'
import RMFHexagon from '@/components/rmf/RMFHexagon'
import { getATOStatusColor, getControlStatusColor, formatDate, daysSince } from '@/lib/utils'
import { computeReadinessScore, getUntailoredControls } from '@/lib/hydration'
import { getBaselineLabel } from '@/data/baselines'
import { CONTROL_FAMILIES } from '@/data/controls'
import type { ControlStatus } from '@/types'
import { cn } from '@/lib/cn'

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
}

export default function DashboardPage() {
  const { systemId } = useParams<{ systemId: string }>()
  const navigate = useNavigate()
  const system = useSystemStore((s) => s.getSystemById(systemId!))
  const entries = useSCTMStore((s) => s.getEntriesForSystem(systemId!))
  const poamItems = usePOAMStore((s) => s.getItemsForSystem(systemId!))
  const vulns = useVulnStore((s) => s.getVulnsForSystem(systemId!))
  const fetchProjectControls = useProjectControlsStore(s => s.fetchControlsForSystem)
  const projectSummary = useProjectControlsStore(s => s.getSummaryForSystem(systemId!))
  const projectControls = useProjectControlsStore(s => s.getControlsForSystem(systemId!))

  useEffect(() => { fetchProjectControls(systemId!) }, [systemId, fetchProjectControls])

  const [hexStep, setHexStep] = useState(0)

  if (!system) {
    return <div className="p-8 text-slate-400">System not found.</div>
  }

  const statusCounts = entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1
    return acc
  }, {} as Record<ControlStatus, number>)

  const readinessScore = computeReadinessScore(entries)
  const untailored = system.selectedBaseline
    ? getUntailoredControls(system.selectedBaseline, entries)
    : []

  const implemented = (statusCounts['Implemented'] ?? 0) + (statusCounts['Inherited'] ?? 0)
  const partial = statusCounts['Partially Implemented'] ?? 0
  const notImpl = statusCounts['Not Implemented'] ?? 0
  const planned = statusCounts['Planned'] ?? 0
  const na = statusCounts['Not Applicable'] ?? 0

  const openPOAMs = poamItems.filter((p) => p.status === 'Open').length
  const inProgressPOAMs = poamItems.filter((p) => p.status === 'In Progress').length
  const openVulns = vulns.filter((v) => v.status === 'Open').length
  const criticalVulns = vulns.filter((v) => v.severity === 'Critical' && v.status === 'Open').length

  const familyStats = CONTROL_FAMILIES.map((fam) => {
    const famEntries = entries.filter((e) => e.controlId.startsWith(fam.id + '-'))
    if (famEntries.length === 0) return null
    const famStatusCounts = famEntries.reduce((acc, e) => {
      acc[e.status] = (acc[e.status] ?? 0) + 1
      return acc
    }, {} as Record<ControlStatus, number>)
    const famImpl = (famStatusCounts['Implemented'] ?? 0) + (famStatusCounts['Inherited'] ?? 0)
    const famScore = famEntries.length > 0 ? Math.round((famImpl / famEntries.length) * 100) : 0
    return { family: fam, total: famEntries.length, score: famScore }
  }).filter(Boolean) as { family: typeof CONTROL_FAMILIES[0]; total: number; score: number }[]

  const recentActivity = entries
    .filter((e) => e.updatedAt !== e.createdAt)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8)

  return (
    <div className="min-h-full">
      <PageHeader
        title={system.name}
        subtitle={`${system.abbreviation} · ${system.systemType} · ${system.organization}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge className={getATOStatusColor(system.atoStatus)}>{system.atoStatus}</Badge>
            <Button variant="secondary" size="sm" onClick={() => navigate(`/systems/${systemId}/sctm`)}>
              Open SCTM
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate(`/systems/${systemId}/reports`)}>
              Generate SSP
            </Button>
          </div>
        }
      />

      <PageContent>
        {/* RMF Lifecycle: Hexagon + Linear Stepper */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-panel p-4 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">
              RMF Lifecycle — NIST SP 800-37 Rev 2
            </span>
            <span className="text-[10px] text-slate-600 font-mono">Auto-Pilot Active</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            {/* 3D Hexagon nav */}
            <div className="lg:col-span-1">
              <RMFHexagon
                activeStep={hexStep}
                onStepClick={setHexStep}
              />
            </div>
            {/* Linear stepper */}
            <div className="lg:col-span-2">
              <RMFStepper systemId={systemId!} />
            </div>
          </div>
        </motion.div>

        {/* AUTO-PILOT Status Panel — ProjectControls from PostgreSQL */}
        {projectSummary && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-card p-4 mb-6"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">AUTO-PILOT Hydration Status</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.25)' }}>
                  PostgreSQL
                </span>
              </div>
              <span className="text-[10px] text-slate-600">{projectSummary.total} controls hydrated</span>
            </div>
            <div className="flex items-center gap-4">
              {/* AUTO-FILLED badge */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                onClick={() => navigate(`/systems/${systemId}/sctm`)}
                className="flex-1 flex items-center gap-3 rounded-lg px-4 py-3 cursor-pointer"
                style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.2)' }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(34,211,238,0.12)' }}>
                  <Database className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <div className="text-xl font-bold text-cyan-400">{projectSummary.autoFilled}</div>
                  <div className="text-[11px] font-semibold text-cyan-600 uppercase tracking-wider">AUTO-FILLED</div>
                  <div className="text-[10px] text-slate-500">Standard library text applied</div>
                </div>
              </motion.div>

              {/* Progress bar */}
              <div className="hidden lg:flex flex-col gap-1 flex-1 max-w-xs">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>Hydration coverage</span>
                  <span>{projectSummary.total > 0 ? Math.round((projectSummary.autoFilled / projectSummary.total) * 100) : 0}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,85,0,0.15)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #22d3ee, #0ea5e9)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${projectSummary.total > 0 ? (projectSummary.autoFilled / projectSummary.total) * 100 : 0}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                  />
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-cyan-600">{projectSummary.autoFilled} auto-filled</span>
                  <span style={{ color: '#FF6B1A' }}>{projectSummary.tailoringRequired} need tailoring</span>
                </div>
              </div>

              {/* TAILORING REQUIRED badge */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="flex-1 flex items-center gap-3 rounded-lg px-4 py-3 cursor-pointer pulse-glow"
                style={{ background: 'rgba(255,85,0,0.06)', border: '1px solid rgba(255,85,0,0.25)' }}
                onClick={() => navigate(`/systems/${systemId}/sctm`)}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,85,0,0.12)' }}>
                  <AlertCircle className="w-4 h-4" style={{ color: '#FF5500' }} />
                </div>
                <div>
                  <div className="text-xl font-bold" style={{ color: '#FF5500' }}>{projectSummary.tailoringRequired}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#FF6B1A' }}>TAILORING REQUIRED</div>
                  <div className="text-[10px] text-slate-500">Site-specific input needed</div>
                </div>
              </motion.div>
            </div>

            {/* Recently tailoring-required controls */}
            {projectControls.filter(c => c.tailoringRequired).length > 0 && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,85,0,0.15)' }}>
                <div className="text-[10px] text-slate-600 mb-2 uppercase tracking-wider">Controls pending site input</div>
                <div className="flex flex-wrap gap-1.5">
                  {projectControls.filter(c => c.tailoringRequired).slice(0, 16).map(c => (
                    <button
                      key={c.controlId}
                      onClick={() => navigate(`/systems/${systemId}/sctm/${c.controlId}`)}
                      className="text-[11px] font-mono px-2 py-0.5 rounded border transition-colors hover:bg-orange-900/20"
                      style={{ color: '#FF8040', borderColor: 'rgba(255,85,0,0.3)' }}
                    >
                      {c.controlId}
                    </button>
                  ))}
                  {projectControls.filter(c => c.tailoringRequired).length > 16 && (
                    <span className="text-[11px] px-2 py-0.5" style={{ color: '#FF8040' }}>
                      +{projectControls.filter(c => c.tailoringRequired).length - 16} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Top row: Readiness Meter + Stats */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6"
        >
          {/* Readiness Meter — blends SCTM + PostgreSQL data */}
          <motion.div
            variants={itemVariants}
            className="glass-card p-6 flex flex-col items-center justify-center lg:col-span-1"
          >
            {(() => {
              const pgScore = projectSummary && projectSummary.total > 0
                ? Math.round(((projectSummary.autoFilled - (projectSummary.tailoringRequired ?? 0) / 2) / projectSummary.total) * 100)
                : null
              const blendedScore = pgScore !== null
                ? Math.round((readinessScore + pgScore) / 2)
                : readinessScore
              return <ReadinessMeter score={Math.max(0, blendedScore)} size={148} />
            })()}
            <div className="mt-3 text-center">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                {entries.length} controls · {getBaselineLabel(system.selectedBaseline)} baseline
              </div>
              {projectSummary && (
                <div className="mt-1 text-[10px]" style={{ color: '#22d3ee' }}>
                  {projectSummary.autoFilled}/{projectSummary.total} auto-filled · {projectSummary.validated ?? 0} validated
                </div>
              )}
              {untailored.length > 0 && (
                <div
                  className="mt-2 flex items-center gap-1 justify-center text-[11px] px-2 py-1 rounded-full"
                  style={{
                    color: '#FF6B1A',
                    background: 'rgba(255, 85, 0, 0.08)',
                    border: '1px solid rgba(255, 85, 0, 0.25)',
                  }}
                >
                  <AlertCircle className="w-3 h-3" />
                  {untailored.length} controls need site input
                </div>
              )}
            </div>
          </motion.div>

          {/* Stat cards */}
          {[
            {
              label: 'Controls Implemented',
              value: `${implemented}/${entries.length}`,
              sub: `${partial} partially · ${planned} planned`,
              color: 'teal',
              icon: <CheckCircle className="w-5 h-5" />,
              onClick: () => navigate(`/systems/${systemId}/sctm`),
            },
            {
              label: 'Open POAMs',
              value: String(openPOAMs),
              sub: `${inProgressPOAMs} in progress`,
              color: openPOAMs > 0 ? 'red' : 'green',
              icon: <FileText className="w-5 h-5" />,
              onClick: () => navigate(`/systems/${systemId}/poam`),
            },
            {
              label: 'Vulnerabilities',
              value: String(openVulns),
              sub: `${criticalVulns} critical`,
              color: criticalVulns > 0 ? 'red' : openVulns > 0 ? 'orange' : 'green',
              icon: <AlertTriangle className="w-5 h-5" />,
              onClick: () => navigate(`/systems/${systemId}/vulnerabilities`),
            },
          ].map(({ label, value, sub, color, icon, onClick }) => (
            <motion.div key={label} variants={itemVariants}>
              <GlassStatCard
                label={label}
                value={value}
                sub={sub}
                color={color}
                icon={icon}
                onClick={onClick}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Middle row: Control Status + Family Coverage */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6"
        >
          <motion.div variants={itemVariants} className="glass-card p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Control Status
            </h3>
            <div className="flex flex-col gap-3">
              {[
                { status: 'Implemented' as ControlStatus, count: implemented },
                { status: 'Partially Implemented' as ControlStatus, count: partial },
                { status: 'Planned' as ControlStatus, count: planned },
                { status: 'Not Implemented' as ControlStatus, count: notImpl },
                { status: 'Not Applicable' as ControlStatus, count: na },
              ].map(({ status, count }) => (
                <div key={status} className="flex items-center gap-3">
                  <span
                    className={cn(
                      'text-[11px] font-medium px-2 py-0.5 rounded border w-36 text-center shrink-0',
                      getControlStatusColor(status),
                    )}
                  >
                    {status}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-navy-800">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: entries.length > 0 ? `${(count / entries.length) * 100}%` : '0%' }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className={cn('h-full rounded-full', {
                        'bg-teal-500': status === 'Implemented',
                        'bg-yellow-500': status === 'Partially Implemented',
                        'bg-blue-500': status === 'Planned',
                        'bg-red-500': status === 'Not Implemented',
                        'bg-slate-500': status === 'Not Applicable',
                      })}
                    />
                  </div>
                  <span className="text-xs text-slate-400 w-6 text-right shrink-0">{count}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="glass-card p-5 lg:col-span-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Control Family Coverage
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {familyStats.map(({ family, total, score: fScore }) => (
                <div
                  key={family.id}
                  className="flex items-center gap-3 py-1 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => navigate(`/systems/${systemId}/sctm?family=${family.id}`)}
                >
                  <div className="w-8 text-[10px] font-mono font-bold text-slate-400 shrink-0">{family.id}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-slate-400 truncate">{family.name}</span>
                      <span className="text-[11px] text-slate-500 ml-2 shrink-0">{fScore}%</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden bg-navy-800">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${fScore}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        className={cn('h-full rounded-full', {
                          'bg-cyan-400': fScore >= 80,
                          'bg-yellow-400': fScore >= 50 && fScore < 80,
                          'bg-red-400': fScore < 50,
                        })}
                        style={fScore >= 80 ? { boxShadow: '0 0 6px rgba(34,211,238,0.4)' } : {}}
                      />
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500 shrink-0">{total}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Bottom row: System Info + Activity */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <motion.div variants={itemVariants} className="glass-card p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              System Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Baseline', value: getBaselineLabel(system.selectedBaseline) },
                { label: 'Confidentiality', value: system.ciaAnswers.confidentiality },
                { label: 'Integrity', value: system.ciaAnswers.integrity },
                { label: 'Availability', value: system.ciaAnswers.availability },
                { label: 'System Owner', value: system.systemOwner || '—' },
                { label: 'ISSO', value: system.isso || '—' },
                { label: 'ISSM', value: system.issm || '—' },
                { label: 'Registered', value: formatDate(system.createdAt) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">{label}</div>
                  <div className="text-xs text-slate-200">{value}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="glass-card p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Recent SCTM Activity
            </h3>
            {recentActivity.length === 0 ? (
              <div className="text-center py-6">
                <Clock className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No recent activity. Start documenting controls.</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() => navigate(`/systems/${systemId}/sctm`)}
                >
                  Open SCTM
                </Button>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-navy-800">
                {recentActivity.map((entry) => (
                  <div
                    key={entry.controlId}
                    className="py-2.5 flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate(`/systems/${systemId}/sctm/${entry.controlId}`)}
                  >
                    <span className="text-[11px] font-mono font-semibold text-cyan-400 w-14 shrink-0 cyan-glow">
                      {entry.controlId}
                    </span>
                    <span className={cn('text-[11px] px-1.5 py-0.5 rounded border shrink-0', getControlStatusColor(entry.status))}>
                      {entry.status}
                    </span>
                    <span className="text-[11px] text-slate-500 ml-auto shrink-0">{daysSince(entry.updatedAt)}d ago</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>

        {/* Untailored controls warning */}
        {untailored.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-6 pulse-glow rounded-xl p-4"
            style={{
              background: 'rgba(255, 85, 0, 0.06)',
              border: '1px solid rgba(255, 85, 0, 0.3)',
            }}
          >
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#FF5500' }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold mb-1" style={{ color: '#FF6B1A' }}>
                  {untailored.length} Controls Require Site-Specific Tailoring
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  These controls have standard policy text that needs to be customized for your site environment
                  before the SSP can be generated.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {untailored.slice(0, 20).map((id) => (
                    <button
                      key={id}
                      onClick={() => navigate(`/systems/${systemId}/sctm/${id}`)}
                      className="text-[11px] font-mono px-2 py-0.5 rounded border transition-colors hover:bg-orange-900/20"
                      style={{ color: '#FF8040', borderColor: 'rgba(255,85,0,0.3)' }}
                    >
                      {id}
                    </button>
                  ))}
                  {untailored.length > 20 && (
                    <span
                      className="text-[11px] px-2 py-0.5 rounded"
                      style={{ color: '#FF8040' }}
                    >
                      +{untailored.length - 20} more
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/systems/${systemId}/sctm`)}
                className="shrink-0"
              >
                Open SCTM
              </Button>
            </div>
          </motion.div>
        )}
      </PageContent>
    </div>
  )
}

function GlassStatCard({
  label, value, sub, color, icon, onClick,
}: {
  label: string; value: string; sub: string; color: string; icon: React.ReactNode; onClick?: () => void
}) {
  const colorMap: Record<string, { text: string; bg: string; glow?: string }> = {
    teal: { text: 'text-teal-400', bg: 'bg-teal-400/10' },
    red: { text: 'text-red-400', bg: 'bg-red-400/10' },
    green: { text: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    orange: { text: 'text-orange-400', bg: 'bg-orange-400/10' },
    blue: { text: 'text-blue-400', bg: 'bg-blue-400/10' },
  }
  const c = colorMap[color] ?? colorMap.teal

  return (
    <div
      className={cn(
        'glass-card p-5 flex items-start gap-4 h-full',
        onClick && 'cursor-pointer',
      )}
      onClick={onClick}
    >
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', c.text, c.bg)}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-100">{value}</div>
        <div className="text-xs font-medium text-slate-300 mb-0.5">{label}</div>
        <div className="text-[11px] text-slate-500">{sub}</div>
      </div>
    </div>
  )
}
