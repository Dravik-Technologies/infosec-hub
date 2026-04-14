import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { Download, FileText, Table, BarChart3, Printer, CheckCircle, Loader2 } from 'lucide-react'
import { useSystemStore } from '@/store/systemStore'
import { useSCTMStore } from '@/store/sctmStore'
import { usePOAMStore } from '@/store/poamStore'
import { useVulnStore } from '@/store/vulnStore'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PageHeader, PageContent } from '@/components/ui/PageHeader'
import { getControlStatusColor, getPOAMStatusColor, getSeverityColor, computeComplianceScore, formatDate, exportCSV, exportJSON } from '@/lib/utils'
import { generateSSPDocument } from '@/lib/sspWordExport'
import { getBaselineLabel } from '@/data/baselines'
import { getControlById, getFamilyName, CONTROL_FAMILIES } from '@/data/controls'
import type { ControlStatus } from '@/types'
import { cn } from '@/lib/cn'

type ReportType = 'sctm-summary' | 'poam-export' | 'vuln-export' | 'ssp-outline' | 'full-sctm'

interface ReportOption {
  id: ReportType
  title: string
  description: string
  icon: React.ReactNode
  format: string[]
}

const REPORT_OPTIONS: ReportOption[] = [
  {
    id: 'sctm-summary',
    title: 'SCTM Summary',
    description: 'Control status overview with compliance metrics by family',
    icon: <BarChart3 className="w-5 h-5" />,
    format: ['Print', 'CSV', 'JSON'],
  },
  {
    id: 'full-sctm',
    title: 'Full SCTM Export',
    description: 'Complete SCTM with all control entries, implementation statements, and evidence',
    icon: <Table className="w-5 h-5" />,
    format: ['CSV', 'JSON'],
  },
  {
    id: 'poam-export',
    title: 'POAM Report',
    description: 'All Plan of Action & Milestones items with status and scheduling',
    icon: <FileText className="w-5 h-5" />,
    format: ['CSV', 'JSON'],
  },
  {
    id: 'vuln-export',
    title: 'Vulnerability Report',
    description: 'All tracked vulnerabilities with severity, status, and affected assets',
    icon: <FileText className="w-5 h-5" />,
    format: ['CSV', 'JSON'],
  },
  {
    id: 'ssp-outline',
    title: 'SSP Export',
    description: 'System Security Plan & Policy/Procedures document with all control implementations and POAM summary',
    icon: <CheckCircle className="w-5 h-5" />,
    format: ['Word (.docx)', 'JSON'],
  },
]

