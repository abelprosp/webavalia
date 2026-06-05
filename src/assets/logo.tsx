import { AvaliaLogo } from './avalia-logo'

type LogoProps = {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  iconOnly?: boolean
}

export function Logo({ className, size = 'md', iconOnly }: LogoProps) {
  return <AvaliaLogo className={className} size={size} iconOnly={iconOnly} />
}
