import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Building2,
  Coins,
  Home,
  Kanban,
  MessageCircle,
  Sparkles,
  Users,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useCreditsStore } from '@/stores/credits-store'
import { MONTHS, useEvaluationsStore } from '@/stores/evaluations-store'
import { useLeadsStore } from '@/stores/leads-store'
import { isBrokerAccount } from '@/lib/auth-api'
import { CREDITS_AND_PLANS_ENABLED } from '@/lib/feature-flags'
import { fetchLeads } from '@/lib/leads-api'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { HeaderActions } from '@/components/layout/header-actions'
import { Main } from '@/components/layout/main'
import { FirstRunBanner } from '@/components/onboarding/first-run-banner'
import { DashboardFoxAiInsights } from '@/features/fox-ai/components/dashboard-fox-ai-insights'
import { GamificationPanel } from '@/features/gamification/components/gamification-panel'
import { useGamificationStats } from '@/features/gamification/hooks/use-gamification-stats'
import { Overview } from './components/overview'
import { RecentLeads } from './components/recent-leads'

function CreditsStatCard({
  credits,
  description,
}: {
  credits: number
  description: string
}) {
  const card = (
    <Card className='h-full'>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>
          Créditos disponíveis
        </CardTitle>
        <Coins className='size-4 text-muted-foreground' />
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{credits}</div>
        <p className='text-xs text-muted-foreground'>{description}</p>
        {!CREDITS_AND_PLANS_ENABLED && (
          <p className='mt-1 text-xs text-muted-foreground/80'>
            Compra em breve
          </p>
        )}
      </CardContent>
    </Card>
  )

  if (!CREDITS_AND_PLANS_ENABLED) {
    return card
  }

  return (
    <Link
      to='/settings/credits'
      className='block transition-opacity hover:opacity-90'
    >
      {card}
    </Link>
  )
}

