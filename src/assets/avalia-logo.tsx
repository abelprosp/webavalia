import { cn } from '@/lib/utils'

const LOGO_SRC = '/images/avalia-logo.png'

type AvaliaLogoProps = {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  iconOnly?: boolean
}

const sizeClasses = {
  sm: 'h-7',
  md: 'h-9',
  lg: 'h-11',
  xl: 'h-14',
} as const

export function AvaliaLogo({
  className,
  size = 'md',
  iconOnly = false,
}: AvaliaLogoProps) {
  if (iconOnly) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black',
          size === 'sm' ? 'size-8' : 'size-10',
          className
        )}
      >
        <img
          src={LOGO_SRC}
          alt='Avalia Imobe'
          className='h-full w-auto max-w-none object-left object-contain'
          draggable={false}
        />
      </div>
    )
  }

  return (
    <img
      src={LOGO_SRC}
      alt='Avalia Imobe imobiliárias'
      className={cn('w-auto object-contain', sizeClasses[size], className)}
      draggable={false}
    />
  )
}
