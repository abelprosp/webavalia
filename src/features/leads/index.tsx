import { ComingSoon } from '@/components/coming-soon'
import { HeaderActions } from '@/components/layout/header-actions'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'

export function Leads() {
  return (
    <>
      <Header fixed>
        <HeaderActions />
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
