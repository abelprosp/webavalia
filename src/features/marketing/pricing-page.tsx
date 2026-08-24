import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AvaliaBrandMark } from '@/features/auth/components/auth-left-panel'

const PJ_PLANS = [
  {
    slug: 'starter',
    name: 'Starter',
    price: 'R$ 97',
    credits: '12 créditos/mês',
    description: 'Ideal para corretor solo começar a captar.',
    features: [
      'Avaliações IA',
      'Radar de captação IA (1 crédito/varredura)',
      'Desbloqueio de leads (2 créditos)',
      'CRM básico',
    ],
  },
  {
    slug: 'pro',
    name: 'Pro',
    price: 'R$ 197',
    credits: '30 créditos/mês',
    description: 'Melhor custo por crédito — mapa, FoxAi e scoring.',
    highlighted: true,
    features: [
      'Tudo do Starter',
      'Radar de captação IA em volume',
      'Mapa de mercado',
      'FoxAi',
      'Lead Scoring IA',
    ],
  },
  {
    slug: 'agency',
    name: 'Imobiliária',
    price: 'R$ 497',
    credits: '80 créditos/mês',
    description: 'Alto volume para equipes e imobiliárias.',
    features: ['Tudo do Pro', 'Ideal para times', 'Suporte prioritário'],
  },
]

export function PricingPage() {
  return (
    <div className='min-h-svh bg-background'>
      <header className='mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6'>
        <Link to='/'>
          <AvaliaBrandMark />
        </Link>
        <div className='flex gap-2'>
          <Button variant='outline' asChild>
            <Link to='/sign-in'>Entrar</Link>
          </Button>
          <Button asChild>
            <Link to='/sign-up'>Começar</Link>
          </Button>
        </div>
      </header>

      <main className='mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6'>
        <div className='mx-auto max-w-2xl py-10 text-center'>
          <h1 className='text-3xl font-bold tracking-tight sm:text-4xl'>
            Preços claros para crescer com lucro
          </h1>
          <p className='mt-3 text-muted-foreground'>
            1 crédito = 1 avaliação IA · 2 créditos = 1 lead desbloqueado.
            Pacotes PIX a partir de R$ 11,90/crédito.
          </p>
        </div>

        <section className='grid gap-4 lg:grid-cols-3'>
          {PJ_PLANS.map((plan) => (
            <div
              key={plan.slug}
              className={`rounded-[1.75rem] border p-6 ${
                plan.highlighted
                  ? 'border-flux-lime bg-flux-lime/10 shadow-sm'
                  : 'bg-card'
              }`}
            >
              {plan.highlighted ? (
                <p className='mb-2 text-xs font-semibold tracking-wide text-flux-dark uppercase'>
                  Mais popular
                </p>
              ) : null}
              <h2 className='text-xl font-bold'>{plan.name}</h2>
              <p className='mt-1 text-sm text-muted-foreground'>
                {plan.description}
              </p>
              <p className='mt-4 text-3xl font-bold'>
                {plan.price}
                <span className='text-base font-normal text-muted-foreground'>
                  /mês
                </span>
              </p>
              <p className='mt-1 text-sm font-medium'>{plan.credits}</p>
              <ul className='mt-4 space-y-2 text-sm'>
                {plan.features.map((feature) => (
                  <li key={feature} className='flex gap-2'>
                    <Check className='mt-0.5 size-4 shrink-0 text-emerald-600' />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button className='mt-6 w-full' asChild>
                <Link to='/sign-up'>Assinar {plan.name}</Link>
              </Button>
            </div>
          ))}
        </section>

        <section className='mt-10 grid gap-4 md:grid-cols-2'>
          <div className='rounded-[1.75rem] border bg-card p-6'>
            <h2 className='text-xl font-bold'>Proprietário (PF)</h2>
            <p className='mt-2 text-sm text-muted-foreground'>
              Free: 3 avaliações/mês e 1 publicação/mês. Plus:{' '}
              <strong className='text-foreground'>R$ 39,90/mês</strong> com 10
              avaliações IA (créditos exclusivos para avaliações) e publicação
              ilimitada.
            </p>
            <Button className='mt-4' variant='outline' asChild>
              <Link to='/sign-up'>Criar conta PF</Link>
            </Button>
          </div>
          <div className='rounded-[1.75rem] border bg-card p-6'>
            <h2 className='text-xl font-bold'>Créditos avulsos (PIX)</h2>
            <p className='mt-2 text-sm text-muted-foreground'>
              Packs de 5, 10 ou 20 créditos a{' '}
              <strong className='text-foreground'>R$ 11,90</strong> cada. Pack
              de 20 com 10% de desconto.
            </p>
            <Button className='mt-4' variant='outline' asChild>
              <Link to='/sign-in'>Entrar e comprar</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  )
}
