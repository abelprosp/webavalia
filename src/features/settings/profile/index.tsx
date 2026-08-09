import { ContentSection } from '../components/content-section'
import { useAuthStore } from '@/stores/auth-store'
import { ComingSoon } from '@/components/coming-soon'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function SettingsProfile() {
  const user = useAuthStore((s) => s.auth.user)

  return (
    <ContentSection
      title='Perfil'
      desc='Dados da sua conta na Avalia Imob.'
    >
      <div className='space-y-6'>
        <Card>
          <CardHeader>
            <CardTitle>Conta atual</CardTitle>
            <CardDescription>
              Edição completa do perfil estará disponível em breve.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-2 text-sm'>
            <p>
              <span className='text-muted-foreground'>Nome:</span>{' '}
              <strong>{user?.name ?? '—'}</strong>
            </p>
            <p>
              <span className='text-muted-foreground'>E-mail:</span>{' '}
              <strong>{user?.email ?? '—'}</strong>
            </p>
            <p>
              <span className='text-muted-foreground'>Tipo:</span>{' '}
              <strong>
                {user?.accountType === 'pj' ? 'Corretor / Imobiliária (PJ)' : 'Pessoa física (PF)'}
              </strong>
            </p>
          </CardContent>
        </Card>
        <ComingSoon
          variant='card'
          title='Em breve'
          description='Em breve você poderá atualizar nome, documento e dados da imobiliária por aqui.'
          showBackLink={false}
        />
      </div>
    </ContentSection>
  )
}
