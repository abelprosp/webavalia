import { ContentSection } from '../components/content-section'
import { ComingSoon } from '@/components/coming-soon'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function SettingsAppearance() {
  return (
    <ContentSection
      title='Aparência'
      desc='Tema e densidade visual da Avalia Imob.'
    >
      <div className='space-y-6'>
        <Card>
          <CardHeader>
            <CardTitle>Tema</CardTitle>
            <CardDescription>
              A interface está fixada no modo claro para manter consistência visual.
            </CardDescription>
          </CardHeader>
          <CardContent className='text-sm'>
            <p>
              <span className='text-muted-foreground'>Tema atual:</span>{' '}
              <strong>Claro</strong>
            </p>
          </CardContent>
        </Card>
        <ComingSoon
          variant='card'
          title='Em breve'
          description='Opções avançadas de aparência (densidade, contraste) chegarão em breve.'
          showBackLink={false}
        />
      </div>
    </ContentSection>
  )
}
