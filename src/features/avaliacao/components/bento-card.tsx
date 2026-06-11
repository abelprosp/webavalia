import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

type BentoCardProps = {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'dark' | 'accent' | 'muted'
  title?: string
  subtitle?: string
  headerAction?: React.ReactNode
  showMenu?: boolean
}

export function BentoCard({
  children,
  className,
  variant = 'default',
  title,
  subtitle,
  headerAction,
  showMenu = false,
}: BentoCardProps) {
  return (
    <div
      className={cn(
        'flex min-h-[140px] flex-col rounded-[1.75rem] border border-black/[0.04] p-5 shadow-[0_2px_24px_-4px_rgba(0,0,0,0.06)] transition-all duration-200 hover:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.1)]',
        variant === 'default' && 'bg-card text-card-foreground',
        variant === 'dark' &&
          'border-white/[0.06] bg-flux-dark text-white shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35)]',
        variant === 'accent' && 'border-transparent bg-flux-lime text-flux-dark',
        variant === 'muted' && 'bg-muted/30 text-card-foreground',
        className
      )}
    >
      {(title || headerAction || showMenu) && (
        <div className='mb-3 flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            {title && (
              <h3
                className={cn(
                  'text-[13px] font-semibold tracking-tight',
                  variant === 'dark' && 'text-white',
                  variant === 'accent' && 'text-flux-dark'
                )}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p
                className={cn(
                  'mt-0.5 truncate text-[11px] leading-snug',
                  variant === 'default' && 'text-muted-foreground',
                  variant === 'dark' && 'text-white/45',
                  variant === 'accent' && 'text-flux-dark/65',
                  variant === 'muted' && 'text-muted-foreground'
                )}
              >
                {subtitle}
              </p>
            )}
          </div>
          {headerAction ??
            (showMenu ? (
              <button
                type='button'
                className={cn(
                  'shrink-0 rounded-full p-1 opacity-30 transition-opacity hover:opacity-70',
                  variant === 'dark' ? 'text-white' : 'text-foreground'
                )}
                aria-label='Opções'
              >
                <MoreHorizontal className='size-4' />
              </button>
            ) : null)}
        </div>
      )}
      <div className='flex min-h-0 flex-1 flex-col'>{children}</div>
    </div>
  )
}

export function FluxBadge({
  children,
  className,
  variant = 'lime',
}: {
  children: React.ReactNode
  className?: string
  variant?: 'lime' | 'lavender' | 'dark'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-tight',
        variant === 'lime' && 'bg-flux-lime text-flux-dark',
        variant === 'lavender' && 'bg-flux-lavender/80 text-flux-dark',
        variant === 'dark' && 'bg-flux-dark text-white',
        className
      )}
    >
      {children}
    </span>
  )
}

export function MetricIcon({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-2xl',
        className
      )}
    >
      {children}
    </div>
  )
}
