import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download, FileText, Table, BarChart3, Printer,
  CheckCircle, Loader2, FileDown, Zap,
} from 'lucide-react'
import { useSystemStore } from '@/store/systemStore'
import { useSCTMStore } from '@/store/sctmStore'
import { usePOAMStore } from '@/store/poamStore'
import { useVulnStore } from '@/store/vulnStore'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageHeader, PageContent } from '@/components/ui/PageHeader'
import RMFStepper from '@/components/rmf/RMFStepper'
import ReadinessMeter from '@/components/rmf/ReadinessMeter'
import { getControlStatusColor, getPOAMStatusColor, getSeverityColor, formatDate, exportCSV, exportJSON } from '@/lib/utils'
import { generateSSPDocument } from '@/lib/sspWordExport'
import { computeReadinessScore } from '@/lib/hydration'
import { getBaselineLabel } from '@/data/baselines'
import { getControlById, CONTROL_FAMILIES } from '@/data/controls'
import type { ControlStatus } from '@/types'
import { cn } from '@/lib/cn'

type ReportType = 'sctm-summary' | 'poam-export' | 'vuln-export' | 'full-sctm'

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
]

const STATUSES: ControlStatus[] = ['Implemented', 'Partially Implemented', 'Planned', 'Not Implemented', 'Not Applicable', 'Inherited']

