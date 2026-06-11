import { Link } from '@tanstack/react-router'
import { Sparkles } from 'lucide-react'
import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { useAuthStore } from '@/stores/auth-store'
import { AppTitle } from './app-title'
import { getSidebarNavGroups } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const authUser = useAuthStore((s) => s.auth.user)

  const navUser = {
    name: authUser?.name ?? 'Corretor',
    email: authUser?.email ?? '',
    avatar: '/avatars/shadcn.jpg',
  }

  const navGroups = getSidebarNavGroups(authUser)

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <AppTitle />
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className='mx-2 mb-2 overflow-hidden rounded-2xl bg-flux-lime p-4 group-data-[collapsible=icon]:hidden'>
          <div className='flex items-start justify-between gap-2'>
            <div>
              <p className='text-sm font-bold text-flux-dark'>Plano Pro</p>
              <p className='mt-0.5 text-xs text-flux-dark/70'>
                Avaliações ilimitadas e leads premium
              </p>
            </div>
            <Sparkles className='size-5 shrink-0 text-flux-dark/60' />
          </div>
          <Link
            to='/settings/credits'
            className='mt-3 flex w-full items-center justify-center rounded-full bg-flux-dark px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90'
          >
            Ver planos
          </Link>
        </div>
        <NavUser user={navUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
