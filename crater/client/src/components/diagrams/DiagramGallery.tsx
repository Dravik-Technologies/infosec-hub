import { useState } from 'react'
import { CheckCircle2, CloudUpload, Download, Eye, FileText, ImageIcon, Trash2 } from 'lucide-react'
import DiagramPreviewModal from '@/components/diagrams/DiagramPreviewModal'

export interface GalleryDiagram {
  id: string
  type: string
  name: string
  size: number
  previewUrl: string
  mimeType?: string | null
}

interface DiagramGalleryProps {
  savedDiagrams: GalleryDiagram[]
  pendingDiagrams: GalleryDiagram[]
  onRemovePending?: (id: string) => void
}

function formatFileSize(size: number) {
  if (size <= 0) return 'Size pending'
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function isPdf(diagram: GalleryDiagram) {
  return diagram.mimeType === 'application/pdf' || diagram.name.toLowerCase().endsWith('.pdf')
}

function isImage(diagram: GalleryDiagram) {
  if (diagram.mimeType?.startsWith('image/')) return true
  return /\.(apng|avif|gif|jpe?g|png|svg|webp)$/i.test(diagram.name)
}

export default function DiagramGallery({ savedDiagrams, pendingDiagrams, onRemovePending }: DiagramGalleryProps) {
  const [previewDiagram, setPreviewDiagram] = useState<GalleryDiagram | null>(null)

  return (
    <div className="space-y-5">
      <DiagramSection
        title="Saved Diagrams"
        description="Uploaded files stored by the backend and linked to Step 0."
        diagrams={savedDiagrams}
        emptyText="No backend diagrams saved yet."
        variant="saved"
        onPreview={setPreviewDiagram}
      />
      <DiagramSection
        title="Pending Uploads"
        description="Local previews that will upload when you save Step 0."
        diagrams={pendingDiagrams}
        emptyText="No pending diagram files."
        variant="pending"
        onPreview={setPreviewDiagram}
        onRemove={onRemovePending}
      />

      {previewDiagram && (
        <DiagramPreviewModal diagram={previewDiagram} onClose={() => setPreviewDiagram(null)} />
      )}
    </div>
  )
}

function DiagramSection({
  title,
  description,
  diagrams,
  emptyText,
  variant,
  onPreview,
  onRemove,
}: {
  title: string
  description: string
  diagrams: GalleryDiagram[]
  emptyText: string
  variant: 'saved' | 'pending'
  onPreview: (diagram: GalleryDiagram) => void
  onRemove?: (id: string) => void
}) {
  const Icon = variant === 'saved' ? CheckCircle2 : CloudUpload

  return (
    <section className="rounded border border-cyan-neon/15 bg-space-elevated/30 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Icon size={16} className={variant === 'saved' ? 'text-green-matrix' : 'text-cyan-neon'} />
            <h4 className="hud-label">{title}</h4>
          </div>
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        </div>
        <span className="font-mono text-xs text-slate-600">{diagrams.length} FILES</span>
      </div>

      {diagrams.length === 0 ? (
        <p className="text-sm text-slate-600 mt-4">{emptyText}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
          {diagrams.map((diagram) => (
            <DiagramCard
              key={diagram.id}
              diagram={diagram}
              variant={variant}
              onPreview={() => onPreview(diagram)}
              onRemove={onRemove ? () => onRemove(diagram.id) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function DiagramCard({
  diagram,
  variant,
  onPreview,
  onRemove,
}: {
  diagram: GalleryDiagram
  variant: 'saved' | 'pending'
  onPreview: () => void
  onRemove?: () => void
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const canShowThumbnail = isImage(diagram)

  return (
    <article className="group overflow-hidden rounded border border-cyan-neon/15 bg-space-card/80 transition-all hover:border-cyan-neon/40 hover:shadow-glow-cyan">
      <button
        type="button"
        onClick={onPreview}
        className="relative block aspect-video w-full overflow-hidden bg-space text-left"
      >
        {canShowThumbnail && !imageFailed ? (
          <img
            src={diagram.previewUrl}
            alt={diagram.name}
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            {isPdf(diagram) ? (
              <FileText size={36} className="text-red-alert" />
            ) : (
              <ImageIcon size={36} className="text-cyan-neon" />
            )}
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-space/0 opacity-0 transition-all group-hover:bg-space/55 group-hover:opacity-100">
          <span className="btn-primary inline-flex items-center gap-2 px-3 py-1.5 text-xs">
            <Eye size={14} />
            PREVIEW
          </span>
        </div>
      </button>

      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-slate-100 truncate">{diagram.name}</p>
            <p className="hud-label text-slate-600 mt-1">
              {diagram.type} / {formatFileSize(diagram.size)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {variant === 'saved' && (
              <a
                href={diagram.previewUrl}
                download={diagram.name}
                className="text-slate-500 transition-colors hover:text-cyan-neon"
                aria-label={`Download ${diagram.name}`}
                onClick={(event) => event.stopPropagation()}
              >
                <Download size={15} />
              </a>
            )}
            {variant === 'pending' && onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="text-slate-500 transition-colors hover:text-red-alert"
                aria-label={`Remove ${diagram.name}`}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className={`font-mono text-[10px] uppercase tracking-widest ${
            variant === 'saved' ? 'text-green-matrix' : 'text-cyan-neon'
          }`}>
            {variant === 'saved' ? 'Saved' : 'Pending'}
          </span>
          <button
            type="button"
            onClick={onPreview}
            className="font-mono text-[10px] uppercase tracking-widest text-slate-500 transition-colors hover:text-cyan-neon"
          >
            View
          </button>
        </div>
      </div>
    </article>
  )
}
