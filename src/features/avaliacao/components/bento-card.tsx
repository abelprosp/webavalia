import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

type BentoCardProps = {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'dark' | 'accent'
  title?: string
  subtitle?: string
  headerAction?: React.ReactNode
}

export function BentoCard({
  children,
  className,
  variant = 'default',
  title,
  subtitle,
  headerAction,
}: BentoCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-[1.75rem] p-5 shadow-sm transition-shadow hover:shadow-md',
        variant === 'default' && 'bg-card text-card-foreground',
        variant === 'dark' && 'bg-flux-dark text-white',
        variant === 'accent' && 'bg-flux-lime text-flux-dark',
        className
      )}
    >
      {(title || headerAction) && (
        <div className='mb-4 flex items-start justify-between gap-2'>
          <div>
            {title && (
              <h3
                className={cn(
                  'text-sm font-semibold tracking-tight',
                  variant === 'dark' && 'text-white/90',
                  variant === 'accent' && 'text-flux-dark'
                )}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p
                className={cn(
                  'mt-0.5 text-xs',
                  variant === 'default' && 'text-muted-foreground',
                  variant === 'dark' && 'text-white/50',
                  variant === 'accent' && 'text-flux-dark/70'
                )}
              >
                {subtitle}
              </p>
            )}
          </div>
          {headerAction ?? (
            <button
              type='button'
              className={cn(
                'rounded-full p-1 opacity-40 transition-opacity hover:opacity-100',
                variant === 'dark' && 'text-white',
                variant === 'default' && 'text-foreground'
              )}
              aria-label='Opções'
            >
              <MoreHorizontal className='size-4' />
            </button>
          )}
        </div>
      )}
      <div className='flex min-h-0 flex-1 flex-col'>{children}</div>
    </div>
  )
}

export function FluxBadge({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-flux-lime px-2 py-0.5 text-xs font-semibold text-flux-dark',
        className
      )}
    >
      {children}
    </span>
  )
}
