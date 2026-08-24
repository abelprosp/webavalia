import { Outlet } from '@tanstack/react-router'
import { Palette, UserCog, Coins } from 'lucide-react'
import { CREDITS_AND_PLANS_ENABLED } from '@/lib/feature-flags'
import { Separator } from '@/components/ui/separator'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Header } from '@/components/layout/header'
import { HeaderActions } from '@/components/layout/header-actions'
import { Main } from '@/components/layout/main'
import { SidebarNav } from './components/sidebar-nav'

const sidebarNavItems = [
  {
    title: 'Perfil',
    href: '/settings',
    icon: <UserCog size={18} />,
  },
  {
    title: CREDITS_AND_PLANS_ENABLED
      ? 'Créditos e planos'
      : 'Créditos e planos (Em breve)',
    href: '/settings/credits',
    icon: <Coins size={18} />,
  },
  {
    title: 'Aparência',
    href: '/settings/appearance',
    icon: <Palette size={18} />,
  },
]

export function Settings() {
  return (
    <>
      <Header>
        <HeaderActions />
      </Header>

      <Main fixed>
        <Breadcrumbs
          items={[
            { label: 'Início', href: '/app' },
            { label: 'Configurações' },
          ]}
          className='mb-2'
        />
        <div className='space-y-0.5'>
          <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
            Configurações
          </h1>
          <p className='text-muted-foreground'>
            Gerencie sua conta, créditos e preferências da Avalia Imob.
          </p>
        </div>
        <Separator className='my-4 lg:my-6' />
        <div className='flex flex-1 flex-col space-y-2 overflow-hidden md:space-y-2 lg:flex-row lg:space-y-0 lg:space-x-12'>
          <aside className='top-0 lg:sticky lg:w-1/5'>
            <SidebarNav items={sidebarNavItems} />
          </aside>
          <div className='flex w-full overflow-y-hidden p-1'>
            <Outlet />
          </div>
        </div>
      </Main>
    </>
  )
}
