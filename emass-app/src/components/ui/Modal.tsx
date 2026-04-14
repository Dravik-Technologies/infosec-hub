import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  footer?: React.ReactNode
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({ open, onClose, title, children, size = 'md', footer }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5, 13, 26, 0.8)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={ref}
        className={cn('w-full rounded-2xl border shadow-2xl animate-fade-in', sizes[size])}
        style={{
          background: 'var(--color-surface-2)',
          borderColor: 'var(--color-border)',
        }}
      >
        {title && (
          <div
            className="flex items-center justify-between px-6 py-4 border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <h2 className="text-base font-semibold text-slate-100">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-navy-700/40 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
        {footer && (
          <div
            className="flex items-center justify-end gap-3 px-6 py-4 border-t"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  width?: string
}

export function Drawer({ open, onClose, title, children, width = 'w-[720px]' }: DrawerProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(5, 13, 26, 0.6)' }}
        onClick={onClose}
      />
      <div
        className={cn('relative flex flex-col h-full border-l shadow-2xl animate-slide-in', width)}
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        {title && (
          <div
            className="flex items-center justify-between px-6 py-4 border-b shrink-0"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <h2 className="text-base font-semibold text-slate-100">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-navy-700/40 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>,
    document.body
  )
}
