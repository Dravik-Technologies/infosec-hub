import { useParams } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { Upload, Trash2, Download, ImageIcon, FileText, Plus } from 'lucide-react'
import { useSystemStore } from '@/store/systemStore'
import { useDiagramStore } from '@/store/diagramStore'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { PageHeader, PageContent } from '@/components/ui/PageHeader'
import { useAuthStore } from '@/store/authStore'
import { formatDate } from '@/lib/utils'
import type { DiagramType } from '@/types'
import { cn } from '@/lib/cn'

function AuthedImage({ src, alt, token }: { src: string; alt: string; token: string | null }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    let revoked = false
    fetch(src, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        if (!revoked) setBlobUrl(URL.createObjectURL(blob))
      })
      .catch(() => {})
    return () => {
      revoked = true
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [src])

  if (!blobUrl) return <ImageIcon className="w-8 h-8 text-slate-700" />
  return <img src={blobUrl} alt={alt} className="max-h-full max-w-full object-contain p-2" />
}

const DIAGRAM_TYPES: DiagramType[] = [
  'Authorization Boundary',
  'Network',
  'Data Flow',
  'Hardware',
  'Software',
  'Other',
]

const TYPE_COLORS: Record<DiagramType, string> = {
  'Authorization Boundary': 'text-teal-400 bg-teal-400/10 border-teal-500/20',
  'Network': 'text-blue-400 bg-blue-400/10 border-blue-500/20',
  'Data Flow': 'text-purple-400 bg-purple-400/10 border-purple-500/20',
  'Hardware': 'text-orange-400 bg-orange-400/10 border-orange-500/20',
  'Software': 'text-yellow-400 bg-yellow-400/10 border-yellow-500/20',
  'Other': 'text-slate-400 bg-slate-400/10 border-slate-500/20',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DiagramsPage() {
  const { systemId } = useParams<{ systemId: string }>()
  const system = useSystemStore((s) => s.getSystemById(systemId!))
  const diagrams = useDiagramStore((s) => s.getDiagrams(systemId!))
  const fetchDiagrams = useDiagramStore((s) => s.fetchDiagrams)
  const uploadDiagram = useDiagramStore((s) => s.uploadDiagram)
  const deleteDiagram = useDiagramStore((s) => s.deleteDiagram)
  const token = useAuthStore((s) => s.token)

  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [diagramType, setDiagramType] = useState<DiagramType>('Authorization Boundary')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [typeFilter, setTypeFilter] = useState<DiagramType | ''>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchDiagrams(systemId!)
  }, [systemId])

  function openModal() {
    setName('')
    setDiagramType('Authorization Boundary')
    setDescription('')
    setFile(null)
    setUploadError(null)
    setModalOpen(true)
  }

  async function handleUpload() {
    if (!file) { setUploadError('Please select a file'); return }
    if (!name.trim()) { setUploadError('Please enter a diagram name'); return }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', name.trim())
    formData.append('diagramType', diagramType)
    formData.append('description', description.trim())

    setUploading(true)
    setUploadError(null)
    try {
      await uploadDiagram(systemId!, formData)
      setModalOpen(false)
    } catch (err: any) {
      setUploadError(err.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      await deleteDiagram(systemId!, id)
    } finally {
      setDeleting(false)
      setConfirmDeleteId(null)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    if (f && !name.trim()) {
      // auto-fill name from filename (strip extension)
      setName(f.name.replace(/\.[^/.]+$/, ''))
    }
  }

  function getFileUrl(diagramId: string) {
    return `/api/systems/${systemId}/diagrams/${diagramId}/file`
  }

  function downloadWithAuth(diagramId: string, originalName: string) {
    fetch(getFileUrl(diagramId), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = originalName
        a.click()
        URL.revokeObjectURL(url)
      })
  }

  const filtered = typeFilter ? diagrams.filter((d) => d.diagramType === typeFilter) : diagrams

  return (
    <div className="min-h-full flex flex-col">
      <PageHeader
        title="Diagrams & Drawings"
        subtitle={system?.name}
        actions={
          <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={openModal}>
            Upload Diagram
          </Button>
        }
      />

      {/* Filter bar */}
      <div
        className="px-8 py-3 border-b flex items-center gap-4"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setTypeFilter('')}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              !typeFilter
                ? 'bg-teal-500/15 text-teal-400 border-teal-500/30'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            )}
          >
            All ({diagrams.length})
          </button>
          {DIAGRAM_TYPES.map((t) => {
            const count = diagrams.filter((d) => d.diagramType === t).length
            if (count === 0) return null
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  typeFilter === t
                    ? TYPE_COLORS[t]
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                )}
              >
                {t} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Grid */}
      <PageContent>
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <ImageIcon className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-400 mb-1">
              {diagrams.length === 0 ? 'No diagrams uploaded yet.' : 'No diagrams match this filter.'}
            </p>
            {diagrams.length === 0 && (
              <p className="text-xs text-slate-500">
                Upload boundary, network, data flow, and other required RMF diagrams here.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((diagram) => (
              <div
                key={diagram.id}
                className="rounded-xl border flex flex-col overflow-hidden"
                style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
              >
                {/* Preview / icon area */}
                <div
                  className="h-36 flex items-center justify-center relative"
                  style={{ background: 'var(--color-surface)' }}
                >
                  {diagram.mimeType.startsWith('image/') ? (
                    <AuthedImage
                      src={getFileUrl(diagram.id)}
                      alt={diagram.name}
                      token={token}
                    />
                  ) : diagram.mimeType === 'application/pdf' ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-10 h-10 text-red-400" />
                      <span className="text-xs text-slate-500">PDF</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <ImageIcon className="w-10 h-10 text-slate-600" />
                      <span className="text-xs text-slate-500">{diagram.mimeType.split('/')[1]?.toUpperCase()}</span>
                    </div>
                  )}
                </div>

                {/* Meta */}
                <div className="p-3 flex flex-col gap-1.5 flex-1">
                  <div className="font-medium text-sm text-slate-200 truncate" title={diagram.name}>
                    {diagram.name}
                  </div>
                  <span
                    className={cn(
                      'self-start text-[11px] font-medium px-2 py-0.5 rounded-full border',
                      TYPE_COLORS[diagram.diagramType as DiagramType] ?? TYPE_COLORS['Other']
                    )}
                  >
                    {diagram.diagramType}
                  </span>
                  {diagram.description && (
                    <p className="text-[11px] text-slate-500 line-clamp-2">{diagram.description}</p>
                  )}
                  <div className="text-[10px] text-slate-600 mt-auto pt-1">
                    {formatBytes(diagram.size)} · {formatDate(diagram.createdAt)}
                  </div>
                </div>

                {/* Actions */}
                <div
                  className="flex items-center gap-1 px-3 py-2 border-t"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <button
                    onClick={() => downloadWithAuth(diagram.id, diagram.originalName)}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-400 transition-colors px-2 py-1 rounded hover:bg-teal-400/10"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(diagram.id)}
                    className="ml-auto p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageContent>

      {/* Upload Modal */}
      <Modal
        open={modalOpen}
        onClose={() => !uploading && setModalOpen(false)}
        title="Upload Diagram"
        size="md"
        footer={
          <>
            {uploadError && <span className="text-xs text-red-400 mr-auto">{uploadError}</span>}
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)} disabled={uploading}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleUpload} loading={uploading}>
              Upload
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {/* File drop zone */}
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
              file ? 'border-teal-500/40 bg-teal-500/5' : 'border-slate-700 hover:border-slate-500'
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/png,image/jpeg,image/svg+xml,image/gif,image/webp,application/pdf"
              onChange={handleFileChange}
            />
            <Upload className="w-7 h-7 text-slate-500 mx-auto mb-2" />
            {file ? (
              <div>
                <p className="text-sm font-medium text-teal-400">{file.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{formatBytes(file.size)}</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-400">Click to select a file</p>
                <p className="text-xs text-slate-600 mt-1">PNG, JPG, SVG, GIF, WEBP, PDF · max 20 MB</p>
              </div>
            )}
          </div>

          <Input
            label="Diagram Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. System Authorization Boundary"
          />
          <Select
            label="Diagram Type *"
            value={diagramType}
            onChange={(e) => setDiagramType(e.target.value as DiagramType)}
            options={DIAGRAM_TYPES.map((t) => ({ value: t, label: t }))}
          />
          <Textarea
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of what this diagram shows..."
            rows={2}
          />
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Delete Diagram"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)} disabled={deleting}>Cancel</Button>
            <Button
              variant="danger"
              size="sm"
              loading={deleting}
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">Delete this diagram? The file cannot be recovered.</p>
      </Modal>
    </div>
  )
}
