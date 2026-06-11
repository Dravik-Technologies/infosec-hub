import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  active?: boolean
}

export function Card({ active = false, className, ...props }: CardProps) {
  return <div className={cn('rmf-card', active && 'active', className)} {...props} />
}
