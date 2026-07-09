import { Link } from '@tanstack/react-router'
import { AvaliaLogo } from '@/assets/avalia-logo'
import { Button } from '@/components/ui/button'

type BlogLayoutProps = {
  children: React.ReactNode
}

export function BlogLayout({ children }: BlogLayoutProps) {
  return (
    <div className='min-h-svh bg-background'>
      <header className='sticky top-0 z-40 border-b bg-background/95 backdrop-blur'>
        <div className='mx-auto flex h-16 max-w-4xl items-center justify-between px-4'>
          <Link to='/blog' className='flex items-center gap-2'>
            <AvaliaLogo size='sm' />
            <span className='text-sm font-semibold'>Blog Avalia Imobe</span>
          </Link>
          <div className='flex items-center gap-2'>
            <Button variant='ghost' size='sm' asChild>
              <Link to='/blog'>Artigos</Link>
            </Button>
            <Button variant='outline' size='sm' className='rounded-full' asChild>
              <Link to='/sign-in'>Entrar</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className='mx-auto max-w-4xl px-4 py-8'>{children}</main>
    </div>
  )
}
