import { useParams, useNavigate } from 'react-router-dom'
import { Shield, AlertTriangle, CheckCircle, Clock, FileText, ChevronRight, TrendingUp } from 'lucide-react'
import { useSystemStore } from '@/store/systemStore'
import { useSCTMStore } from '@/store/sctmStore'
import { usePOAMStore } from '@/store/poamStore'
import { useVulnStore } from '@/store/vulnStore'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageHeader, PageContent } from '@/components/ui/PageHeader'
import { getATOStatusColor, getControlStatusColor, computeComplianceScore, formatDate, daysSince } from '@/lib/utils'
import { getBaselineLabel } from '@/data/baselines'
import { CONTROL_FAMILIES } from '@/data/controls'
import type { ControlStatus } from '@/types'
import { cn } from '@/lib/cn'

export default function DashboardPage() {
  const { systemId } = useParams<{ systemId: string }>()
  const navigate = useNavigate()
  const system = useSystemStore((s) => s.getSystemById(systemId!))
  const entries = useSCTMStore((s) => s.getEntriesForSystem(systemId!))
  const poamItems = usePOAMStore((s) => s.getItemsForSystem(systemId!))
  const vulns = useVulnStore((s) => s.getVulnsForSystem(systemId!))

  if (!system) {
    return <div className="p-8 text-slate-400">System not found.</div>
  }

  const statusCounts = entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1
    return acc
  }, {} as Record<ControlStatus, number>)

  const score = computeComplianceScore(statusCounts)
  const implemented = (statusCounts['Implemented'] ?? 0) + (statusCounts['Inherited'] ?? 0)
  const partial = statusCounts['Partially Implemented'] ?? 0
  const notImpl = statusCounts['Not Implemented'] ?? 0
  const planned = statusCounts['Planned'] ?? 0
  const na = statusCounts['Not Applicable'] ?? 0

  const openPOAMs = poamItems.filter((p) => p.status === 'Open').length
  const inProgressPOAMs = poamItems.filter((p) => p.status === 'In Progress').length
  const openVulns = vulns.filter((v) => v.status === 'Open').length
  const criticalVulns = vulns.filter((v) => v.severity === 'Critical' && v.status === 'Open').length

  // Per-family compliance
  const familyStats = CONTROL_FAMILIES.map((fam) => {
    const famEntries = entries.filter((e) => e.controlId.startsWith(fam.id + '-'))
    if (famEntries.length === 0) return null
    const famStatusCounts = famEntries.reduce((acc, e) => {
      acc[e.status] = (acc[e.status] ?? 0) + 1
      return acc
    }, {} as Record<ControlStatus, number>)
    const famScore = computeComplianceScore(famStatusCounts)
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
          </div>
        }
      />

      <PageContent>
        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Compliance Score"
            value={`${score}%`}
            sub={`${implemented} of ${entries.length} controls`}
            color="teal"
            icon={<TrendingUp className="w-5 h-5" />}
            onClick={() => navigate(`/systems/${systemId}/sctm`)}
          />
          <StatCard
            label="Open POAMs"
            value={String(openPOAMs)}
            sub={`${inProgressPOAMs} in progress`}
            color={openPOAMs > 0 ? 'red' : 'green'}
            icon={<FileText className="w-5 h-5" />}
            onClick={() => navigate(`/systems/${systemId}/poam`)}
          />
          <StatCard
            label="Open Vulnerabilities"
            value={String(openVulns)}
            sub={`${criticalVulns} critical`}
            color={criticalVulns > 0 ? 'red' : openVulns > 0 ? 'orange' : 'green'}
            icon={<AlertTriangle className="w-5 h-5" />}
            onClick={() => navigate(`/systems/${systemId}/vulnerabilities`)}
          />
          <StatCard
            label="ATO Status"
            value={system.atoStatus}
            sub={system.atoExpirationDate ? `Expires ${formatDate(system.atoExpirationDate)}` : 'No expiration set'}
            color="blue"
            icon={<Shield className="w-5 h-5" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Control status breakdown */}
          <Card header="Control Status" className="lg:col-span-1">
            <div className="flex flex-col gap-2">
              {[
                { status: 'Implemented' as ControlStatus, count: implemented },
                { status: 'Partially Implemented' as ControlStatus, count: partial },
                { status: 'Planned' as ControlStatus, count: planned },
                { status: 'Not Implemented' as ControlStatus, count: notImpl },
                { status: 'Not Applicable' as ControlStatus, count: na },
              ].map(({ status, count }) => (
                <div key={status} className="flex items-center gap-3">
                  <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded border w-36 text-center', getControlStatusColor(status))}>
                    {status}
                  </span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface)' }}>
                    <div
                      className={cn('h-full rounded-full transition-all', {
                        'bg-green-500': status === 'Implemented',
                        'bg-yellow-500': status === 'Partially Implemented',
                        'bg-blue-500': status === 'Planned',
                        'bg-red-500': status === 'Not Implemented',
                        'bg-slate-500': status === 'Not Applicable',
                      })}
                      style={{ width: entries.length > 0 ? `${(count / entries.length) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Family progress */}
          <Card header="Control Family Coverage" className="lg:col-span-2">
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
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface)' }}>
                      <div
                        className={cn('h-full rounded-full transition-all', {
                          'bg-green-500': fScore >= 80,
                          'bg-yellow-500': fScore >= 50 && fScore < 80,
                          'bg-red-500': fScore < 50,
                        })}
                        style={{ width: `${fScore}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500 shrink-0">{total}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* System info + Recent activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <Card header="System Details">
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
          </Card>

          <Card header="Recent SCTM Activity">
            {recentActivity.length === 0 ? (
              <div className="text-center py-6">
                <Clock className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No recent activity. Start documenting controls.</p>
                <Button variant="ghost" size="sm" className="mt-3" onClick={() => navigate(`/systems/${systemId}/sctm`)}>
                  Open SCTM
                </Button>
              </div>
            ) : (
              <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
                {recentActivity.map((entry) => (
                  <div
                    key={entry.controlId}
                    className="py-2.5 flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate(`/systems/${systemId}/sctm/${entry.controlId}`)}
                  >
                    <span className="text-[11px] font-mono font-semibold text-teal-400 w-14 shrink-0">{entry.controlId}</span>
                    <span className={cn('text-[11px] px-1.5 py-0.5 rounded border shrink-0', getControlStatusColor(entry.status))}>
                      {entry.status}
                    </span>
                    <span className="text-[11px] text-slate-500 ml-auto shrink-0">{daysSince(entry.updatedAt)}d ago</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </PageContent>
    </div>
  )
}

function StatCard({
  label, value, sub, color, icon, onClick,
}: {
  label: string; value: string; sub: string; color: string; icon: React.ReactNode; onClick?: () => void
}) {
  const colorMap: Record<string, string> = {
    teal: 'text-teal-400 bg-teal-400/10',
    red: 'text-red-400 bg-red-400/10',
    green: 'text-green-400 bg-green-400/10',
    orange: 'text-orange-400 bg-orange-400/10',
    blue: 'text-blue-400 bg-blue-400/10',
  }
  return (
    <div
      className={cn('rounded-xl border p-5 flex items-start gap-4', onClick && 'cursor-pointer hover:border-teal-500/30 transition-colors')}
      style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
      onClick={onClick}
    >
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', colorMap[color] ?? colorMap.teal)}>
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