export function Dashboard() {
  const user = useAuthStore((s) => s.auth.user)
  const isBroker = isBrokerAccount(user)
  const credits = useCreditsStore((s) => s.credits)
  const unlockedLocal = useLeadsStore((s) => s.unlockedIds.length)
  const [leadsTotal, setLeadsTotal] = useState(0)
  const [leadsUnlocked, setLeadsUnlocked] = useState(unlockedLocal)
  const localEvaluationsTotal = useEvaluationsStore((s) => s.total)
  const localMonthlyCounts = useEvaluationsStore((s) => s.monthlyCounts)
  const { stats: gamificationStats, loading: gamificationLoading } =
    useGamificationStats()
  const evaluationsTotal =
    gamificationStats?.evaluationsUsed ?? localEvaluationsTotal
  const currentMonth = new Date().getMonth()
  const monthlyCounts =
    gamificationStats?.monthlyBreakdown ?? localMonthlyCounts
  const evaluationsThisMonth = monthlyCounts[MONTHS[currentMonth]] ?? 0

  useEffect(() => {
    if (!isBroker) return
    void fetchLeads()
      .then((items) => {
        setLeadsTotal(items.length)
        setLeadsUnlocked(items.filter((lead) => lead.unlocked).length)
      })
      .catch(() => {
        // mantém zeros em falha — RecentLeads já trata erro próprio
      })
  }, [isBroker])

  const dashboardContext = {
    credits,
    evaluationsTotal,
    evaluationsThisMonth,
    monthlyCounts,
    leadsTotal: isBroker ? leadsTotal : undefined,
    leadsUnlocked: isBroker ? leadsUnlocked : undefined,
    currentPage: 'dashboard',
  }

  return (
    <>
      <Header>
        <HeaderActions />
      </Header>

      <Main>
        <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Início</h1>
            <p className='text-muted-foreground'>
              {isBroker
                ? 'Hub do funil: avaliar → leads → CRM'
                : 'Acompanhe suas avaliações de imóveis com IA'}
            </p>
          </div>
          <div className='flex gap-2'>
            {isBroker && (
              <Button variant='outline' asChild>
                <Link to='/leads'>
                  <Users className='size-4' />
                  Oportunidades
                </Link>
              </Button>
            )}
            <Button asChild>
              <Link to='/avaliacao'>
                <Sparkles className='size-4' />
                Avaliar imóvel
              </Link>
            </Button>
          </div>
        </div>

        <FirstRunBanner />

        <div className='mb-6'>
          <GamificationPanel
            stats={gamificationStats}
            loading={gamificationLoading}
          />
        </div>

        <div
          className={`grid gap-4 sm:grid-cols-2 ${isBroker ? 'lg:grid-cols-4' : 'lg:grid-cols-2'}`}
        >
          {isBroker ? (
            <>
              <CreditsStatCard
                credits={credits}
                description='Para avaliações IA e leads'
              />
              <Link
                to='/leads'
                className='block transition-opacity hover:opacity-90'
              >
                <Card className='h-full'>
                  <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                    <CardTitle className='text-sm font-medium'>
                      Oportunidades
                    </CardTitle>
                    <MessageCircle className='size-4 text-muted-foreground' />
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold'>{leadsTotal}</div>
                    <p className='text-xs text-muted-foreground'>
                      Leads captados pela Avalia
                    </p>
                  </CardContent>
                </Card>
              </Link>
              <Link
                to='/leads'
                className='block transition-opacity hover:opacity-90'
              >
                <Card className='h-full'>
                  <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                    <CardTitle className='text-sm font-medium'>
                      Desbloqueados
                    </CardTitle>
                    <Users className='size-4 text-muted-foreground' />
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold'>{leadsUnlocked}</div>
                    <p className='text-xs text-muted-foreground'>
                      Prontos para contato
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </>
          ) : (
            <CreditsStatCard
              credits={credits}
              description='Para avaliações com IA'
            />
          )}

          <Link
            to='/avaliacao'
            className='block transition-opacity hover:opacity-90'
          >
            <Card className='h-full'>
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
          </Link>
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
              <Overview
                monthlyCounts={monthlyCounts}
                total={evaluationsTotal}
              />
            </CardContent>
          </Card>
          {isBroker && (
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
          )}
        </div>

        {isBroker && (
          <div className='mt-6 mb-6'>
            <DashboardFoxAiInsights dashboardContext={dashboardContext} />
          </div>
        )}

        <Card className='mt-6'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Home className='size-5' />
              Funil da operação
            </CardTitle>
            <CardDescription>
              Siga a ordem recomendada para maximizar conversões
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`grid gap-4 ${isBroker ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
            >
              <Button
                variant='outline'
                className='h-auto flex-col gap-2 py-6'
                asChild
              >
                <Link to='/avaliacao'>
                  <Sparkles className='size-6' />
                  <span>1. Avaliar imóvel</span>
                </Link>
              </Button>
              {isBroker && (
                <>
                  <Button
                    variant='outline'
                    className='h-auto flex-col gap-2 py-6'
                    asChild
                  >
                    <Link to='/leads'>
                      <Users className='size-6' />
                      <span>2. Desbloquear leads</span>
                    </Link>
                  </Button>
                  <Button
                    variant='outline'
                    className='h-auto flex-col gap-2 py-6'
                    asChild
                  >
                    <Link to='/crm'>
                      <Kanban className='size-6' />
                      <span>3. Gerenciar no CRM</span>
                    </Link>
                  </Button>
                </>
              )}
              {CREDITS_AND_PLANS_ENABLED ? (
                <Button
                  variant='outline'
                  className='h-auto flex-col gap-2 py-6'
                  asChild
                >
                  <Link to='/settings/credits'>
                    <Coins className='size-6' />
                    <span>
                      {isBroker ? 'Créditos e planos' : 'Assinar avaliações'}
                    </span>
                  </Link>
                </Button>
              ) : (
                <Button
                  variant='outline'
                  className='h-auto flex-col gap-2 py-6'
                  disabled
                >
                  <Coins className='size-6' />
                  <span>Créditos e planos (Em breve)</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
