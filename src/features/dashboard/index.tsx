import { Link } from '@tanstack/react-router'
import {
  Building2,
  Coins,
  Home,
  MessageCircle,
  Sparkles,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { HeaderActions } from '@/components/layout/header-actions'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { useCreditsStore } from '@/stores/credits-store'
import { MONTHS, useEvaluationsStore } from '@/stores/evaluations-store'
import { useLeadsStore } from '@/stores/leads-store'
import { leads } from '@/features/leads/data/leads'
import { Overview } from './components/overview'
import { RecentLeads } from './components/recent-leads'
import { GamificationPanel } from '@/features/gamification/components/gamification-panel'
import { useGamificationStats } from '@/features/gamification/hooks/use-gamification-stats'

export function Dashboard() {
  const credits = useCreditsStore((s) => s.credits)
  const unlockedCount = useLeadsStore((s) => s.unlockedIds.length)
  const localEvaluationsTotal = useEvaluationsStore((s) => s.total)
  const localMonthlyCounts = useEvaluationsStore((s) => s.monthlyCounts)
  const { stats: gamificationStats, loading: gamificationLoading } =
    useGamificationStats()
  const evaluationsTotal =
    gamificationStats?.evaluationsUsed ?? localEvaluationsTotal
  const currentMonth = new Date().getMonth()
  const monthlyCounts = gamificationStats?.monthlyBreakdown ?? localMonthlyCounts
  const evaluationsThisMonth = monthlyCounts[MONTHS[currentMonth]] ?? 0

  return (
    <>
      <Header>
        <HeaderActions />
      </Header>

      <Main>
        <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1>
            <p className='text-muted-foreground'>
              Visão geral da sua operação na Avalia Imob
            </p>
          </div>
          <div className='flex gap-2'>
            <Button variant='outline' asChild>
              <Link to='/leads'>
                <Users className='size-4' />
                Ver leads
              </Link>
            </Button>
            <Button asChild>
              <Link to='/avaliacao'>
                <Sparkles className='size-4' />
                Nova avaliação
              </Link>
            </Button>
          </div>
        </div>

        <div className='mb-6'>
          <GamificationPanel stats={gamificationStats} loading={gamificationLoading} />
        </div>

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Créditos disponíveis
              </CardTitle>
              <Coins className='size-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{credits}</div>
              <p className='text-xs text-muted-foreground'>
                Para desbloquear leads
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Leads captados
              </CardTitle>
              <MessageCircle className='size-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{leads.length}</div>
              <p className='text-xs text-muted-foreground'>
                Via WhatsApp Avalia
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Leads desbloqueados
              </CardTitle>
              <Users className='size-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{unlockedCount}</div>
              <p className='text-xs text-muted-foreground'>
                Prontos para contato
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Avaliações realizadas
              </CardTitle>
              <Building2 className='size-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{evaluationsTotal}</div>
              <p className='text-xs text-muted-foreground'>
                {evaluationsThisMonth > 0
                  ? `+${evaluationsThisMonth} este mês`
                  : 'Nenhuma este mês'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className='mt-6 grid grid-cols-1 gap-4 lg:grid-cols-7'>
          <Card className='col-span-1 lg:col-span-4'>
            <CardHeader>
              <CardTitle>Avaliações por mês</CardTitle>
              <CardDescription>
                Volume de avaliações de imóveis realizadas
              </CardDescription>
            </CardHeader>
            <CardContent className='ps-2'>
              <Overview monthlyCounts={monthlyCounts} total={evaluationsTotal} />
            </CardContent>
          </Card>
          <Card className='col-span-1 lg:col-span-3'>
            <CardHeader>
              <CardTitle>Leads recentes</CardTitle>
              <CardDescription>
                Últimos leads captados pelo WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecentLeads />
            </CardContent>
          </Card>
        </div>

        <Card className='mt-6'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Home className='size-5' />
              Ações rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 sm:grid-cols-3'>
              <Button variant='outline' className='h-auto flex-col gap-2 py-6' asChild>
                <Link to='/avaliacao'>
                  <Sparkles className='size-6' />
                  <span>Avaliar imóvel com IA</span>
                </Link>
              </Button>
              <Button variant='outline' className='h-auto flex-col gap-2 py-6' asChild>
                <Link to='/leads'>
                  <Users className='size-6' />
                  <span>Desbloquear leads</span>
                </Link>
              </Button>
              <Button variant='outline' className='h-auto flex-col gap-2 py-6' asChild>
                <Link to='/settings/credits'>
                  <Coins className='size-6' />
                  <span>Comprar créditos</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
