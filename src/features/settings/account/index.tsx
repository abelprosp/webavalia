import { useAuthStore } from '@/stores/auth-store'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ComingSoon } from '@/components/coming-soon'
import { ContentSection } from '../components/content-section'

export function SettingsAccount() {
  const user = useAuthStore((s) => s.auth.user)

  return (
    <ContentSection
      title='Conta'
      desc='Preferências da sua conta na Avalia Imob.'
    >
      <div className='space-y-6'>
        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
            <CardDescription>
              Idioma, fuso e preferências avançadas estarão disponíveis em
              breve.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-2 text-sm'>
            <p>
              <span className='text-muted-foreground'>E-mail:</span>{' '}
              <strong>{user?.email ?? '—'}</strong>
            </p>
            <p>
              <span className='text-muted-foreground'>Idioma:</span>{' '}
              <strong>Português (Brasil)</strong>
            </p>
          </CardContent>
        </Card>
        <ComingSoon
          variant='card'
          title='Em breve'
          description='Em breve você poderá ajustar idioma, fuso horário e outras preferências de conta.'
          showBackLink={false}
        />
      </div>
    </ContentSection>
  )
}
