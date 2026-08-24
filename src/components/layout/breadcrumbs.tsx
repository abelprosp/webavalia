import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type BreadcrumbItem = {
  label: string
  href?: string
}

type BreadcrumbsProps = {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null

  return (
    <nav
      aria-label='Breadcrumb'
      className={cn('flex items-center gap-1 text-sm', className)}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <span
            key={`${item.label}-${index}`}
            className='flex items-center gap-1'
          >
            {index > 0 && (
              <ChevronRight
                className='size-3.5 text-muted-foreground'
                aria-hidden
              />
            )}
            {item.href && !isLast ? (
              <Link
                to={item.href}
                className='text-muted-foreground transition-colors hover:text-foreground'
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  isLast
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground'
                )}
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
