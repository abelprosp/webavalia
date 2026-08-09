import {
  Building2,
  Coins,
  LayoutDashboard,
  UserCog,
  Palette,
  Home,
  Users,
  Shield,
  CreditCard,
  Settings2,
  Newspaper,
  Sparkles,
  MessageSquare,
  Map,
  Kanban,
  FileText,
} from 'lucide-react'
import { isAdmin, isBrokerAccount, type AuthUser } from '@/lib/auth-api'
import { CREDITS_AND_PLANS_ENABLED } from '@/lib/feature-flags'
import { type NavGroup, type NavItem, type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: '',
    email: '',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Avalia Imob',
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
      title: 'Início',
      url: '/',
      icon: LayoutDashboard,
    },
    {
      title: 'Avaliar imóvel',
      url: '/avaliacao',
      icon: Home,
    },
  ]

  if (broker) {
    platformItems.push(
      {
        title: 'Oportunidades (Leads)',
        url: '/leads',
        icon: Users,
      },
      {
        title: 'Pipeline (CRM)',
        url: '/crm',
        icon: Kanban,
      },
      {
        title: 'Mapa de mercado',
        url: '/mapa-de-mercado',
        icon: Map,
      },
      {
        title: 'Assistente IA',
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
      }
    )
  } else {
    platformItems.push({
      title: 'Minhas avaliações',
      url: '/minhas-avaliacoes',
      icon: FileText,
    })
  }

  const groups: NavGroup[] = [
    {
      title: 'Plataforma',
      items: platformItems,
    },
    {
      title: 'Conta',
      items: [
        {
          title: 'Créditos e planos',
          url: '/settings/credits',
          icon: Coins,
          ...(!CREDITS_AND_PLANS_ENABLED ? { badge: 'Em breve' } : {}),
        },
        {
          title: 'Perfil',
          url: '/settings',
          icon: UserCog,
        },
        {
          title: 'Aparência',
          url: '/settings/appearance',
          icon: Palette,
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
          title: 'Avaliações',
          url: '/admin/evaluations',
          icon: Sparkles,
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
