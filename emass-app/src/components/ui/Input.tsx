import { cn } from '@/lib/cn'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-slate-300">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'h-9 px-3 text-sm rounded-lg border bg-transparent text-slate-200 placeholder-slate-500 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500',
          error ? 'border-red-500/50' : 'border-navy-600 hover:border-navy-500',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: { value: string; label: string }[]
}

export function Select({ label, error, hint, options, className, id, ...props }: SelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-slate-300">
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={cn(
          'h-9 px-3 text-sm rounded-lg border bg-navy-800 text-slate-200 transition-colors appearance-none',
          'focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500',
          error ? 'border-red-500/50' : 'border-navy-600 hover:border-navy-500',
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export function Textarea({ label, error, hint, className, id, ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-slate-300">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={cn(
          'px-3 py-2 text-sm rounded-lg border bg-transparent text-slate-200 placeholder-slate-500 transition-colors resize-none',
          'focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500',
          error ? 'border-red-500/50' : 'border-navy-600 hover:border-navy-500',
          className
        )}
        rows={3}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
