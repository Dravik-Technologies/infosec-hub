import { useNavigate } from 'react-router-dom'
import { Plus, Shield, Calendar, ChevronRight, Trash2, AlertCircle } from 'lucide-react'
import { useSystemStore } from '@/store/systemStore'
import { useSCTMStore } from '@/store/sctmStore'
import { usePOAMStore } from '@/store/poamStore'
import { useVulnStore } from '@/store/vulnStore'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { PageHeader, PageContent } from '@/components/ui/PageHeader'
import { getATOStatusColor, computeComplianceScore, formatDate } from '@/lib/utils'
import type { InfoSystem, ControlStatus } from '@/types'
import { useState } from 'react'

function SystemCard({ system }: { system: InfoSystem }) {
  const navigate = useNavigate()
  const deleteSystem = useSystemStore((s) => s.deleteSystem)
  const entries = useSCTMStore((s) => s.getEntriesForSystem(system.id))
  const poamItems = usePOAMStore((s) => s.getItemsForSystem(system.id))
  const deleteVulns = useVulnStore((s) => s.deleteSystemVulns)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const statusCounts = entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1
    return acc
  }, {} as Record<ControlStatus, number>)

  const score = computeComplianceScore(statusCounts)
  const openPOAMs = poamItems.filter((p) => p.status === 'Open' || p.status === 'In Progress').length

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      // deleteSystem cascades on the server; local cache cleanup happens via each store
      await deleteSystem(system.id)
      await deleteVulns(system.id)
    } finally {
      setConfirmDelete(false)
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div
        className="rounded-xl border p-5 cursor-pointer hover:border-teal-500/30 transition-all group"
        style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
        onClick={() => navigate(`/systems/${system.id}/dashboard`)}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-teal-500/15 border border-teal-500/20 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-teal-400" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm text-slate-100 truncate">{system.name}</div>
              <div className="text-[11px] font-mono text-slate-500">{system.abbreviation}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getATOStatusColor(system.atoStatus)}>{system.atoStatus}</Badge>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
              className="p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-4 line-clamp-2">{system.description}</p>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div
            className="rounded-lg p-2.5 text-center"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <div className="text-lg font-bold text-teal-400">{score}%</div>
            <div className="text-[10px] text-slate-500">Compliant</div>
          </div>
          <div
            className="rounded-lg p-2.5 text-center"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <div className="text-lg font-bold text-slate-200">{entries.length}</div>
            <div className="text-[10px] text-slate-500">Controls</div>
          </div>
          <div
            className="rounded-lg p-2.5 text-center"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <div className={`text-lg font-bold ${openPOAMs > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {openPOAMs}
            </div>
            <div className="text-[10px] text-slate-500">Open POAMs</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            <span>Updated {formatDate(system.updatedAt)}</span>
          </div>
          <div className="flex items-center gap-1 text-teal-500 group-hover:text-teal-400 transition-colors">
            <span>Open</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete System"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={isDeleting}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={isDeleting}>{isDeleting ? 'Deleting…' : 'Delete'}</Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-slate-200">
              Are you sure you want to delete <strong>{system.name}</strong>?
            </p>
            <p className="text-xs text-slate-400 mt-1">
              This will permanently delete the system, all SCTM entries, and POAM items. This cannot be undone.
            </p>
          </div>
        </div>
      </Modal>
    </>
  )
}

export default function LandingPage() {
  const systems = useSystemStore((s) => s.systems)
  const navigate = useNavigate()

  return (
    <div className="min-h-full">
      <PageHeader
        title="Systems"
        subtitle={`${systems.length} system${systems.length !== 1 ? 's' : ''} registered`}
        actions={
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => navigate('/systems/new')}
          >
            New System
          </Button>
        }
      />

      <PageContent>
        {systems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-5">
              <Shield className="w-7 h-7 text-teal-500" />
            </div>
            <h2 className="text-lg font-semibold text-slate-200 mb-2">No systems yet</h2>
            <p className="text-sm text-slate-400 mb-6 max-w-sm">
              Create your first system to begin the RMF authorization process and build your SCTM.
            </p>
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => navigate('/systems/new')}
            >
              Create System
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {systems.map((system) => (
              <SystemCard key={system.id} system={system} />
            ))}
          </div>
        )}
      </PageContent>
    </div>
  )
}
