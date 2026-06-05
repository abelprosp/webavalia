import {
  Building2,
  Coins,
  LayoutDashboard,
  Settings,
  UserCog,
  Wrench,
  Palette,
  Bell,
  Monitor,
  Home,
  Users,
  Contact,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: '',
    email: '',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Avalia Imobe',
      logo: Building2,
      plan: 'imobiliárias',
    },
  ],
  navGroups: [
    {
      title: 'Plataforma',
      items: [
        {
          title: 'Dashboard',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'Avaliação de Imóveis',
          url: '/avaliacao',
          icon: Home,
        },
        {
          title: 'Leads',
          url: '/leads',
          icon: Users,
          badge: 'Em breve',
        },
        {
          title: 'CRM',
          url: '/crm',
          icon: Contact,
        },
      ],
    },
    {
      title: 'Configurações',
      items: [
        {
          title: 'Settings',
          icon: Settings,
          items: [
            {
              title: 'Perfil',
              url: '/settings',
              icon: UserCog,
            },
            {
              title: 'Conta',
              url: '/settings/account',
              icon: Wrench,
            },
            {
              title: 'Créditos',
              url: '/settings/credits',
              icon: Coins,
            },
            {
              title: 'Aparência',
              url: '/settings/appearance',
              icon: Palette,
            },
            {
              title: 'Notificações',
              url: '/settings/notifications',
              icon: Bell,
            },
            {
              title: 'Exibição',
              url: '/settings/display',
              icon: Monitor,
            },
          ],
        },
      ],
    },
  ],
}