export default function ReportsPage() {
  const { systemId } = useParams<{ systemId: string }>()
  const system = useSystemStore((s) => s.getSystemById(systemId!))
  const entries = useSCTMStore((s) => s.getEntriesForSystem(systemId!))
  const poamItems = usePOAMStore((s) => s.getItemsForSystem(systemId!))
  const vulns = useVulnStore((s) => s.getVulnsForSystem(systemId!))

  const [activeReport, setActiveReport] = useState<ReportType | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)

  if (!system) return <div className="p-8 text-slate-400">System not found.</div>
  const sys = system

  const statusCounts = entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1
    return acc
  }, {} as Record<ControlStatus, number>)

  const readinessScore = computeReadinessScore(entries)

  const familyStats = CONTROL_FAMILIES.map((fam) => {
    const famEntries = entries.filter((e) => e.controlId.startsWith(fam.id + '-'))
    if (famEntries.length === 0) return null
    const famCounts = famEntries.reduce((acc, e) => {
      acc[e.status] = (acc[e.status] ?? 0) + 1
      return acc
    }, {} as Record<ControlStatus, number>)
    const famImpl = (famCounts['Implemented'] ?? 0) + (famCounts['Inherited'] ?? 0)
    const fScore = famEntries.length > 0 ? Math.round((famImpl / famEntries.length) * 100) : 0
    return { family: fam, total: famEntries.length, implemented: famImpl, partial: famCounts['Partially Implemented'] ?? 0, notImpl: famCounts['Not Implemented'] ?? 0, score: fScore }
  }).filter(Boolean) as { family: typeof CONTROL_FAMILIES[0]; total: number; implemented: number; partial: number; notImpl: number; score: number }[]

  function exportSCTMCSV() {
    exportCSV(
      ['Control ID', 'Family', 'Title', 'Status', 'Origin', 'Responsible Role', 'Target Date', 'Evidence Links', 'Last Updated'],
      entries.map((e) => {
        const ctrl = getControlById(e.controlId)
        return [e.controlId, ctrl?.family ?? '', ctrl?.title ?? '', e.status, e.implementationOrigin, e.responsibleRole, e.targetCompletionDate ?? '', String(e.evidenceLinks.length), formatDate(e.updatedAt)]
      })
    )
  }

  function exportPOAMCSV() {
    exportCSV(
      ['POAM ID', 'Weakness', 'Severity', 'Status', 'Source', 'Responsible Office', 'Discovery Date', 'Scheduled Completion', 'CVE ID', 'Related Controls'],
      poamItems.map((p) => [p.poamId, p.weakness, p.severity, p.status, p.findingSource, p.responsibleOffice, formatDate(p.discoveryDate), formatDate(p.scheduledCompletionDate), p.cveId ?? '', p.relatedControls.join('; ')])
    )
  }

  function exportVulnCSV() {
    exportCSV(
      ['Title', 'Severity', 'CVSS', 'CVE ID', 'Status', 'Source', 'Affected Assets', 'Discovery Date', 'Related Controls'],
      vulns.map((v) => [v.title, v.severity, v.cvssScore != null ? String(v.cvssScore) : '', v.cveId ?? '', v.status, v.source, v.affectedAssets.join('; '), formatDate(v.discoveryDate), v.relatedControls.join('; ')])
    )
  }

  function exportSSPJSON() {
    const ssp = {
      metadata: { title: `SSP — ${sys.name}`, systemName: sys.name, systemAbbreviation: sys.abbreviation, organization: sys.organization, atoStatus: sys.atoStatus, isso: sys.isso, issm: sys.issm, generatedAt: new Date().toISOString() },
      categorization: { confidentiality: sys.ciaAnswers.confidentiality, integrity: sys.ciaAnswers.integrity, availability: sys.ciaAnswers.availability, selectedBaseline: sys.selectedBaseline },
      controls: entries.map((e) => { const ctrl = getControlById(e.controlId); return { controlId: e.controlId, family: ctrl?.family, title: ctrl?.title, status: e.status, implementationOrigin: e.implementationOrigin, responsibleRole: e.responsibleRole, implementationStatement: e.implementationStatement, assessorNotes: e.assessorNotes, evidenceLinks: e.evidenceLinks } }),
      poamItems, vulnerabilities: vulns,
    }
    exportJSON(ssp, `${sys.abbreviation}-SSP-${new Date().toISOString().slice(0, 10)}.json`)
  }

  async function handleGenerateSSP() {
    setGenerating(true)
    setGenerated(false)
    try {
      await generateSSPDocument(sys, entries, poamItems)
      setGenerated(true)
      setTimeout(() => setGenerated(false), 5000)
    } finally {
      setGenerating(false)
    }
  }

  async function handleExport(reportId: ReportType, format: string) {
    if (format === 'Print') { window.print(); return }
    if (reportId === 'full-sctm' || reportId === 'sctm-summary') {
      if (format === 'CSV') exportSCTMCSV()
      else exportJSON(entries, `${sys.abbreviation}-SCTM.json`)
    } else if (reportId === 'poam-export') {
      if (format === 'CSV') exportPOAMCSV()
      else exportJSON(poamItems, `${sys.abbreviation}-POAM.json`)
    } else if (reportId === 'vuln-export') {
      if (format === 'CSV') exportVulnCSV()
      else exportJSON(vulns, `${sys.abbreviation}-Vulnerabilities.json`)
    }
  }

  return (
    <div className="min-h-full">
      <PageHeader title="Reports & Artifact Generation" subtitle={system.name} />

      <PageContent>
        {/* RMF Stepper */}
        <div className="glass-panel p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">RMF Step 5 — Authorize</span>
          </div>
          <RMFStepper systemId={systemId!} />
        </div>

        {/* SSP Hero Generation Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-card p-6 mb-6"
          style={{ borderColor: 'rgba(34,211,238,0.18)' }}
        >
          <div className="flex items-start gap-6">
            <ReadinessMeter score={readinessScore} size={130} className="shrink-0" />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-cyan-400 cyan-glow" />
                <h2 className="text-base font-bold text-slate-100">Generate System Security Plan</h2>
              </div>
              <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                Compile all implemented controls, policy statements, and POAM data into a formatted Word document.
                Includes cover page, FIPS 199 categorization, per-family control implementations, and POAM summary.
              </p>

              <div className="grid grid-cols-2 gap-2 mb-5">
                {[
                  { label: 'Cover Page', ok: true },
                  { label: 'FIPS 199 Categorization', ok: !!sys.ciaAnswers.confidentiality },
                  { label: `${entries.length} Controls in SCTM`, ok: entries.length > 0 },
                  { label: `${poamItems.length} POAM Items`, ok: true },
                  { label: `${vulns.length} Vulnerability Findings`, ok: true },
                  { label: `${getBaselineLabel(sys.selectedBaseline)} Baseline`, ok: !!sys.selectedBaseline },
                ].map(({ label, ok }) => (
                  <div key={label} className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: ok ? '#22d3ee' : '#334155' }} />
                    <span className={cn('text-xs', ok ? 'text-slate-300' : 'text-slate-600')}>{label}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: generating ? 1 : 1.02 }}
                  whileTap={{ scale: generating ? 1 : 0.98 }}
                  onClick={handleGenerateSSP}
                  disabled={generating}
                  className={cn('flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all', generating ? 'opacity-60 cursor-not-allowed' : '')}
                  style={{
                    background: 'linear-gradient(135deg, #22d3ee 0%, #14b8a6 100%)',
                    color: '#050d1a',
                    boxShadow: generating ? 'none' : '0 0 22px rgba(34,211,238,0.28)',
                  }}
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : generated ? <CheckCircle className="w-4 h-4" /> : <FileDown className="w-4 h-4" />}
                  {generating ? 'Generating SSP…' : generated ? 'SSP Generated!' : 'Generate SSP (.docx)'}
                </motion.button>
                <Button variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={exportSSPJSON}>
                  Export JSON
                </Button>
              </div>
            </div>

            <div className="shrink-0 rounded-xl p-4 flex flex-col gap-3 min-w-[140px]" style={{ background: 'rgba(10,22,40,0.7)', border: '1px solid rgba(30,58,95,0.8)' }}>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Package</div>
              {[
                { label: 'Baseline', value: getBaselineLabel(sys.selectedBaseline) },
                { label: 'Controls', value: entries.length },
                { label: 'Open POAMs', value: poamItems.filter((p) => p.status === 'Open').length, warn: true },
                { label: 'ATO Status', value: sys.atoStatus },
              ].map(({ label, value, warn }) => (
                <div key={label}>
                  <div className="text-[9px] uppercase text-slate-600 tracking-wider">{label}</div>
                  <div className={cn('text-xs font-semibold', warn && Number(value) > 0 ? 'text-orange-400' : 'text-slate-200')}>{String(value)}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Other reports */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Additional Exports</div>
            <div className="flex flex-col gap-2">
              {REPORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setActiveReport(opt.id)}
                  className={cn('flex items-start gap-3 p-4 rounded-xl border text-left transition-all', activeReport === opt.id ? 'border-cyan-500/40 bg-cyan-500/8' : 'border-navy-600 hover:border-navy-500')}
                  style={activeReport !== opt.id ? { background: 'var(--color-surface-2)' } : {}}
                >
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', activeReport === opt.id ? 'bg-cyan-500/20 text-cyan-400' : 'bg-navy-700/60 text-slate-500')}>
                    {opt.icon}
                  </div>
                  <div>
                    <div className={cn('text-sm font-medium', activeReport === opt.id ? 'text-cyan-300' : 'text-slate-200')}>{opt.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{opt.description}</div>
                    <div className="flex gap-1 mt-2">
                      {opt.format.map((f) => <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-navy-700/60 text-slate-500 border border-navy-600">{f}</span>)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {activeReport ? (
                <motion.div key={activeReport} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-semibold text-slate-200">{REPORT_OPTIONS.find((r) => r.id === activeReport)?.title}</div>
                    <div className="flex items-center gap-2">
                      {REPORT_OPTIONS.find((r) => r.id === activeReport)?.format.map((fmt) => (
                        <Button key={fmt} variant={fmt === 'JSON' ? 'primary' : 'secondary'} size="sm" icon={fmt === 'Print' ? <Printer className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />} onClick={() => handleExport(activeReport, fmt)}>
                          {fmt === 'Print' ? 'Print' : `Export ${fmt}`}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {(activeReport === 'sctm-summary' || activeReport === 'full-sctm') && (
                    <div className="glass-card overflow-hidden">
                      <div className="px-4 py-3 flex items-center justify-between border-b border-navy-700">
                        <span className="text-xs font-semibold text-slate-300">Control Status by Family</span>
                        <span className="text-xs text-cyan-400 font-bold">{readinessScore}% Readiness</span>
                      </div>
                      {familyStats.map(({ family, total, implemented, partial, notImpl, score: fScore }) => (
                        <div key={family.id} className="px-4 py-3 flex items-center gap-4 border-b border-navy-800 last:border-0">
                          <div className="w-8 text-[11px] font-mono font-bold text-slate-400 shrink-0">{family.id}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] text-slate-300 mb-1.5 truncate">{family.name}</div>
                            <div className="flex h-1.5 rounded-full overflow-hidden bg-navy-800">
                              <div className="bg-teal-500 h-full" style={{ width: `${(implemented / total) * 100}%` }} />
                              <div className="bg-yellow-500 h-full" style={{ width: `${(partial / total) * 100}%` }} />
                              <div className="bg-red-500 h-full" style={{ width: `${(notImpl / total) * 100}%` }} />
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 text-[11px]">
                            <span className="text-slate-500">{total} ctrl</span>
                            <span className={cn('font-bold', fScore >= 80 ? 'text-cyan-400' : fScore >= 50 ? 'text-yellow-400' : 'text-red-400')}>{fScore}%</span>
                          </div>
                        </div>
                      ))}
                      <div className="px-4 py-4 border-t border-navy-700 grid grid-cols-3 gap-3">
                        {STATUSES.map((status) => (
                          <div key={status} className="flex items-center gap-2">
                            <span className={cn('w-2 h-2 rounded-full shrink-0', { 'bg-teal-500': status === 'Implemented', 'bg-yellow-500': status === 'Partially Implemented', 'bg-blue-500': status === 'Planned', 'bg-red-500': status === 'Not Implemented', 'bg-slate-500': status === 'Not Applicable', 'bg-purple-500': status === 'Inherited' })} />
                            <span className="text-[11px] text-slate-400 truncate">{status}</span>
                            <span className="text-[11px] text-slate-300 ml-auto font-semibold">{statusCounts[status] ?? 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeReport === 'poam-export' && (
                    <div className="glass-card overflow-hidden">
                      <div className="px-4 py-3 border-b border-navy-700"><span className="text-xs font-semibold text-slate-300">{poamItems.length} POAM Items</span></div>
                      {poamItems.slice(0, 8).map((item) => (
                        <div key={item.id} className="px-4 py-3 flex items-center gap-3 border-b border-navy-800 last:border-0">
                          <span className="font-mono text-[11px] text-cyan-400 w-24 shrink-0">{item.poamId}</span>
                          <span className="text-[11px] text-slate-200 flex-1 truncate">{item.weakness}</span>
                          <Badge className={cn('text-[10px] shrink-0', getSeverityColor(item.severity))}>{item.severity}</Badge>
                          <Badge className={cn('text-[10px] shrink-0', getPOAMStatusColor(item.status))}>{item.status}</Badge>
                        </div>
                      ))}
                      {poamItems.length === 0 && <div className="px-4 py-6 text-center text-[11px] text-slate-500">No POAM items to export.</div>}
                    </div>
                  )}

                  {activeReport === 'vuln-export' && (
                    <div className="glass-card overflow-hidden">
                      <div className="px-4 py-3 border-b border-navy-700"><span className="text-xs font-semibold text-slate-300">{vulns.length} Vulnerabilities</span></div>
                      {vulns.slice(0, 8).map((v) => (
                        <div key={v.id} className="px-4 py-3 flex items-center gap-3 border-b border-navy-800 last:border-0">
                          <Badge className={cn('text-[10px] shrink-0', getSeverityColor(v.severity))}>{v.severity}</Badge>
                          <span className="text-[11px] text-slate-200 flex-1 truncate">{v.title}</span>
                          {v.cveId && <span className="text-[10px] font-mono text-blue-400 shrink-0">{v.cveId}</span>}
                        </div>
                      ))}
                      {vulns.length === 0 && <div className="px-4 py-6 text-center text-[11px] text-slate-500">No vulnerabilities to export.</div>}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-64 rounded-xl border border-dashed" style={{ borderColor: 'var(--color-border)' }}>
                  <BarChart3 className="w-8 h-8 text-slate-600 mb-3" />
                  <p className="text-sm text-slate-500">Select a report type to preview and export</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </PageContent>
    </div>
  )
}
