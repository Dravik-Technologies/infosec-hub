import { useState } from 'react'
import { Download, ExternalLink, FileText, X } from 'lucide-react'
import type { GalleryDiagram } from '@/components/diagrams/DiagramGallery'

interface DiagramPreviewModalProps {
  diagram: GalleryDiagram
  onClose: () => void
}

function isPdf(diagram: GalleryDiagram) {
  return diagram.mimeType === 'application/pdf' || diagram.name.toLowerCase().endsWith('.pdf')
}

function isImage(diagram: GalleryDiagram) {
  if (diagram.mimeType?.startsWith('image/')) return true
  return /\.(apng|avif|gif|jpe?g|png|svg|webp)$/i.test(diagram.name)
}

function canEmbedAsDocument(diagram: GalleryDiagram) {
  return isPdf(diagram) || diagram.name.toLowerCase().endsWith('.svg')
}

export default function DiagramPreviewModal({ diagram, onClose }: DiagramPreviewModalProps) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(11,15,25,0.88)', backdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagram-preview-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="rmf-card w-full max-w-6xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-cyan-neon/15 p-4">
          <div className="min-w-0">
            <p className="hud-label text-slate-600">{diagram.type} DIAGRAM</p>
            <h2 id="diagram-preview-title" className="font-mono text-base text-slate-100 mt-1 truncate">
              {diagram.name}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={diagram.previewUrl}
              download={diagram.name}
              className="btn-secondary inline-flex items-center gap-2 px-3 py-1.5 text-xs"
            >
              <Download size={14} />
              DOWNLOAD
            </a>
            <a
              href={diagram.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary inline-flex items-center gap-2 px-3 py-1.5 text-xs"
            >
              <ExternalLink size={14} />
              OPEN
            </a>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-2 py-1.5"
              aria-label="Close diagram preview"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="bg-space p-4">
          <div className="flex min-h-[60vh] items-center justify-center overflow-hidden rounded border border-cyan-neon/15 bg-space-elevated/30">
            {isImage(diagram) && !imageFailed ? (
              <img
                src={diagram.previewUrl}
                alt={diagram.name}
                onError={() => setImageFailed(true)}
                className="max-h-[72vh] w-full object-contain"
              />
            ) : canEmbedAsDocument(diagram) ? (
              <iframe src={diagram.previewUrl} title={diagram.name} className="h-[72vh] w-full bg-white" />
            ) : (
              <div className="p-10 text-center">
                <FileText size={40} className="mx-auto text-cyan-neon" />
                <p className="font-mono text-sm text-slate-100 mt-4">PREVIEW NOT AVAILABLE</p>
                <p className="text-sm text-slate-500 mt-2">Open or download this file to inspect it.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
