import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  flexRender, createColumnHelper, type SortingState,
} from '@tanstack/react-table'
import { Plus, Search, Edit2, Trash2, AlertTriangle, ChevronUp, ChevronDown, ArrowUpCircle } from 'lucide-react'
import { useSystemStore } from '@/store/systemStore'
import { useVulnStore } from '@/store/vulnStore'
import { usePOAMStore } from '@/store/poamStore'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { getSeverityColor, getVulnStatusColor, formatDate, generateId, today, todayDate } from '@/lib/utils'
import type { Vulnerability, VulnStatus, ScanSource, Severity, POAMItem, POAMStatus, FindingSource } from '@/types'
import { cn } from '@/lib/cn'

const columnHelper = createColumnHelper<Vulnerability>()
const STATUSES: VulnStatus[] = ['Open', 'Mitigated', 'False Positive', 'Risk Accepted', 'POAM Created']
const SOURCES: ScanSource[] = ['ACAS/Nessus', 'OpenVAS', 'Qualys', 'Manual', 'STIG/SRG', 'Penetration Test', 'Other']
const SEVERITIES: Severity[] = ['Critical', 'High', 'Moderate', 'Low', 'Informational']

const defaultForm = (): Partial<Vulnerability> => ({
  title: '', description: '', severity: 'High', cvssScore: null, cveId: null,
  pluginId: null, source: 'ACAS/Nessus', affectedAssets: [], relatedControls: [],
  status: 'Open', discoveryDate: todayDate(), mitigationNotes: '', poamId: null, scanDate: todayDate(),
})

