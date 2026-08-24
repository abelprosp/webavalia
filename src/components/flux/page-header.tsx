import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  Breadcrumbs,
  type BreadcrumbItem,
} from '@/components/layout/breadcrumbs'

type PageHeaderProps = {
  title: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs items={breadcrumbs} className='mb-1' />
      )}
      <div className='flex flex-wrap items-end justify-between gap-4'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-bold tracking-tight'>{title}</h1>
          {description ? (
            <p className='text-muted-foreground'>{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className='flex shrink-0 flex-wrap gap-2'>{actions}</div>
        ) : null}
      </div>
    </div>
  )
}
