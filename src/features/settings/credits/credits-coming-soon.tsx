import { Coins } from 'lucide-react'
import { useCreditsStore } from '@/stores/credits-store'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ComingSoon } from '@/components/coming-soon'
import { ContentSection } from '../components/content-section'

export function CreditsComingSoon() {
  const credits = useCreditsStore((s) => s.credits)

  return (
    <ContentSection
      title='Créditos e planos'
      desc='Compra de créditos e assinaturas estarão disponíveis em breve.'
    >
      <div className='space-y-6'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Coins className='size-5' />
              Seu saldo atual
            </CardTitle>
            <CardDescription>
              Você continua usando os créditos já disponíveis na conta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='text-4xl font-bold text-primary'>{credits}</div>
            <p className='mt-1 text-sm text-muted-foreground'>
              créditos disponíveis
            </p>
          </CardContent>
        </Card>

        <ComingSoon
          variant='card'
          title='Em breve'
          description='A área de planos e compra de créditos está em desenvolvimento. Em breve você poderá assinar planos e adquirir créditos avulsos por aqui.'
          showBackLink={false}
        />
      </div>
    </ContentSection>
  )
}
