import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  actions,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-[1.75rem] border border-dashed py-16 text-center',
        className
      )}
    >
      {icon ? <div className='text-muted-foreground'>{icon}</div> : null}
      <div>
        <p className='font-medium'>{title}</p>
        {description ? (
          <p className='mt-1 max-w-sm text-sm text-muted-foreground'>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className='flex flex-wrap justify-center gap-2'>{actions}</div>
      ) : null}
    </div>
  )
}
