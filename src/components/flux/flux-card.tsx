import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type FluxCardProps = {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md'
}

const paddingClass = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
} as const

export function FluxCard({
  children,
  className,
  padding = 'md',
}: FluxCardProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[1.75rem] border border-black/[0.06] bg-card shadow-sm',
        paddingClass[padding],
        className
      )}
    >
      {children}
    </div>
  )
}
