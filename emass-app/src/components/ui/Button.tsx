import { cn } from '@/lib/cn'
import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50 disabled:pointer-events-none'

  const variants = {
    primary: 'bg-teal-500 text-navy-950 hover:bg-teal-400 active:bg-teal-600',
    secondary: 'bg-navy-700/60 text-slate-200 border border-navy-600 hover:bg-navy-600/80 hover:border-navy-500',
    ghost: 'text-slate-400 hover:text-slate-200 hover:bg-navy-700/40',
    danger: 'bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25',
    outline: 'bg-transparent text-slate-300 border border-navy-600 hover:bg-navy-700/40 hover:border-navy-500',
  }

  const sizes = {
    sm: 'text-xs px-2.5 py-1.5 h-7',
    md: 'text-sm px-3.5 py-2 h-9',
    lg: 'text-sm px-5 py-2.5 h-10',
  }

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {children}
    </button>
  )
}
