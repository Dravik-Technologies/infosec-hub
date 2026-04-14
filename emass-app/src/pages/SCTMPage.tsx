import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { Search, Download, Filter, ExternalLink, ChevronUp, ChevronDown, Wand2 } from 'lucide-react'
import { useSystemStore } from '@/store/systemStore'
import { useSCTMStore } from '@/store/sctmStore'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { getControlStatusColor, exportCSV } from '@/lib/utils'
import { getBaselineLabel } from '@/data/baselines'
import { CONTROL_FAMILIES, getFamilyName, getControlById } from '@/data/controls'
import type { SCTMEntry, ControlStatus } from '@/types'
import { cn } from '@/lib/cn'

type TableRow = SCTMEntry & {
  controlTitle: string
  controlFamily: string
  controlFamilyName: string
}

const STATUSES: ControlStatus[] = [
  'Implemented', 'Partially Implemented', 'Planned',
  'Not Implemented', 'Not Applicable', 'Inherited', 'Under Review',
]

const columnHelper = createColumnHelper<TableRow>()

export default function SCTMPage() {
  const { systemId } = useParams<{ systemId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const system = useSystemStore((s) => s.getSystemById(systemId!))
  const isFetched = useSCTMStore((s) => s._fetched[systemId!] ?? false)
  const entries = useSCTMStore((s) => s.getEntriesForSystem(systemId!))
  const bulkUpdate = useSCTMStore((s) => s.bulkUpdateStatus)
  const applyDefaults = useSCTMStore((s) => s.applyDefaultImplementations)

  const [search, setSearch] = useState('')
  const [familyFilter, setFamilyFilter] = useState(searchParams.get('family') ?? '')
  const [statusFilter, setStatusFilter] = useState<ControlStatus | ''>('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<ControlStatus>('Implemented')
  const [showDefaultsModal, setShowDefaultsModal] = useState(false)
  const [defaultsResult, setDefaultsResult] = useState<string | null>(null)
  const [isApplyingDefaults, setIsApplyingDefaults] = useState(false)

  const tableData = useMemo((): TableRow[] => {
    return entries
      .map((entry) => {
        const ctrl = getControlById(entry.controlId)
        return {
          ...entry,
          controlTitle: ctrl?.title ?? '',
          controlFamily: ctrl?.family ?? '',
          controlFamilyName: ctrl?.family ? getFamilyName(ctrl.family) : '',
        }
      })
      .filter((row) => {
        const searchLower = search.toLowerCase()
        const matchesSearch =
          !search ||
          row.controlId.toLowerCase().includes(searchLower) ||
          row.controlTitle.toLowerCase().includes(searchLower) ||
          row.implementationStatement.toLowerCase().includes(searchLower) ||
          row.responsibleRole.toLowerCase().includes(searchLower)
        const matchesFamily = !familyFilter || row.controlFamily === familyFilter
        const matchesStatus = !statusFilter || row.status === statusFilter
        return matchesSearch && matchesFamily && matchesStatus
      })
      .sort((a, b) => {
        // Natural sort by control ID
        const parseSort = (id: string) => {
          const m = id.match(/^([A-Z]+)-(\d+)/)
          if (!m) return [id, 0, 0] as [string, number, number]
          return [m[1], parseInt(m[2])] as [string, number]
        }
        const [afam, anum] = parseSort(a.controlId)
        const [bfam, bnum] = parseSort(b.controlId)
        if (afam !== bfam) return afam < bfam ? -1 : 1
        return (anum as number) - (bnum as number)
      })
  }, [entries, search, familyFilter, statusFilter])

  const columns: ColumnDef<TableRow, any>[] = [
    {
      id: 'select',
      header: () => (
        <input
          type="checkbox"
          className="w-3.5 h-3.5 rounded accent-teal-500"
          checked={selectedIds.size === tableData.length && tableData.length > 0}
          onChange={(e) => {
            if (e.target.checked) setSelectedIds(new Set(tableData.map((r) => r.controlId)))
            else setSelectedIds(new Set())
          }}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="w-3.5 h-3.5 rounded accent-teal-500"
          checked={selectedIds.has(row.original.controlId)}
          onChange={(e) => {
            const next = new Set(selectedIds)
            if (e.target.checked) next.add(row.original.controlId)
            else next.delete(row.original.controlId)
            setSelectedIds(next)
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      size: 40,
    },
    columnHelper.accessor('controlId', {
      header: 'Control ID',
      cell: (info) => (
        <span className="font-mono text-xs font-semibold text-teal-400">{info.getValue()}</span>
      ),
      size: 100,
    }),
    columnHelper.accessor('controlFamily', {
      header: 'Family',
      cell: (info) => (
        <div>
          <div className="text-[11px] font-semibold text-slate-300">{info.getValue()}</div>
          <div className="text-[10px] text-slate-500">{info.row.original.controlFamilyName}</div>
        </div>
      ),
      size: 130,
    }),
    columnHelper.accessor('controlTitle', {
      header: 'Title',
      cell: (info) => <span className="text-xs text-slate-200">{info.getValue()}</span>,
      size: 220,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => {
        const status = info.getValue() as ControlStatus
        return (
          <Badge className={cn('text-[11px]', getControlStatusColor(status))}>
            {status}
          </Badge>
        )
      },
      size: 160,
    }),
    columnHelper.accessor('implementationOrigin', {
      header: 'Origin',
      cell: (info) => <span className="text-[11px] text-slate-400">{info.getValue()}</span>,
      size: 120,
    }),
    columnHelper.accessor('responsibleRole', {
      header: 'Responsible Role',
      cell: (info) => <span className="text-[11px] text-slate-400">{info.getValue() || '—'}</span>,
      size: 150,
    }),
    columnHelper.accessor('evidenceLinks', {
      header: 'Evidence',
      cell: (info) => {
        const count = info.getValue().length
        return count > 0 ? (
          <span className="text-[11px] text-teal-400 font-medium">{count} file{count > 1 ? 's' : ''}</span>
        ) : (
          <span className="text-[11px] text-slate-600">—</span>
        )
      },
      size: 80,
    }),
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <button
          className="p-1.5 rounded text-slate-600 hover:text-teal-400 hover:bg-teal-400/10 transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/systems/${systemId}/sctm/${row.original.controlId}`)
          }}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      ),
      size: 50,
    },
  ]

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const statusSummary = entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1
    return acc
  }, {} as Record<ControlStatus, number>)

  function handleExportCSV() {
    exportCSV(
      ['Control ID', 'Family', 'Title', 'Status', 'Origin', 'Responsible Role', 'Evidence Links'],
      tableData.map((r) => [
        r.controlId, r.controlFamily, r.controlTitle, r.status,
        r.implementationOrigin, r.responsibleRole, String(r.evidenceLinks.length),
      ])
    )
  }

  function handleBulkApply() {
    if (selectedIds.size === 0) return
    bulkUpdate(systemId!, Array.from(selectedIds), bulkStatus)
    setSelectedIds(new Set())
  }

  async function handleApplyDefaults(overwrite: boolean) {
    setIsApplyingDefaults(true)
    try {
      const count = await applyDefaults(systemId!, overwrite)
      setShowDefaultsModal(false)
      setDefaultsResult(`Applied default implementations to ${count} control${count !== 1 ? 's' : ''}.`)
      setTimeout(() => setDefaultsResult(null), 4000)
    } finally {
      setIsApplyingDefaults(false)
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      <PageHeader
        title="Security Control Traceability Matrix"
        subtitle={system ? `${system.name} · ${getBaselineLabel(system.selectedBaseline)}` : ''}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Wand2 className="w-4 h-4" />} onClick={() => setShowDefaultsModal(true)}>
              Apply Defaults
            </Button>
            <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />} onClick={handleExportCSV}>
              Export CSV
            </Button>
          </div>
        }
      />

      {/* Status pills */}
      <div
        className="px-8 py-3 border-b flex items-center gap-3 overflow-x-auto"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        {STATUSES.map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter((s) => (s === status ? '' : status))}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all whitespace-nowrap',
              statusFilter === status
                ? getControlStatusColor(status)
                : 'text-slate-500 border-navy-600 hover:text-slate-300'
            )}
          >
            {status}
            {statusSummary[status] ? (
              <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-bold', statusFilter === status ? '' : 'bg-navy-700')}>
                {statusSummary[status]}
              </span>
            ) : null}
          </button>
        ))}
        <div className="ml-auto text-[11px] text-slate-500">
          {tableData.length} of {entries.length} controls shown
        </div>
      </div>

      {/* Toolbar */}
      <div
        className="px-8 py-3 border-b flex items-center gap-3"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search controls..."
            className="pl-9 pr-3 h-8 text-xs rounded-lg border bg-transparent text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 w-60"
            style={{ borderColor: 'var(--color-border)' }}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={familyFilter}
            onChange={(e) => setFamilyFilter(e.target.value)}
            className="h-8 px-2 text-xs rounded-lg border bg-navy-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <option value="">All Families</option>
            {CONTROL_FAMILIES.map((f) => (
              <option key={f.id} value={f.id}>{f.id} — {f.name}</option>
            ))}
          </select>
        </div>

        {selectedIds.size > 0 && (
          <div
            className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg border"
            style={{ background: 'var(--color-surface-3)', borderColor: 'var(--color-border)' }}
          >
            <span className="text-xs text-slate-400">{selectedIds.size} selected</span>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as ControlStatus)}
              className="h-7 px-2 text-xs rounded border bg-navy-800 text-slate-200 focus:outline-none"
              style={{ borderColor: 'var(--color-border)' }}
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <Button variant="primary" size="sm" onClick={handleBulkApply}>Apply</Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {!isFetched && (
          <div className="flex items-center justify-center py-24 gap-3 text-slate-500 text-sm">
            <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            Loading controls…
          </div>
        )}
        <table className="sctm-table w-full" style={{ display: isFetched ? undefined : 'none' }}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
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
              <tr
                key={row.id}
                className={cn(
                  'cursor-pointer transition-colors',
                  selectedIds.has(row.original.controlId) && 'bg-teal-500/5'
                )}
                onClick={() => navigate(`/systems/${systemId}/sctm/${row.original.controlId}`)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {tableData.length === 0 && (
          <div className="text-center py-16">
            <Search className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No controls match the current filters.</p>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => { setSearch(''); setFamilyFilter(''); setStatusFilter('') }}>
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {/* Toast notification */}
      {defaultsResult && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg bg-teal-700 text-white text-sm shadow-xl">
          {defaultsResult}
        </div>
      )}

      {/* Apply Defaults Modal */}
      {showDefaultsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            className="w-full max-w-md rounded-xl border p-6 shadow-2xl"
            style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
          >
            <h2 className="text-base font-semibold text-slate-100 mb-2">Apply Default Implementations</h2>
            <p className="text-sm text-slate-400 mb-4">
              This will populate implementation statements, status, and origin for all controls that have a standard default based on NIST SP 800-53 Rev 5 common practices.
            </p>
            <p className="text-sm text-slate-400 mb-6">
              Do you want to fill in only <strong className="text-slate-200">empty</strong> controls, or <strong className="text-slate-200">overwrite all</strong> (including controls you've already filled in)?
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowDefaultsModal(false)} disabled={isApplyingDefaults}>
                Cancel
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleApplyDefaults(false)} disabled={isApplyingDefaults}>
                {isApplyingDefaults ? 'Applying…' : 'Fill Empty Only'}
              </Button>
              <Button variant="primary" size="sm" onClick={() => handleApplyDefaults(true)} disabled={isApplyingDefaults}>
                {isApplyingDefaults ? 'Applying…' : 'Overwrite All'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
