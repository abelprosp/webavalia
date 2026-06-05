import { ComingSoon } from '@/components/coming-soon'
import { CreditsBadge } from '@/components/credits-badge'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

export function Leads() {
  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <CreditsBadge />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>Leads</h2>
          <p className='text-muted-foreground'>
            Captação de leads pelo WhatsApp da Avalia.
          </p>
        </div>

        <ComingSoon
          variant='card'
          title='Em breve'
          description='A área de leads estará disponível em breve. Aqui você poderá ver contatos captados pelo WhatsApp da Avalia e desbloqueá-los com créditos.'
          showBackLink={false}
        />
      </Main>
    </>
  )
}