export default function VulnerabilitiesPage() {
  const { systemId } = useParams<{ systemId: string }>()
  const navigate = useNavigate()
  const system = useSystemStore((s) => s.getSystemById(systemId!))
  const vulns = useVulnStore((s) => s.getVulnsForSystem(systemId!))
  const addVuln = useVulnStore((s) => s.addVuln)
  const updateVuln = useVulnStore((s) => s.updateVuln)
  const deleteVuln = useVulnStore((s) => s.deleteVuln)
  const escalateToPOAM = useVulnStore((s) => s.escalateToPOAM)
  const addPOAMItem = usePOAMStore((s) => s.addItem)
  const generatePoamId = usePOAMStore((s) => s.generatePoamId)

  const [search, setSearch] = useState('')
  const [sevFilter, setSevFilter] = useState<Severity | ''>('')
  const [statusFilter, setStatusFilter] = useState<VulnStatus | ''>('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<Vulnerability>>(defaultForm())
  const [assetsInput, setAssetsInput] = useState('')
  const [controlsInput, setControlsInput] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const filteredVulns = vulns.filter((v) => {
    const searchLower = search.toLowerCase()
    const matchesSearch = !search || v.title.toLowerCase().includes(searchLower) ||
      (v.cveId ?? '').toLowerCase().includes(searchLower) || v.description.toLowerCase().includes(searchLower)
    const matchesSev = !sevFilter || v.severity === sevFilter
    const matchesStatus = !statusFilter || v.status === statusFilter
    return matchesSearch && matchesSev && matchesStatus
  }).sort((a, b) => {
    const rank = (s: Severity) => ({ Critical: 5, High: 4, Moderate: 3, Low: 2, Informational: 1 }[s] ?? 0)
    return rank(b.severity) - rank(a.severity)
  })

  const columns = [
    columnHelper.accessor('severity', {
      header: 'Severity',
      cell: (info) => <Badge className={cn('text-[11px]', getSeverityColor(info.getValue()))}>{info.getValue()}</Badge>,
      size: 100,
    }),
    columnHelper.accessor('cvssScore', {
      header: 'CVSS',
      cell: (info) => {
        const score = info.getValue()
        return score != null ? (
          <span className={cn('text-xs font-mono font-bold', score >= 9 ? 'text-red-400' : score >= 7 ? 'text-orange-400' : score >= 4 ? 'text-yellow-400' : 'text-green-400')}>
            {score.toFixed(1)}
          </span>
        ) : <span className="text-slate-600 text-xs">—</span>
      },
      size: 60,
    }),
    columnHelper.accessor('title', {
      header: 'Title',
      cell: (info) => <span className="text-xs text-slate-200 font-medium">{info.getValue()}</span>,
      size: 220,
    }),
    columnHelper.accessor('cveId', {
      header: 'CVE',
      cell: (info) => info.getValue() ? (
        <span className="text-[11px] font-mono text-blue-400">{info.getValue()}</span>
      ) : <span className="text-slate-600 text-xs">—</span>,
      size: 130,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => <Badge className={cn('text-[11px]', getVulnStatusColor(info.getValue()))}>{info.getValue()}</Badge>,
      size: 130,
    }),
    columnHelper.accessor('source', {
      header: 'Source',
      cell: (info) => <span className="text-[11px] text-slate-400">{info.getValue()}</span>,
      size: 110,
    }),
    columnHelper.accessor('affectedAssets', {
      header: 'Assets',
      cell: (info) => {
        const assets = info.getValue()
        return assets.length > 0 ? (
          <span className="text-[11px] text-slate-400">{assets.slice(0, 2).join(', ')}{assets.length > 2 ? ` +${assets.length - 2}` : ''}</span>
        ) : <span className="text-slate-600 text-xs">—</span>
      },
      size: 140,
    }),
    columnHelper.accessor('discoveryDate', {
      header: 'Discovered',
      cell: (info) => <span className="text-[11px] text-slate-400">{formatDate(info.getValue())}</span>,
      size: 100,
    }),
    {
      id: 'actions',
      header: '',
      cell: ({ row }: { row: { original: Vulnerability } }) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {row.original.status === 'Open' && (
            <button
              title="Escalate to POAM"
              onClick={(e) => { e.stopPropagation(); handleEscalate(row.original) }}
              className="p-1.5 rounded text-slate-600 hover:text-orange-400 hover:bg-orange-400/10 transition-colors"
            >
              <ArrowUpCircle className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); openEdit(row.original) }}
            className="p-1.5 rounded text-slate-600 hover:text-teal-400 hover:bg-teal-400/10 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(row.original.id) }}
            className="p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
      size: 90,
    },
  ]

  const table = useReactTable({
    data: filteredVulns,
    columns: columns as any,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  function openNew() {
    setEditingId(null)
    setForm(defaultForm())
    setAssetsInput('')
    setControlsInput('')
    setModalOpen(true)
  }

  function openEdit(v: Vulnerability) {
    setEditingId(v.id)
    setForm({ ...v })
    setAssetsInput(v.affectedAssets.join(', '))
    setControlsInput(v.relatedControls.join(', '))
    setModalOpen(true)
  }

  function handleSave() {
    const assets = assetsInput.split(',').map((s) => s.trim()).filter(Boolean)
    const controls = controlsInput.split(',').map((s) => s.trim()).filter(Boolean)
    const now = today()
    if (editingId) {
      updateVuln(systemId!, editingId, { ...form, affectedAssets: assets, relatedControls: controls, updatedAt: now } as Partial<Vulnerability>)
    } else {
      const newVuln: Vulnerability = {
        id: generateId(), systemId: systemId!,
        ...form, affectedAssets: assets, relatedControls: controls,
        createdAt: now, updatedAt: now,
      } as Vulnerability
      addVuln(systemId!, newVuln)
    }
    setModalOpen(false)
  }

  function handleEscalate(vuln: Vulnerability) {
    const now = today()
    const poamItem: POAMItem = {
      id: generateId(), systemId: systemId!,
      poamId: generatePoamId(systemId!),
      weakness: vuln.title,
      description: vuln.description,
      findingSource: 'Vulnerability Scan' as FindingSource,
      severity: vuln.severity,
      relatedControls: vuln.relatedControls,
      responsibleOffice: '',
      scheduledCompletionDate: '',
      milestones: [],
      mitigationDescription: vuln.mitigationNotes,
      status: 'Open' as POAMStatus,
      discoveryDate: vuln.discoveryDate,
      closedDate: null,
      vulnerabilityId: vuln.id,
      cveId: vuln.cveId,
      resourcesRequired: '',
      estimatedCost: null,
      createdAt: now,
      updatedAt: now,
    }
    addPOAMItem(systemId!, poamItem)
    escalateToPOAM(systemId!, vuln.id, poamItem.id)
    navigate(`/systems/${systemId}/poam`)
  }

  const openCount = vulns.filter((v) => v.status === 'Open').length
  const criticalCount = vulns.filter((v) => v.severity === 'Critical' && v.status === 'Open').length

  return (
    <div className="min-h-full flex flex-col">
      <PageHeader
        title="Vulnerability Tracker"
        subtitle={system?.name}
        actions={
          <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>
            Add Vulnerability
          </Button>
        }
      />

      {/* Summary */}
      <div className="px-8 py-3 border-b flex items-center gap-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        {[
          { label: 'Total', value: vulns.length, color: 'text-slate-300' },
          { label: 'Open', value: openCount, color: openCount > 0 ? 'text-red-400' : 'text-slate-400' },
          { label: 'Critical', value: criticalCount, color: criticalCount > 0 ? 'text-red-400 font-bold' : 'text-slate-400' },
          { label: 'Mitigated', value: vulns.filter((v) => v.status === 'Mitigated').length, color: 'text-green-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-center gap-2">
            <span className={cn('text-lg font-bold', color)}>{value}</span>
            <span className="text-xs text-slate-500">{label}</span>
          </div>
        ))}

        <div className="ml-auto flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vulns..."
              className="pl-8 pr-3 h-7 text-xs rounded-lg border bg-transparent text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500/50 w-44"
              style={{ borderColor: 'var(--color-border)' }}
            />
          </div>
          <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value as Severity | '')} className="h-7 px-2 text-xs rounded-lg border bg-navy-800 text-slate-200 focus:outline-none" style={{ borderColor: 'var(--color-border)' }}>
            <option value="">All Severities</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as VulnStatus | '')} className="h-7 px-2 text-xs rounded-lg border bg-navy-800 text-slate-200 focus:outline-none" style={{ borderColor: 'var(--color-border)' }}>
            <option value="">All Status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="sctm-table w-full">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id} style={{ width: header.getSize() }}
                    className={header.column.getCanSort() ? 'cursor-pointer' : ''}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' && <ChevronUp className="w-3 h-3" />}
                      {header.column.getIsSorted() === 'desc' && <ChevronDown className="w-3 h-3" />}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="cursor-pointer" onClick={() => openEdit(row.original)}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {filteredVulns.length === 0 && (
          <div className="text-center py-16">
            <AlertTriangle className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">
              {vulns.length === 0 ? 'No vulnerabilities tracked. Add findings from scanner results.' : 'No vulnerabilities match current filters.'}
            </p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Vulnerability' : 'Add Vulnerability'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleSave}>{editingId ? 'Save' : 'Add'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Title *" value={form.title ?? ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. OpenSSL Heartbleed Vulnerability" />
          <Textarea label="Description" value={form.description ?? ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder="Describe the vulnerability, impact, and attack vector..." />
          <div className="grid grid-cols-3 gap-4">
            <Select label="Severity" value={form.severity ?? 'High'} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as Severity }))} options={SEVERITIES.map((s) => ({ value: s, label: s }))} />
            <Select label="Status" value={form.status ?? 'Open'} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as VulnStatus }))} options={STATUSES.map((s) => ({ value: s, label: s }))} />
            <Select label="Scan Source" value={form.source ?? 'ACAS/Nessus'} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as ScanSource }))} options={SOURCES.map((s) => ({ value: s, label: s }))} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="CVSS Score" type="number" min="0" max="10" step="0.1" value={form.cvssScore ?? ''} onChange={(e) => setForm((f) => ({ ...f, cvssScore: e.target.value ? parseFloat(e.target.value) : null }))} placeholder="0.0 – 10.0" />
            <Input label="CVE ID" value={form.cveId ?? ''} onChange={(e) => setForm((f) => ({ ...f, cveId: e.target.value || null }))} placeholder="CVE-YYYY-NNNNN" />
            <Input label="Plugin ID" value={form.pluginId ?? ''} onChange={(e) => setForm((f) => ({ ...f, pluginId: e.target.value || null }))} placeholder="e.g. 12345" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Discovery Date" type="date" value={form.discoveryDate ?? ''} onChange={(e) => setForm((f) => ({ ...f, discoveryDate: e.target.value }))} />
            <Input label="Scan Date" type="date" value={form.scanDate ?? ''} onChange={(e) => setForm((f) => ({ ...f, scanDate: e.target.value || null }))} />
          </div>
          <Input label="Affected Assets (comma-separated)" value={assetsInput} onChange={(e) => setAssetsInput(e.target.value)} placeholder="e.g. server01, 192.168.1.10, webapp-prod" />
          <Input label="Related Controls (comma-separated)" value={controlsInput} onChange={(e) => setControlsInput(e.target.value)} placeholder="e.g. SC-8, IA-5, SI-2" />
          <Textarea label="Mitigation Notes" value={form.mitigationNotes ?? ''} onChange={(e) => setForm((f) => ({ ...f, mitigationNotes: e.target.value }))} rows={2} placeholder="Describe planned or completed mitigations..." />
        </div>
      </Modal>

      <Modal open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} title="Delete Vulnerability" size="sm"
        footer={<><Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>Cancel</Button><Button variant="danger" size="sm" onClick={() => { deleteVuln(systemId!, confirmDeleteId!); setConfirmDeleteId(null) }}>Delete</Button></>}
      >
        <p className="text-sm text-slate-300">Are you sure you want to delete this vulnerability?</p>
      </Modal>
    </div>
  )
}
