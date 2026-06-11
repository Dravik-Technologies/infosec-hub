import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Eye, FileArchive, FileText, Image, Loader2, Search, Trash2, UploadCloud, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { projectsApi, resolveApiAssetUrl, type ArtifactRecord, type ArtifactType } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import type { Project } from '@/types/project'

const ARTIFACT_TYPES: Array<{ value: ArtifactType; label: string }> = [
  { value: 'APPOINTMENT_LETTER', label: 'Appointment Letter' },
  { value: 'USER_AGREEMENT', label: 'User Agreement' },
  { value: 'PRIVILEGED_USER_AGREEMENT', label: 'Privileged User Agreement' },
  { value: 'VULNERABILITY_SCAN', label: 'Vulnerability Scan' },
  { value: 'TEMPEST_DIAGRAM', label: 'TEMPEST Diagram' },
  { value: 'ISA', label: 'ISA' },
  { value: 'MOU', label: 'MOU' },
  { value: 'TRAINING_RECORD', label: 'Training Record' },
  { value: 'OTHER', label: 'Other' },
]

const TYPE_LABEL = Object.fromEntries(ARTIFACT_TYPES.map((item) => [item.value, item.label])) as Record<ArtifactType, string>

function parseFilename(contentDisposition: string | undefined) {
  if (!contentDisposition) return 'Crater-RMF-Package.zip'
  const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i)
  return filenameMatch?.[1] ?? 'Crater-RMF-Package.zip'
}

