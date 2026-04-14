import { cn } from '@/lib/cn'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
  breadcrumb?: React.ReactNode
}

export function PageHeader({ title, subtitle, actions, className, breadcrumb }: PageHeaderProps) {
  return (
    <div
      className={cn('px-8 py-5 border-b', className)}
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {breadcrumb && <div className="mb-2">{breadcrumb}</div>}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100">{title}</h1>
          {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  )
}

export function PageContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('p-8', className)}>{children}</div>
}