export default function ReportsPage() {
  const { systemId } = useParams<{ systemId: string }>()
  const system = useSystemStore((s) => s.getSystemById(systemId!))
  const entries = useSCTMStore((s) => s.getEntriesForSystem(systemId!))
  const poamItems = usePOAMStore((s) => s.getItemsForSystem(systemId!))
  const vulns = useVulnStore((s) => s.getVulnsForSystem(systemId!))

  const [activeReport, setActiveReport] = useState<ReportType | null>(null)
  const [generating, setGenerating] = useState(false)

  if (!system) return <div className="p-8 text-slate-400">System not found.</div>
  const sys = system

  const statusCounts = entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1
    return acc
  }, {} as Record<ControlStatus, number>)
  const score = computeComplianceScore(statusCounts)

  // Family stats
  const familyStats = CONTROL_FAMILIES.map((fam) => {
    const famEntries = entries.filter((e) => e.controlId.startsWith(fam.id + '-'))
    if (famEntries.length === 0) return null
    const famCounts = famEntries.reduce((acc, e) => {
      acc[e.status] = (acc[e.status] ?? 0) + 1
      return acc
    }, {} as Record<ControlStatus, number>)
    return {
      family: fam,
      total: famEntries.length,
      implemented: (famCounts['Implemented'] ?? 0) + (famCounts['Inherited'] ?? 0),
      partial: famCounts['Partially Implemented'] ?? 0,
      notImpl: famCounts['Not Implemented'] ?? 0,
      score: computeComplianceScore(famCounts),
    }
  }).filter(Boolean) as {
    family: typeof CONTROL_FAMILIES[0]
    total: number; implemented: number; partial: number; notImpl: number; score: number
  }[]

  function exportSCTMCSV() {
    exportCSV(
      ['Control ID', 'Family', 'Title', 'Status', 'Origin', 'Responsible Role', 'Target Date', 'Evidence Links', 'Last Updated'],
      entries.map((e) => {
        const ctrl = getControlById(e.controlId)
        return [
          e.controlId,
          ctrl?.family ?? '',
          ctrl?.title ?? '',
          e.status,
          e.implementationOrigin,
          e.responsibleRole,
          e.targetCompletionDate ?? '',
          String(e.evidenceLinks.length),
          formatDate(e.updatedAt),
        ]
      })
    )
  }

  function exportPOAMCSV() {
    exportCSV(
      ['POAM ID', 'Weakness', 'Severity', 'Status', 'Source', 'Responsible Office', 'Discovery Date', 'Scheduled Completion', 'CVE ID', 'Related Controls'],
      poamItems.map((p) => [
        p.poamId, p.weakness, p.severity, p.status, p.findingSource,
        p.responsibleOffice, formatDate(p.discoveryDate), formatDate(p.scheduledCompletionDate),
        p.cveId ?? '', p.relatedControls.join('; '),
      ])
    )
  }

  function exportVulnCSV() {
    exportCSV(
      ['Title', 'Severity', 'CVSS', 'CVE ID', 'Status', 'Source', 'Affected Assets', 'Discovery Date', 'Related Controls'],
      vulns.map((v) => [
        v.title, v.severity, v.cvssScore != null ? String(v.cvssScore) : '',
        v.cveId ?? '', v.status, v.source, v.affectedAssets.join('; '),
        formatDate(v.discoveryDate), v.relatedControls.join('; '),
      ])
    )
  }

  function exportSSPJSON() {
    const ssp = {
      metadata: {
        title: `System Security Plan — ${sys.name}`,
        systemName: sys.name,
        systemAbbreviation: sys.abbreviation,
        systemType: sys.systemType,
        organization: sys.organization,
        atoStatus: sys.atoStatus,
        atoExpirationDate: sys.atoExpirationDate,
        systemOwner: sys.systemOwner,
        isso: sys.isso,
        issm: sys.issm,
        generatedAt: new Date().toISOString(),
      },
      categorization: {
        confidentiality: sys.ciaAnswers.confidentiality,
        integrity: sys.ciaAnswers.integrity,
        availability: sys.ciaAnswers.availability,
        rationale: {
          confidentiality: sys.ciaAnswers.confidentialityRationale,
          integrity: sys.ciaAnswers.integrityRationale,
          availability: sys.ciaAnswers.availabilityRationale,
        },
        selectedBaseline: sys.selectedBaseline,
        recommendedBaseline: sys.recommendedBaseline,
      },
      controls: entries.map((e) => {
        const ctrl = getControlById(e.controlId)
        return {
          controlId: e.controlId,
          family: ctrl?.family,
          title: ctrl?.title,
          status: e.status,
          implementationOrigin: e.implementationOrigin,
          responsibleRole: e.responsibleRole,
          implementationStatement: e.implementationStatement,
          assessorNotes: e.assessorNotes,
          evidenceLinks: e.evidenceLinks,
          inheritedFrom: e.inheritedFrom,
          targetCompletionDate: e.targetCompletionDate,
          lastUpdated: e.updatedAt,
        }
      }),
      poamItems: poamItems,
      vulnerabilities: vulns,
    }
    exportJSON(ssp, `${sys.abbreviation}-SSP-${formatDate(new Date().toISOString()).replace(/\s/g, '-')}.json`)
  }

  async function handleExport(reportId: ReportType, format: string) {
    if (format === 'Print') {
      window.print()
      return
    }
    if (reportId === 'full-sctm' || reportId === 'sctm-summary') {
      if (format === 'CSV') exportSCTMCSV()
      else exportJSON(entries, `${sys.abbreviation}-SCTM.json`)
    } else if (reportId === 'poam-export') {
      if (format === 'CSV') exportPOAMCSV()
      else exportJSON(poamItems, `${sys.abbreviation}-POAM.json`)
    } else if (reportId === 'vuln-export') {
      if (format === 'CSV') exportVulnCSV()
      else exportJSON(vulns, `${sys.abbreviation}-Vulnerabilities.json`)
    } else if (reportId === 'ssp-outline') {
      if (format === 'Word (.docx)') {
        setGenerating(true)
        try {
          await generateSSPDocument(sys, entries, poamItems)
        } finally {
          setGenerating(false)
        }
      } else {
        exportSSPJSON()
      }
    }
  }

  const STATUSES: ControlStatus[] = ['Implemented', 'Partially Implemented', 'Planned', 'Not Implemented', 'Not Applicable', 'Inherited']

  return (
    <div className="min-h-full">
      <PageHeader
        title="Reports & Exports"
        subtitle={system.name}
      />

      <PageContent>
        {/* Quick stats */}
        <div
          className="rounded-xl border p-5 mb-6"
          style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">Package Summary</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-2xl font-bold text-teal-400">{score}%</div>
              <div className="text-xs text-slate-400">Overall Compliance</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-200">{entries.length}</div>
              <div className="text-xs text-slate-400">Controls in SCTM</div>
            </div>
            <div>
              <div className={cn('text-2xl font-bold', poamItems.filter((p) => p.status === 'Open').length > 0 ? 'text-red-400' : 'text-green-400')}>
                {poamItems.filter((p) => p.status === 'Open').length}
              </div>
              <div className="text-xs text-slate-400">Open POAMs</div>
            </div>
            <div>
              <div className={cn('text-2xl font-bold', vulns.filter((v) => v.status === 'Open').length > 0 ? 'text-orange-400' : 'text-green-400')}>
                {vulns.filter((v) => v.status === 'Open').length}
              </div>
              <div className="text-xs text-slate-400">Open Vulnerabilities</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Report selector */}
          <div className="lg:col-span-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Available Reports</div>
            <div className="flex flex-col gap-2">
              {REPORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setActiveReport(opt.id)}
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-xl border text-left transition-all',
                    activeReport === opt.id
                      ? 'border-teal-500/40 bg-teal-500/10'
                      : 'border-navy-600 hover:border-navy-500'
                  )}
                  style={activeReport !== opt.id ? { background: 'var(--color-surface-2)' } : {}}
                >
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', activeReport === opt.id ? 'bg-teal-500/20 text-teal-400' : 'bg-navy-700/60 text-slate-500')}>
                    {opt.icon}
                  </div>
                  <div>
                    <div className={cn('text-sm font-medium', activeReport === opt.id ? 'text-teal-300' : 'text-slate-200')}>{opt.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{opt.description}</div>
                    <div className="flex gap-1 mt-2">
                      {opt.format.map((f) => (
                        <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-navy-700/60 text-slate-500 border border-navy-600">{f}</span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Report preview / export area */}
          <div className="lg:col-span-2">
            {activeReport ? (
              <div>
                {/* Export buttons */}
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-semibold text-slate-200">
                    {REPORT_OPTIONS.find((r) => r.id === activeReport)?.title}
                  </div>
                  <div className="flex items-center gap-2">
                    {REPORT_OPTIONS.find((r) => r.id === activeReport)?.format.map((fmt) => (
                      <Button
                        key={fmt}
                        variant={fmt === 'Word (.docx)' ? 'primary' : fmt === 'JSON' ? 'primary' : 'secondary'}
                        size="sm"
                        disabled={generating && fmt === 'Word (.docx)'}
                        icon={
                          generating && fmt === 'Word (.docx)'
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : fmt === 'Print'
                            ? <Printer className="w-3.5 h-3.5" />
                            : <Download className="w-3.5 h-3.5" />
                        }
                        onClick={() => handleExport(activeReport, fmt)}
                      >
                        {generating && fmt === 'Word (.docx)'
                          ? 'Generating…'
                          : fmt === 'Print'
                          ? 'Print'
                          : `Export ${fmt}`}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* SCTM summary preview */}
                {(activeReport === 'sctm-summary' || activeReport === 'full-sctm') && (
                  <div
                    className="rounded-xl border divide-y overflow-hidden"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <div
                      className="px-4 py-3 flex items-center justify-between"
                      style={{ background: 'var(--color-surface-3)' }}
                    >
                      <span className="text-xs font-semibold text-slate-300">Control Status by Family</span>
                      <span className="text-xs text-teal-400 font-bold">{score}% Compliant</span>
                    </div>
                    {familyStats.map(({ family, total, implemented, partial, notImpl, score: fScore }) => (
                      <div
                        key={family.id}
                        className="px-4 py-3 flex items-center gap-4"
                        style={{ background: 'var(--color-surface-2)' }}
                      >
                        <div className="w-8 text-[11px] font-mono font-bold text-slate-400 shrink-0">{family.id}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-slate-300 mb-1.5 truncate">{family.name}</div>
                          <div className="flex h-2 rounded-full overflow-hidden gap-px" style={{ background: 'var(--color-surface)' }}>
                            <div className="bg-green-500 h-full transition-all" style={{ width: `${(implemented / total) * 100}%` }} />
                            <div className="bg-yellow-500 h-full transition-all" style={{ width: `${(partial / total) * 100}%` }} />
                            <div className="bg-red-500 h-full transition-all" style={{ width: `${(notImpl / total) * 100}%` }} />
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-[11px]">
                          <span className="text-slate-500">{total} ctrl</span>
                          <span className={cn('font-bold', fScore >= 80 ? 'text-green-400' : fScore >= 50 ? 'text-yellow-400' : 'text-red-400')}>{fScore}%</span>
                        </div>
                      </div>
                    ))}

                    {/* Status breakdown */}
                    <div className="px-4 py-4" style={{ background: 'var(--color-surface-3)' }}>
                      <div className="text-xs font-semibold text-slate-400 mb-3">Overall Status Distribution</div>
                      <div className="grid grid-cols-3 gap-3">
                        {STATUSES.map((status) => (
                          <div key={status} className="flex items-center gap-2">
                            <span className={cn('w-2 h-2 rounded-full shrink-0', {
                              'bg-green-500': status === 'Implemented',
                              'bg-yellow-500': status === 'Partially Implemented',
                              'bg-blue-500': status === 'Planned',
                              'bg-red-500': status === 'Not Implemented',
                              'bg-slate-500': status === 'Not Applicable',
                              'bg-purple-500': status === 'Inherited',
                            })} />
                            <span className="text-[11px] text-slate-400 truncate">{status}</span>
                            <span className="text-[11px] text-slate-300 ml-auto font-semibold">{statusCounts[status] ?? 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* POAM preview */}
                {activeReport === 'poam-export' && (
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'var(--color-surface-3)' }}>
                      <span className="text-xs font-semibold text-slate-300">{poamItems.length} POAM Items</span>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
                      {poamItems.slice(0, 8).map((item) => (
                        <div key={item.id} className="px-4 py-3 flex items-center gap-3" style={{ background: 'var(--color-surface-2)' }}>
                          <span className="font-mono text-[11px] text-teal-400 w-24 shrink-0">{item.poamId}</span>
                          <span className="text-[11px] text-slate-200 flex-1 truncate">{item.weakness}</span>
                          <Badge className={cn('text-[10px] shrink-0', getSeverityColor(item.severity))}>{item.severity}</Badge>
                          <Badge className={cn('text-[10px] shrink-0', getPOAMStatusColor(item.status))}>{item.status}</Badge>
                        </div>
                      ))}
                      {poamItems.length > 8 && (
                        <div className="px-4 py-2 text-[11px] text-slate-500 text-center" style={{ background: 'var(--color-surface-2)' }}>
                          + {poamItems.length - 8} more items in export
                        </div>
                      )}
                      {poamItems.length === 0 && (
                        <div className="px-4 py-6 text-center text-[11px] text-slate-500" style={{ background: 'var(--color-surface-2)' }}>
                          No POAM items to export.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Vuln preview */}
                {activeReport === 'vuln-export' && (
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="px-4 py-3" style={{ background: 'var(--color-surface-3)' }}>
                      <span className="text-xs font-semibold text-slate-300">{vulns.length} Vulnerabilities</span>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
                      {vulns.slice(0, 8).map((v) => (
                        <div key={v.id} className="px-4 py-3 flex items-center gap-3" style={{ background: 'var(--color-surface-2)' }}>
                          <Badge className={cn('text-[10px] shrink-0', getSeverityColor(v.severity))}>{v.severity}</Badge>
                          <span className="text-[11px] text-slate-200 flex-1 truncate">{v.title}</span>
                          {v.cveId && <span className="text-[10px] font-mono text-blue-400 shrink-0">{v.cveId}</span>}
                          <Badge className={cn('text-[10px] shrink-0', getVulnStatusColor(v.status))}>{v.status}</Badge>
                        </div>
                      ))}
                      {vulns.length === 0 && (
                        <div className="px-4 py-6 text-center text-[11px] text-slate-500" style={{ background: 'var(--color-surface-2)' }}>
                          No vulnerabilities to export.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SSP preview */}
                {activeReport === 'ssp-outline' && (
                  <div
                    className="rounded-xl border p-5"
                    style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
                  >
                    <div className="text-xs font-semibold text-slate-400 mb-1">SSP / Policy & Procedures Document</div>
                    <div className="text-[11px] text-slate-500 mb-4">
                      Word export generates a formatted .docx with classification headers/footers, per-family policy sections, all control implementations, and a POAM summary.
                    </div>
                    <div className="flex flex-col gap-3">
                      {[
                        { label: 'Cover Page', desc: 'System name, org, date, classification marking (if set)' },
                        { label: 'System Identification', desc: 'Name, type, org, contacts, ATO status' },
                        { label: 'Security Categorization (FIPS 199)', desc: 'CIA levels, rationale, selected baseline' },
                        { label: `Control Implementations — all ${system.selectedBaseline} baseline controls`, desc: 'Per family: policy intro (from -1 control), then each control with status, implementation statement, and evidence' },
                        { label: 'POAM Summary', desc: `${poamItems.length} total items — counts by status, table of open/in-progress findings` },
                      ].map(({ label, desc }) => (
                        <div key={label} className="flex items-start gap-3">
                          <CheckCircle className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs font-medium text-slate-200">{label}</div>
                            <div className="text-[11px] text-slate-500">{desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-dashed" style={{ borderColor: 'var(--color-border)' }}>
                <BarChart3 className="w-8 h-8 text-slate-600 mb-3" />
                <p className="text-sm text-slate-500">Select a report type to preview and export</p>
              </div>
            )}
          </div>
        </div>
      </PageContent>
    </div>
  )
}

function getVulnStatusColor(status: string): string {
  switch (status) {
    case 'Open': return 'text-red-400 bg-red-400/10 border-red-400/20'
    case 'Mitigated': return 'text-green-400 bg-green-400/10 border-green-400/20'
    case 'POAM Created': return 'text-orange-400 bg-orange-400/10 border-orange-400/20'
    default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20'
  }
}