function formatSize(size?: number | null) {
  if (!size) return '—'
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function isPreviewable(artifact: ArtifactRecord) {
  return artifact.mimeType?.startsWith('image/') || artifact.mimeType === 'application/pdf'
}

export default function ArtifactsPage({ project }: { project: Project }) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const [type, setType] = useState<ArtifactType | 'ALL'>('ALL')
  const [uploadType, setUploadType] = useState<ArtifactType>('OTHER')
  const [tags, setTags] = useState('')
  const [stepNumber, setStepNumber] = useState('')
  const [controlId, setControlId] = useState('')
  const [poamItemId, setPoamItemId] = useState('')
  const [description, setDescription] = useState('')
  const [preview, setPreview] = useState<ArtifactRecord | null>(null)

  const { data: artifacts = [], isLoading } = useQuery({
    queryKey: [...queryKeys.projects.detail(project.id), 'artifacts'],
    queryFn: () => projectsApi.listArtifacts(project.id),
  })

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return artifacts.filter((artifact) => {
      const matchesType = type === 'ALL' || artifact.type === type
      const matchesSearch =
        !needle ||
        [artifact.title, artifact.fileName, artifact.description, artifact.controlId, artifact.uploadedBy?.email, ...(artifact.tags ?? [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle)
      return matchesType && matchesSearch
    })
  }, [artifacts, query, type])

  const upload = useMutation({
    mutationFn: (files: FileList) => {
      const formData = new FormData()
      Array.from(files).forEach((file) => formData.append('files', file))
      formData.append('type', uploadType)
      if (tags.trim()) formData.append('tags', tags)
      if (description.trim()) formData.append('description', description)
      if (stepNumber) formData.append('stepNumber', stepNumber)
      if (controlId.trim()) formData.append('controlId', controlId.trim())
      if (poamItemId.trim()) formData.append('poamItemId', poamItemId.trim())
      return projectsApi.uploadArtifacts(project.id, formData)
    },
    onSuccess: (records) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) })
      queryClient.invalidateQueries({ queryKey: [...queryKeys.projects.detail(project.id), 'artifacts'] })
      toast.success(`Uploaded ${records.length} artifact${records.length === 1 ? '' : 's'}`)
    },
    onError: () => toast.error('Artifact upload failed'),
  })

  const remove = useMutation({
    mutationFn: (artifactId: string) => projectsApi.deleteArtifact(project.id, artifactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) })
      queryClient.invalidateQueries({ queryKey: [...queryKeys.projects.detail(project.id), 'artifacts'] })
      toast.success('Artifact deleted')
    },
    onError: () => toast.error('Unable to delete artifact'),
  })

  const downloadPackage = useMutation({
    mutationFn: () => projectsApi.generatePackage(project.id),
    onSuccess: (response) => {
      const filename = parseFilename(response.headers['content-disposition'])
      const url = URL.createObjectURL(response.data)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success('RMF package downloaded')
    },
    onError: () => toast.error('RMF package export failed'),
  })

  return (
    <div className="space-y-5">
      <section className="rmf-card active p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="hud-label text-slate-600">CENTRALIZED EVIDENCE</p>
            <h2 className="mt-1 font-mono text-xl text-slate-100">Artifacts Library</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Upload appointment letters, agreements, scans, training records, ISA/MOU documents, and any evidence needed for the RMF package.
            </p>
          </div>
          <button
            type="button"
            onClick={() => downloadPackage.mutate()}
            disabled={downloadPackage.isPending}
            className="btn-primary inline-flex items-center justify-center gap-2 text-xs disabled:opacity-60"
          >
            {downloadPackage.isPending ? <Loader2 size={15} className="animate-spin" /> : <FileArchive size={15} />}
            EXPORT RMF PACKAGE
          </button>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="rmf-card p-5">
          <p className="hud-label text-slate-600">UPLOAD</p>
          <h3 className="mt-1 font-mono text-lg text-slate-100">Add Artifacts</h3>
          <div className="mt-5 space-y-4">
            <label>
              <span className="hud-label mb-2 block">TYPE</span>
              <select value={uploadType} onChange={(event) => setUploadType(event.target.value as ArtifactType)} className="select-hud">
                {ARTIFACT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label>
              <span className="hud-label mb-2 block">TAGS</span>
              <input value={tags} onChange={(event) => setTags(event.target.value)} className="input-hud" placeholder="cui, onboarding, quarterly" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="hud-label mb-2 block">STEP</span>
                <input value={stepNumber} onChange={(event) => setStepNumber(event.target.value)} className="input-hud" placeholder="0-6" />
              </label>
              <label>
                <span className="hud-label mb-2 block">CONTROL</span>
                <input value={controlId} onChange={(event) => setControlId(event.target.value)} className="input-hud" placeholder="AC-2" />
              </label>
            </div>
            <label>
              <span className="hud-label mb-2 block">POA&M ID</span>
              <input value={poamItemId} onChange={(event) => setPoamItemId(event.target.value)} className="input-hud" placeholder="Optional POA&M item ID" />
            </label>
            <label>
              <span className="hud-label mb-2 block">DESCRIPTION</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="textarea-hud" placeholder="Describe evidence purpose, source, or reviewer notes..." />
            </label>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files?.length) upload.mutate(event.target.files)
                event.target.value = ''
              }}
            />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={upload.isPending} className="btn-primary inline-flex w-full items-center justify-center gap-2 text-xs disabled:opacity-60">
              {upload.isPending ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
              SELECT FILES
            </button>
          </div>
        </aside>

        <section className="rmf-card p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="hud-label text-slate-600">LIBRARY</p>
              <h3 className="mt-1 font-mono text-lg text-slate-100">{filtered.length} Artifacts</h3>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="input-hud pl-9" placeholder="Search artifacts..." />
              </div>
              <select value={type} onChange={(event) => setType(event.target.value as ArtifactType | 'ALL')} className="select-hud sm:w-56">
                <option value="ALL">All Types</option>
                {ARTIFACT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded border border-cyan-neon/10">
            {isLoading ? (
              <p className="p-6 text-center font-mono text-sm text-cyan-neon">LOADING ARTIFACTS...</p>
            ) : filtered.length ? (
              <div className="divide-y divide-cyan-neon/10">
                {filtered.map((artifact) => (
                  <div key={artifact.id} className="grid gap-3 p-4 transition hover:bg-cyan-neon/5 lg:grid-cols-[minmax(0,1.4fr)_180px_130px_160px] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {artifact.mimeType?.startsWith('image/') ? <Image size={16} className="text-cyan-neon" /> : <FileText size={16} className="text-cyan-neon" />}
                        <p className="truncate font-mono text-sm text-slate-100">{artifact.title}</p>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">{artifact.fileName}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {artifact.tags?.map((tag) => <span key={tag} className="rounded border border-cyan-neon/20 px-2 py-0.5 font-mono text-[10px] text-cyan-neon">{tag}</span>)}
                      </div>
                    </div>
                    <div>
                      <p className="hud-label text-slate-600">{TYPE_LABEL[artifact.type]}</p>
                      <p className="mt-1 text-xs text-slate-500">Step {artifact.step?.stepNumber ?? '—'} / {artifact.controlId ?? 'No control'}</p>
                    </div>
                    <div>
                      <p className="font-mono text-xs text-slate-400">{formatSize(artifact.fileSize)}</p>
                      <p className="mt-1 text-xs text-slate-500">{new Date(artifact.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex justify-end gap-2">
                      {isPreviewable(artifact) && (
                        <button type="button" onClick={() => setPreview(artifact)} className="btn-secondary px-2 py-1.5" title="Preview">
                          <Eye size={14} />
                        </button>
                      )}
                      <a href={resolveApiAssetUrl(artifact.fileUrl)} download={artifact.fileName} className="btn-secondary px-2 py-1.5" title="Download">
                        <Download size={14} />
                      </a>
                      <button type="button" onClick={() => remove.mutate(artifact.id)} className="btn-danger px-2 py-1.5" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-8 text-center text-sm text-slate-500">No artifacts found.</p>
            )}
          </div>
        </section>
      </section>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="rmf-card active flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-cyan-neon/15 p-4">
              <div>
                <p className="hud-label text-slate-600">{TYPE_LABEL[preview.type]}</p>
                <h3 className="font-mono text-base text-slate-100">{preview.title}</h3>
              </div>
              <button type="button" onClick={() => setPreview(null)} className="btn-secondary px-2 py-1.5"><X size={15} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-space p-4">
              {preview.mimeType?.startsWith('image/') ? (
                <img src={resolveApiAssetUrl(preview.fileUrl)} alt={preview.title} className="mx-auto max-h-[70vh] max-w-full object-contain" />
              ) : (
                <iframe src={resolveApiAssetUrl(preview.fileUrl)} title={preview.title} className="h-[70vh] w-full rounded border border-cyan-neon/15" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
