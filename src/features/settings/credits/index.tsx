import { Coins, CreditCard, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ContentSection } from '../components/content-section'
import { useAuthStore } from '@/stores/auth-store'
import { useCreditsStore } from '@/stores/credits-store'

const creditPackages = [
  { credits: 10, price: 'R$ 49,90', popular: false },
  { credits: 25, price: 'R$ 99,90', popular: true },
  { credits: 50, price: 'R$ 179,90', popular: false },
  { credits: 100, price: 'R$ 299,90', popular: false },
]

export function CreditsSettings() {
  const credits = useCreditsStore((s) => s.credits)
  const addCredits = useCreditsStore((s) => s.addCredits)
  const trialRemaining = useAuthStore(
    (s) => s.auth.user?.trialEvaluationsRemaining
  )
  const trialTotal = useAuthStore((s) => s.auth.user?.trialEvaluationsTotal ?? 3)

  function handlePurchase(amount: number) {
    addCredits(amount)
    toast.success(`${amount} créditos adicionados à sua conta!`)
  }

  return (
    <ContentSection
      title='Créditos'
      desc='Gerencie seus créditos para desbloquear leads captados pelo WhatsApp da Avalia.'
    >
      <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Sparkles className='size-5' />
            Avaliações com IA
          </CardTitle>
          <CardDescription>
            Cada conta recebe {trialTotal} avaliações grátis de teste ao se
            cadastrar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='text-4xl font-bold text-primary'>
            {trialRemaining ?? '—'}
          </div>
          <p className='mt-1 text-sm text-muted-foreground'>
            avaliações grátis restantes de {trialTotal}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Coins className='size-5' />
            Saldo de créditos (leads)
          </CardTitle>
          <CardDescription>
            Cada lead captado pelo WhatsApp custa 1 crédito para desbloquear
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='text-4xl font-bold text-primary'>{credits}</div>
          <p className='mt-1 text-sm text-muted-foreground'>
            créditos disponíveis
          </p>
        </CardContent>
      </Card>

      <div className='mt-6 grid gap-4 sm:grid-cols-2'>
        {creditPackages.map((pkg) => (
          <Card
            key={pkg.credits}
            className={pkg.popular ? 'border-primary' : undefined}
          >
            <CardHeader>
              <div className='flex items-center justify-between'>
                <CardTitle className='text-lg'>
                  {pkg.credits} créditos
                </CardTitle>
                {pkg.popular && (
                  <span className='rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground'>
                    Popular
                  </span>
                )}
              </div>
              <CardDescription>{pkg.price}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className='w-full'
                variant={pkg.popular ? 'default' : 'outline'}
                onClick={() => handlePurchase(pkg.credits)}
              >
                <CreditCard className='size-4' />
                Comprar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className='mt-6'>
        <CardHeader>
          <CardTitle>Como funcionam os créditos?</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3 text-sm text-muted-foreground'>
          <p>
            O WhatsApp da Avalia captura leads de pessoas interessadas em
            imóveis e os disponibiliza na plataforma de forma anonimizada.
          </p>
          <p>
            Para visualizar nome, telefone e e-mail de um lead, o corretor
            utiliza 1 crédito para desbloqueá-lo.
          </p>
          <p>
            As avaliações com IA consomem as avaliações grátis de teste da sua
            conta. Após utilizá-las, entre em contato para ampliar seu plano.
          </p>
        </CardContent>
      </Card>
      </div>
    </ContentSection>
  )
}
