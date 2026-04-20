import { useParams } from 'react-router-dom'
import { useState } from 'react'
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  flexRender, createColumnHelper, type SortingState,
} from '@tanstack/react-table'
import { Plus, Search, Edit2, Trash2, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react'
import { useSystemStore } from '@/store/systemStore'
import { usePOAMStore } from '@/store/poamStore'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { PageHeader, PageContent } from '@/components/ui/PageHeader'
import { getPOAMStatusColor, getSeverityColor, formatDate, daysSince, generateId, today, todayDate } from '@/lib/utils'
import type { POAMItem, POAMStatus, FindingSource, Severity } from '@/types'
import { cn } from '@/lib/cn'

const columnHelper = createColumnHelper<POAMItem>()

const STATUSES: POAMStatus[] = ['Open', 'In Progress', 'Completed', 'Risk Accepted', 'False Positive', 'Vendor Dependency']
const SOURCES: FindingSource[] = ['SAR', 'Vulnerability Scan', 'Penetration Test', 'Audit', 'Self-Assessment', 'Continuous Monitoring']
const SEVERITIES: Severity[] = ['Critical', 'High', 'Moderate', 'Low', 'Informational']

const defaultForm = (): Partial<POAMItem> => ({
  weakness: '',
  description: '',
  findingSource: 'SAR',
  severity: 'Moderate',
  relatedControls: [],
  responsibleOffice: '',
  scheduledCompletionDate: '',
  milestones: [],
  mitigationDescription: '',
  status: 'Open',
  discoveryDate: todayDate(),
  closedDate: null,
  vulnerabilityId: null,
  cveId: null,
  resourcesRequired: '',
  estimatedCost: null,
})

export default function POAMPage() {
  const { systemId } = useParams<{ systemId: string }>()
  const system = useSystemStore((s) => s.getSystemById(systemId!))
  const items = usePOAMStore((s) => s.getItemsForSystem(systemId!))
  const addItem = usePOAMStore((s) => s.addItem)
  const updateItem = usePOAMStore((s) => s.updateItem)
  const deleteItem = usePOAMStore((s) => s.deleteItem)
  const generatePoamId = usePOAMStore((s) => s.generatePoamId)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<POAMStatus | ''>('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<POAMItem>>(defaultForm())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [controlInput, setControlInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const filteredItems = items.filter((item) => {
    const matchesSearch = !search ||
      item.weakness.toLowerCase().includes(search.toLowerCase()) ||
      item.poamId.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = !statusFilter || item.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const columns = [
    columnHelper.accessor('poamId', {
      header: 'POAM ID',
      cell: (info) => <span className="font-mono text-xs font-semibold text-teal-400">{info.getValue()}</span>,
      size: 120,
    }),
    columnHelper.accessor('severity', {
      header: 'Severity',
      cell: (info) => <Badge className={cn('text-[11px]', getSeverityColor(info.getValue()))}>{info.getValue()}</Badge>,
      size: 100,
    }),
    columnHelper.accessor('weakness', {
      header: 'Weakness',
      cell: (info) => <span className="text-xs text-slate-200 font-medium">{info.getValue()}</span>,
      size: 200,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => <Badge className={cn('text-[11px]', getPOAMStatusColor(info.getValue()))}>{info.getValue()}</Badge>,
      size: 130,
    }),
    columnHelper.accessor('findingSource', {
      header: 'Source',
      cell: (info) => <span className="text-[11px] text-slate-400">{info.getValue()}</span>,
      size: 130,
    }),
    columnHelper.accessor('discoveryDate', {
      header: 'Discovered',
      cell: (info) => (
        <div>
          <div className="text-xs text-slate-300">{formatDate(info.getValue())}</div>
          <div className="text-[10px] text-slate-500">{daysSince(info.getValue())}d ago</div>
        </div>
      ),
      size: 110,
    }),
    columnHelper.accessor('scheduledCompletionDate', {
      header: 'Due Date',
      cell: (info) => {
        const v = info.getValue()
        if (!v) return <span className="text-[11px] text-slate-600">—</span>
        const days = Math.ceil((new Date(v).getTime() - Date.now()) / 86400000)
        return (
          <div>
            <div className="text-xs text-slate-300">{formatDate(v)}</div>
            <div className={cn('text-[10px]', days < 0 ? 'text-red-400' : days < 30 ? 'text-yellow-400' : 'text-slate-500')}>
              {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d remaining`}
            </div>
          </div>
        )
      },
      size: 120,
    }),
    columnHelper.accessor('responsibleOffice', {
      header: 'Responsible',
      cell: (info) => <span className="text-[11px] text-slate-400">{info.getValue() || '—'}</span>,
      size: 130,
    }),
    {
      id: 'actions',
      header: '',
      cell: ({ row }: { row: { original: POAMItem } }) => (
        <div className="flex items-center gap-1">
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
      size: 70,
    },
  ]

  const table = useReactTable({
    data: filteredItems,
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
    setControlInput('')
    setSaveError(null)
    setModalOpen(true)
  }

  function openEdit(item: POAMItem) {
    setEditingId(item.id)
    setForm({ ...item })
    setControlInput(item.relatedControls.join(', '))
    setSaveError(null)
    setModalOpen(true)
  }

  async function handleSave() {
    const controls = controlInput.split(',').map((s) => s.trim()).filter(Boolean)
    const now = today()
    setSaving(true)
    setSaveError(null)
    try {
      if (editingId) {
        await updateItem(systemId!, editingId, { ...form, relatedControls: controls, updatedAt: now } as Partial<POAMItem>)
      } else {
        const newItem: POAMItem = {
          id: generateId(),
          systemId: systemId!,
          poamId: generatePoamId(systemId!),
          ...form,
          relatedControls: controls,
          milestones: [],
          createdAt: now,
          updatedAt: now,
        } as POAMItem
        await addItem(systemId!, newItem)
      }
      setModalOpen(false)
    } catch (err: any) {
      setSaveError(err.message ?? 'Failed to save POAM item')
    } finally {
      setSaving(false)
    }
  }

  const openCount = items.filter((i) => i.status === 'Open').length
  const criticalCount = items.filter((i) => i.severity === 'Critical' && i.status === 'Open').length

  return (
    <div className="min-h-full flex flex-col">
      <PageHeader
        title="Plan of Action & Milestones"
        subtitle={system?.name}
        actions={
          <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>
            Add POAM Item
          </Button>
        }
      />

      {/* Summary */}
      <div className="px-8 py-3 border-b flex items-center gap-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        {[
          { label: 'Total', value: items.length, color: 'text-slate-300' },
          { label: 'Open', value: openCount, color: openCount > 0 ? 'text-red-400' : 'text-slate-400' },
          { label: 'Critical', value: criticalCount, color: criticalCount > 0 ? 'text-red-400 font-bold' : 'text-slate-400' },
          { label: 'Completed', value: items.filter((i) => i.status === 'Completed').length, color: 'text-green-400' },
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
              placeholder="Search POAMs..."
              className="pl-8 pr-3 h-7 text-xs rounded-lg border bg-transparent text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500/50 w-48"
              style={{ borderColor: 'var(--color-border)' }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as POAMStatus | '')}
            className="h-7 px-2 text-xs rounded-lg border bg-navy-800 text-slate-200 focus:outline-none"
            style={{ borderColor: 'var(--color-border)' }}
          >
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

        {filteredItems.length === 0 && (
          <div className="text-center py-16">
            <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">
              {items.length === 0 ? 'No POAM items yet. Add your first finding.' : 'No items match the current filters.'}
            </p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingId ? 'Edit POAM Item' : 'Add POAM Item'}
        size="lg"
        footer={
          <>
            {saveError && (
              <span className="text-xs text-red-400 mr-auto">{saveError}</span>
            )}
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
              {editingId ? 'Save Changes' : 'Add Item'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Weakness / Finding Title *"
            value={form.weakness ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, weakness: e.target.value }))}
            placeholder="Brief description of the weakness"
          />
          <Textarea
            label="Description"
            value={form.description ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Detailed description of the weakness and its security impact..."
            rows={3}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Severity"
              value={form.severity ?? 'Moderate'}
              onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as Severity }))}
              options={SEVERITIES.map((s) => ({ value: s, label: s }))}
            />
            <Select
              label="Status"
              value={form.status ?? 'Open'}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as POAMStatus }))}
              options={STATUSES.map((s) => ({ value: s, label: s }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Finding Source"
              value={form.findingSource ?? 'SAR'}
              onChange={(e) => setForm((f) => ({ ...f, findingSource: e.target.value as FindingSource }))}
              options={SOURCES.map((s) => ({ value: s, label: s }))}
            />
            <Input
              label="Responsible Office"
              value={form.responsibleOffice ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, responsibleOffice: e.target.value }))}
              placeholder="e.g. IT Security Team"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Discovery Date"
              type="date"
              value={form.discoveryDate ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, discoveryDate: e.target.value }))}
            />
            <Input
              label="Scheduled Completion"
              type="date"
              value={form.scheduledCompletionDate ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, scheduledCompletionDate: e.target.value }))}
            />
          </div>
          <Input
            label="Related Controls (comma-separated)"
            value={controlInput}
            onChange={(e) => setControlInput(e.target.value)}
            placeholder="e.g. AC-2, IA-5, SC-7"
          />
          <Input
            label="CVE ID (if applicable)"
            value={form.cveId ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, cveId: e.target.value || null }))}
            placeholder="CVE-YYYY-NNNNN"
          />
          <Textarea
            label="Mitigation Description"
            value={form.mitigationDescription ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, mitigationDescription: e.target.value }))}
            placeholder="Describe the planned or completed mitigation actions..."
            rows={3}
          />
          <Input
            label="Resources Required"
            value={form.resourcesRequired ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, resourcesRequired: e.target.value }))}
            placeholder="e.g. 40 engineer hours, $5,000"
          />
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Delete POAM Item"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={() => { deleteItem(systemId!, confirmDeleteId!); setConfirmDeleteId(null) }}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">Are you sure you want to delete this POAM item? This cannot be undone.</p>
      </Modal>
    </div>
  )
}
