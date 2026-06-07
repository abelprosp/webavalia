import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Settings2,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

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
    title: 'Planos',
    href: '/admin/plans',
    icon: CreditCard,
  },
  {
    title: 'Configurações',
    href: '/admin/settings',
    icon: Settings2,
  },
]

export function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <Badge variant='outline' className='gap-1.5'>
          <Shield className='size-3.5' />
          Admin
        </Badge>
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main fixed>
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
            <nav className='flex space-x-2 lg:flex-col lg:space-y-1 lg:space-x-0'>
              {adminNavItems.map((item) => {
                const isActive =
                  item.href === '/admin'
                    ? pathname === '/admin'
                    : pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    <Icon className='size-4 shrink-0' />
                    {item.title}
                  </Link>
                )
              })}
            </nav>
          </aside>
          <div className='flex w-full overflow-y-auto p-1'>
            <Outlet />
          </div>
        </div>
      </Main>
    </>
  )
}
