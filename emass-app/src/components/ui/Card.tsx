import { cn } from '@/lib/cn'

interface CardProps {
  children: React.ReactNode
  className?: string
  header?: React.ReactNode
  padding?: boolean
}

export function Card({ children, className, header, padding = true }: CardProps) {
  return (
    <div
      className={cn('rounded-xl border', className)}
      style={{
        background: 'var(--color-surface-2)',
        borderColor: 'var(--color-border)',
      }}
    >
      {header && (
        <div
          className="px-5 py-3.5 border-b text-sm font-semibold text-slate-200"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {header}
        </div>
      )}
      <div className={cn(padding && 'p-5')}>{children}</div>
    </div>
  )
}
