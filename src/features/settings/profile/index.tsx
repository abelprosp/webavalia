import { useAuthStore } from '@/stores/auth-store'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ContentSection } from '../components/content-section'
import { PasswordForm } from './password-form'
import { ProfileForm } from './profile-form'

export function SettingsProfile() {
  const user = useAuthStore((s) => s.auth.user)
  const accountLabel =
    user?.accountType === 'pj'
      ? 'Corretor / Imobiliária (PJ)'
      : 'Pessoa física (PF)'

  return (
    <ContentSection title='Perfil' desc='Dados da sua conta na Avalia Imob.'>
      <div className='space-y-6'>
        <Card>
          <CardHeader>
            <CardTitle>Dados da conta</CardTitle>
            <CardDescription>
              Atualize nome, documento e e-mail. Tipo de conta:{' '}
              <strong>{accountLabel}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alterar senha</CardTitle>
            <CardDescription>
              Informe a senha atual e escolha uma nova senha segura.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </div>
    </ContentSection>
  )
}
