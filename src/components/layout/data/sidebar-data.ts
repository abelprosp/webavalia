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
  Shield,
  CreditCard,
  Settings2,
  Newspaper,
  Sparkles,
  MessageSquare,
  Map,
} from 'lucide-react'
import { isAdmin, isBrokerAccount, type AuthUser } from '@/lib/auth-api'
import { type NavGroup, type NavItem, type SidebarData } from '../types'

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
  navGroups: [],
}

export function getSidebarNavGroups(user: AuthUser | null): NavGroup[] {
  const broker = isBrokerAccount(user)

  const platformItems: NavItem[] = [
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
      title: 'FoxAi',
      icon: Sparkles,
      badge: 'IA',
      items: [
        {
          title: 'Central FoxAi',
          url: '/fox-ai',
          icon: LayoutDashboard,
        },
        {
          title: 'Chat FoxAi',
          url: '/fox-ai/chat',
          icon: MessageSquare,
        },
      ],
    },
  ]

  if (broker) {
    platformItems.push(
      {
        title: 'Mapa de Mercado',
        url: '/mapa-de-mercado',
        icon: Map,
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
      }
    )
  } else {
    platformItems.push({
      title: 'Minhas avaliações',
      url: '/minhas-avaliacoes',
      icon: Contact,
    })
  }

  const groups = [
    {
      title: 'Plataforma',
      items: platformItems,
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
  ]

  if (isAdmin(user)) {
    groups.unshift({
      title: 'Administração',
      items: [
        {
          title: 'Painel Admin',
          url: '/admin',
          icon: Shield,
        },
        {
          title: 'Usuários',
          url: '/admin/users',
          icon: Users,
        },
        {
          title: 'Planos',
          url: '/admin/plans',
          icon: CreditCard,
        },
        {
          title: 'Blog',
          url: '/admin/blog',
          icon: Newspaper,
        },
        {
          title: 'Config. plataforma',
          url: '/admin/settings',
          icon: Settings2,
        },
      ],
    })
  }

  return groups
}
