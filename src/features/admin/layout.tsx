import { Outlet, useRouterState } from '@tanstack/react-router'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Settings2,
  Shield,
  Newspaper,
  Sparkles,
} from 'lucide-react'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { HeaderActions } from '@/components/layout/header-actions'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { AdminSidebarNav } from './components/admin-sidebar-nav'

const adminNavItems = [
  {
    title: 'Visão geral',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    title: 'Usuários',
    href: '/admin/users',
    icon: Users,
  },
  {
    title: 'Avaliações',
    href: '/admin/evaluations',
    icon: Sparkles,
  },
  {
    title: 'Planos',
    href: '/admin/plans',
    icon: CreditCard,
  },
  {
    title: 'Blog',
    href: '/admin/blog',
    icon: Newspaper,
  },
  {
    title: 'Configurações',
    href: '/admin/settings',
    icon: Settings2,
  },
]

export function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const currentPage =
    adminNavItems.find((item) =>
      item.href === '/admin'
        ? pathname === '/admin'
        : pathname.startsWith(item.href)
    )?.title ?? 'Administração'

  return (
    <>
      <Header fixed>
        <HeaderActions searchClassName='me-auto' />
        <Badge variant='outline' className='gap-1.5'>
          <Shield className='size-3.5' />
          Admin
        </Badge>
      </Header>

      <Main fixed>
        <Breadcrumbs
          items={[
            { label: 'Início', href: '/' },
            { label: 'Administração', href: '/admin' },
            ...(currentPage !== 'Visão geral' ? [{ label: currentPage }] : []),
          ]}
          className='mb-2'
        />
        <div className='space-y-0.5'>
          <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
            Administração
          </h1>
          <p className='text-muted-foreground'>
            Gerencie usuários, créditos, planos e configurações da plataforma.
          </p>
        </div>
        <Separator className='my-4 lg:my-6' />
        <div className='flex flex-1 flex-col space-y-2 overflow-hidden md:space-y-2 lg:flex-row lg:space-y-0 lg:space-x-12'>
          <aside className='top-0 lg:sticky lg:w-1/5'>
            <AdminSidebarNav items={adminNavItems} pathname={pathname} />
          </aside>
          <div className='flex w-full overflow-y-auto p-1'>
            <Outlet />
          </div>
        </div>
      </Main>
    </>
  )
}
