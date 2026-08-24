import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Building2,
  Check,
  Home,
  Kanban,
  Sparkles,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AvaliaBrandMark } from '@/features/auth/components/auth-left-panel'

const PJ_HIGHLIGHTS = [
  'Avaliações com IA e comparáveis de mercado',
  'Radar de captação: IA encontra imóveis de proprietários',
  'Leads de proprietários da sua região',
  'CRM com scoring e pipeline',
  'Mapa de mercado + FoxAi',
]

const PF_HIGHLIGHTS = [
  '3 avaliações grátis por mês',
  'Publique e receba contato de corretores',
  'Plus por R$ 39,90/mês com 10 avaliações',
]

export function LandingPage() {
  return (
    <div className='min-h-svh bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-flux-lime/20 via-background to-flux-lavender/15'>
      <header className='mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6'>
        <AvaliaBrandMark />
        <div className='flex items-center gap-2'>
          <Button variant='ghost' asChild>
            <Link to='/precos'>Preços</Link>
          </Button>
          <Button variant='outline' asChild>
            <Link to='/sign-in'>Entrar</Link>
          </Button>
          <Button asChild className='hidden sm:inline-flex'>
            <Link to='/sign-up'>
              Começar grátis
              <ArrowRight className='size-4' />
            </Link>
          </Button>
        </div>
      </header>

      <main className='mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6'>
        <section className='grid gap-10 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-20'>
          <div className='space-y-6'>
            <p className='text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase'>
              Avalia Imob
            </p>
            <h1 className='max-w-xl text-4xl font-bold tracking-tight text-flux-dark sm:text-5xl'>
              Avalie imóveis com IA e feche mais negócios
            </h1>
            <p className='max-w-lg text-lg text-muted-foreground'>
              Para corretores: avaliações, leads e CRM num só lugar. Para
              proprietários: descubra o valor do imóvel e conecte-se com
              profissionais da região.
            </p>
            <div className='flex flex-wrap gap-3'>
              <Button size='lg' asChild>
                <Link to='/sign-up'>
                  <Building2 className='size-4' />
                  Sou corretor / imobiliária
                </Link>
              </Button>
              <Button size='lg' variant='outline' asChild>
                <Link to='/sign-up'>
                  <Home className='size-4' />
                  Sou proprietário
                </Link>
              </Button>
            </div>
            <p className='text-sm text-muted-foreground'>
              Planos a partir de{' '}
              <strong className='text-foreground'>R$ 97/mês</strong> para
              corretores · Free para proprietários
            </p>
          </div>

          <div className='rounded-[2rem] border border-black/[0.06] bg-card/90 p-6 shadow-sm backdrop-blur'>
            <div className='mb-4 flex items-center gap-2 text-sm font-semibold'>
              <Sparkles className='size-4 text-flux-lavender' />
              Funil que gera receita
            </div>
            <ol className='space-y-4 text-sm'>
              <li className='flex gap-3 rounded-2xl bg-flux-lime/15 p-4'>
                <Users className='mt-0.5 size-5 shrink-0 text-flux-dark' />
                <div>
                  <p className='font-medium'>Proprietário avalia e publica</p>
                  <p className='text-muted-foreground'>
                    Oferta de leads qualificados na sua região
                  </p>
                </div>
              </li>
              <li className='flex gap-3 rounded-2xl bg-flux-lavender/15 p-4'>
                <Sparkles className='mt-0.5 size-5 shrink-0 text-flux-dark' />
                <div>
                  <p className='font-medium'>
                    Corretor desbloqueia com créditos
                  </p>
                  <p className='text-muted-foreground'>
                    2 créditos por lead · 1 crédito por avaliação IA
                  </p>
                </div>
              </li>
              <li className='flex gap-3 rounded-2xl bg-muted/60 p-4'>
                <Kanban className='mt-0.5 size-5 shrink-0 text-flux-dark' />
                <div>
                  <p className='font-medium'>Fecha no CRM</p>
                  <p className='text-muted-foreground'>
                    Pipeline, scoring IA e histórico
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section className='grid gap-6 md:grid-cols-2'>
          <div className='rounded-[1.75rem] border bg-card p-6'>
            <h2 className='text-xl font-bold'>Para corretores (PJ)</h2>
            <ul className='mt-4 space-y-2 text-sm'>
              {PJ_HIGHLIGHTS.map((item) => (
                <li key={item} className='flex gap-2'>
                  <Check className='mt-0.5 size-4 shrink-0 text-emerald-600' />
                  {item}
                </li>
              ))}
            </ul>
            <Button className='mt-6' asChild>
              <Link to='/precos'>Ver planos PJ</Link>
            </Button>
          </div>
          <div className='rounded-[1.75rem] border bg-card p-6'>
            <h2 className='text-xl font-bold'>Para proprietários (PF)</h2>
            <ul className='mt-4 space-y-2 text-sm'>
              {PF_HIGHLIGHTS.map((item) => (
                <li key={item} className='flex gap-2'>
                  <Check className='mt-0.5 size-4 shrink-0 text-emerald-600' />
                  {item}
                </li>
              ))}
            </ul>
            <Button className='mt-6' variant='outline' asChild>
              <Link to='/sign-up'>Avaliar meu imóvel</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className='border-t py-8 text-center text-sm text-muted-foreground'>
        © {new Date().getFullYear()} Avalia Imob ·{' '}
        <Link to='/blog' className='underline-offset-4 hover:underline'>
          Blog
        </Link>{' '}
        ·{' '}
        <Link to='/precos' className='underline-offset-4 hover:underline'>
          Preços
        </Link>
      </footer>
    </div>
  )
}
