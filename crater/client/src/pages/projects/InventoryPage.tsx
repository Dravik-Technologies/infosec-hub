import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HardDrive, Laptop, Loader2, PackagePlus, Pencil, Save, Search, Trash2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { projectsApi, type InventoryApprovalStatus, type InventoryItem, type InventoryItemInput, type InventoryItemType } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import type { Project } from '@/types/project'

const EMPTY_FORM: InventoryItemInput = {
  item: '',
  itemType: 'HARDWARE',
  modelVersion: '',
  location: '',
  classification: '',
  approvalStatus: 'PENDING',
  notes: '',
}

const STATUS_CLASS: Record<InventoryApprovalStatus, string> = {
  APPROVED: 'border-green-matrix/30 bg-green-matrix/10 text-green-matrix',
  PENDING: 'border-yellow-400/30 bg-yellow-400/10 text-yellow-400',
  REJECTED: 'border-red-alert/30 bg-red-alert/10 text-red-alert',
  RETIRED: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
}

const TYPE_LABEL: Record<InventoryItemType, string> = {
  HARDWARE: 'Hardware',
  SOFTWARE: 'Software',
}

export default function InventoryPage({ project }: { project: Project }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<InventoryItemInput>(EMPTY_FORM)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<InventoryItemType | 'ALL'>('ALL')
  const [statusFilter, setStatusFilter] = useState<InventoryApprovalStatus | 'ALL'>('ALL')
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: [...queryKeys.projects.detail(project.id), 'inventory'],
    queryFn: () => projectsApi.listInventory(project.id),
  })

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter((item) => {
      const matchesType = typeFilter === 'ALL' || item.itemType === typeFilter
      const matchesStatus = statusFilter === 'ALL' || item.approvalStatus === statusFilter
      const matchesSearch =
        !needle ||
        [item.item, item.modelVersion, item.location, item.classification, item.notes]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle)
      return matchesType && matchesStatus && matchesSearch
    })
  }, [items, query, statusFilter, typeFilter])

  const hardwareCount = items.filter((item) => item.itemType === 'HARDWARE').length
  const softwareCount = items.filter((item) => item.itemType === 'SOFTWARE').length
  const pendingCount = items.filter((item) => item.approvalStatus === 'PENDING').length
  const approvedCount = items.filter((item) => item.approvalStatus === 'APPROVED').length

  const createMutation = useMutation({
    mutationFn: (input: InventoryItemInput) => projectsApi.createInventoryItem(project.id, normalizeInventoryInput(input)),
    onSuccess: () => {
      refreshInventory(queryClient, project.id)
      setForm(EMPTY_FORM)
      toast.success('Inventory item created')
    },
    onError: () => toast.error('Unable to create inventory item'),
  })

  const updateMutation = useMutation({
    mutationFn: (input: InventoryItemInput & { id: string }) => projectsApi.updateInventoryItem(project.id, input.id, normalizeInventoryInput(input)),
    onSuccess: () => {
      refreshInventory(queryClient, project.id)
      setEditingId(null)
      setForm(EMPTY_FORM)
      toast.success('Inventory item updated')
    },
    onError: () => toast.error('Unable to update inventory item'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.deleteInventoryItem(project.id, id),
    onSuccess: () => {
      refreshInventory(queryClient, project.id)
      toast.success('Inventory item removed')
    },
    onError: () => toast.error('Unable to remove inventory item'),
  })

  function submitItem() {
    if (!form.item.trim()) {
      toast.error('Item name is required')
      return
    }

    if (editingId) {
      updateMutation.mutate({ ...form, id: editingId })
      return
    }

    createMutation.mutate(form)
  }

  function editItem(item: InventoryItem) {
    setEditingId(item.id)
    setForm({
      item: item.item,
      itemType: item.itemType,
      modelVersion: item.modelVersion ?? '',
      location: item.location ?? '',
      classification: item.classification ?? '',
      approvalStatus: item.approvalStatus,
      notes: item.notes ?? '',
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  return (
    <div className="space-y-5">
      <section className="rmf-card active p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="hud-label text-slate-600">SSP ATTACHMENT INVENTORY</p>
            <h2 className="mt-1 font-mono text-xl text-slate-100">Hardware / Software Inventory</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Maintain the dedicated hardware and software lists assessors expect as package attachments.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
            <Metric label="HARDWARE" value={hardwareCount} tone="cyan" />
            <Metric label="SOFTWARE" value={softwareCount} tone="cyan" />
            <Metric label="PENDING" value={pendingCount} tone="yellow" />
            <Metric label="APPROVED" value={approvedCount} tone="green" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="rmf-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <PackagePlus size={17} className="text-cyan-neon" />
              <span className="hud-label">{editingId ? 'EDIT INVENTORY ITEM' : 'ADD INVENTORY ITEM'}</span>
            </div>
            {editingId && (
              <button type="button" onClick={resetForm} className="btn-secondary px-2 py-1.5" title="Cancel edit">
                <XCircle size={14} />
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            <input className="input-hud w-full" placeholder="Item name" value={form.item} onChange={(event) => setForm({ ...form, item: event.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <select className="select-hud" value={form.itemType} onChange={(event) => setForm({ ...form, itemType: event.target.value as InventoryItemType })}>
                <option value="HARDWARE">Hardware</option>
                <option value="SOFTWARE">Software</option>
              </select>
              <select className="select-hud" value={form.approvalStatus} onChange={(event) => setForm({ ...form, approvalStatus: event.target.value as InventoryApprovalStatus })}>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="RETIRED">Retired</option>
              </select>
            </div>
            <input className="input-hud w-full" placeholder="Model / version" value={form.modelVersion} onChange={(event) => setForm({ ...form, modelVersion: event.target.value })} />
            <input className="input-hud w-full" placeholder="Location" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
            <input className="input-hud w-full" placeholder="Classification" value={form.classification} onChange={(event) => setForm({ ...form, classification: event.target.value })} />
            <textarea className="textarea-hud w-full" placeholder="Approval notes, owner, or assessment context..." value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            <button type="button" onClick={submitItem} disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary inline-flex w-full items-center justify-center gap-2 text-xs disabled:opacity-60">
              {createMutation.isPending || updateMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {editingId ? 'SAVE INVENTORY ITEM' : 'CREATE INVENTORY ITEM'}
            </button>
          </div>
        </div>

        <div className="rmf-card p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="hud-label text-slate-600">INVENTORY LIBRARY</p>
              <h3 className="mt-1 font-mono text-lg text-slate-100">{filtered.length} Items</h3>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="input-hud pl-9" placeholder="Search inventory..." />
              </div>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as InventoryItemType | 'ALL')} className="select-hud sm:w-36">
                <option value="ALL">All Types</option>
                <option value="HARDWARE">Hardware</option>
                <option value="SOFTWARE">Software</option>
              </select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as InventoryApprovalStatus | 'ALL')} className="select-hud sm:w-40">
                <option value="ALL">All Status</option>
                <option value="APPROVED">Approved</option>
                <option value="PENDING">Pending</option>
                <option value="REJECTED">Rejected</option>
                <option value="RETIRED">Retired</option>
              </select>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded border border-cyan-neon/10">
            {isLoading ? (
              <p className="p-6 text-center font-mono text-sm text-cyan-neon">LOADING INVENTORY...</p>
            ) : filtered.length ? (
              <div className="divide-y divide-cyan-neon/10">
                {filtered.map((item) => (
                  <div key={item.id} className="grid gap-3 p-4 transition hover:bg-cyan-neon/5 lg:grid-cols-[minmax(0,1.2fr)_190px_150px_120px] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {item.itemType === 'HARDWARE' ? <HardDrive size={16} className="text-cyan-neon" /> : <Laptop size={16} className="text-cyan-neon" />}
                        <p className="truncate font-mono text-sm text-slate-100">{item.item}</p>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">{item.modelVersion || 'No model/version recorded'}</p>
                    </div>
                    <div>
                      <p className="hud-label text-slate-600">{TYPE_LABEL[item.itemType]}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.location || 'No location'} / {item.classification || 'Unclassified'}</p>
                    </div>
                    <span className={`w-fit rounded border px-2 py-1 font-mono text-[10px] ${STATUS_CLASS[item.approvalStatus]}`}>
                      {item.approvalStatus.replace('_', ' ')}
                    </span>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => editItem(item)} className="btn-secondary px-2 py-1.5" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => deleteMutation.mutate(item.id)} className="btn-danger px-2 py-1.5" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-8 text-center text-sm text-slate-500">No inventory items found.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'cyan' | 'green' | 'yellow' }) {
  const toneClass = tone === 'green' ? 'text-green-matrix' : tone === 'yellow' ? 'text-yellow-400' : 'text-cyan-neon'
  return (
    <div className="rounded border border-cyan-neon/10 bg-space-elevated/60 px-3 py-2">
      <p className="hud-label text-slate-600">{label}</p>
      <p className={`mt-1 font-mono text-xl font-bold ${toneClass}`}>{value}</p>
    </div>
  )
}

function normalizeInventoryInput(input: InventoryItemInput): InventoryItemInput {
  return {
    item: input.item.trim(),
    itemType: input.itemType,
    modelVersion: input.modelVersion?.trim() || undefined,
    location: input.location?.trim() || undefined,
    classification: input.classification?.trim() || undefined,
    approvalStatus: input.approvalStatus,
    notes: input.notes?.trim() || undefined,
  }
}

function refreshInventory(queryClient: ReturnType<typeof useQueryClient>, projectId: string) {
  queryClient.invalidateQueries({ queryKey: [...queryKeys.projects.detail(projectId), 'inventory'] })
  queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
}
