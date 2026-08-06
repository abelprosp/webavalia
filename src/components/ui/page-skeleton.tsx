import { Skeleton } from '@/components/ui/skeleton'

type PageSkeletonProps = {
  rows?: number
}

export function PageSkeleton({ rows = 5 }: PageSkeletonProps) {
  return (
    <div className='space-y-4' aria-busy='true' aria-label='Carregando'>
      <div className='grid gap-4 sm:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className='h-24 rounded-xl' />
        ))}
      </div>
      <Skeleton className='h-10 max-w-md rounded-md' />
      <div className='space-y-2'>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className='h-14 rounded-lg' />
        ))}
      </div>
    </div>
  )
}
