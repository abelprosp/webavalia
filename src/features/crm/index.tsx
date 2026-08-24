import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Bookmark,
  Eye,
  Inbox,
  Kanban,
  MapPin,
  Plus,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { useCrmStore } from '@/stores/crm-store'
import { fetchMyEvaluations } from '@/lib/evaluation-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/flux/empty-state'
import { FluxCard } from '@/components/flux/flux-card'
import { PageHeader } from '@/components/flux/page-header'
import { Header } from '@/components/layout/header'
import { HeaderActions } from '@/components/layout/header-actions'
import { Main } from '@/components/layout/main'
import { propertyTypes } from '@/features/avaliacao/data/criteria'
import {
  DEFAULT_EVALUATION_FORM_VALUES,
  formatCurrency,
  normalizeEvaluationResult,
  type EvaluationFormValues,
  type EvaluationResult,
} from '@/features/avaliacao/data/evaluation-engine'
import { CrmEvaluationDetail } from './components/crm-evaluation-detail'
import { PipelineBoard } from './components/pipeline-board'
import {
  crmStatuses,
  getCrmStatusLabel,
  type CrmEvaluation,
} from './data/schema'

function getPropertyTypeLabel(value: string) {
  return propertyTypes.find((t) => t.value === value)?.label ?? value
}

function mapServerEvaluationToCrm(item: {
  id: string
  propertyInput: Record<string, unknown>
  evaluationResult: Record<string, unknown>
  createdAt: string
}): CrmEvaluation {
  const property = {
    ...DEFAULT_EVALUATION_FORM_VALUES,
    ...(item.propertyInput as Partial<EvaluationFormValues>),
  } as EvaluationFormValues

  const rawResult = item.evaluationResult as Partial<EvaluationResult> & {
    estimatedValue?: number
    evaluatedAt?: string | Date
  }

  const result = normalizeEvaluationResult({
    ...rawResult,
    estimatedValue: Number(rawResult.estimatedValue ?? 0),
    evaluatedAt: new Date(
      (rawResult.evaluatedAt as string | Date | undefined) ?? item.createdAt
    ),
  })

  return {
    id: item.id,
    status: 'novo',
    property,
    result: {
      ...result,
      evaluatedAt: result.evaluatedAt.toISOString(),
    },
    savedAt: item.createdAt,
  }
}

function statusVariant(
  status: CrmEvaluation['status']
): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'fechado':
      return 'default'
    case 'em_negociacao':
    case 'proposta':
      return 'secondary'
    case 'arquivado':
      return 'outline'
    default:
      return 'secondary'
  }
}

export function Crm({ personalMode = false }: { personalMode?: boolean }) {
  const localEvaluations = useCrmStore((s) => s.evaluations)
  const [serverEvaluations, setServerEvaluations] = useState<CrmEvaluation[]>(
    []
  )
  const [loadingServer, setLoadingServer] = useState(personalMode)
  const [selected, setSelected] = useState<CrmEvaluation | null>(null)
  const [activeTab, setActiveTab] = useState<'pipeline' | 'evaluations'>(
    'pipeline'
  )

  useEffect(() => {
    if (!personalMode) return
    let cancelled = false

    async function load() {
      setLoadingServer(true)
      try {
        const items = await fetchMyEvaluations()
        if (cancelled) return
        setServerEvaluations(items.map(mapServerEvaluationToCrm))
      } catch {
        if (!cancelled) {
          toast.error('Não foi possível carregar suas avaliações do servidor.')
        }
      } finally {
        if (!cancelled) setLoadingServer(false)
      }
    }

    void load()

    const onUpdated = () => {
      void load()
    }
    window.addEventListener('evaluations:updated', onUpdated)
    return () => {
      cancelled = true
      window.removeEventListener('evaluations:updated', onUpdated)
    }
  }, [personalMode])

  const evaluations = personalMode
    ? (() => {
        const byId = new Map<string, CrmEvaluation>()
        for (const item of localEvaluations) byId.set(item.id, item)
        for (const item of serverEvaluations) byId.set(item.id, item)
        return Array.from(byId.values()).sort(
          (a, b) =>
            new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        )
      })()
    : localEvaluations

  const stats = useMemo(() => {
    const byStatus = Object.fromEntries(
      crmStatuses.map((s) => [s.value, 0])
    ) as Record<CrmEvaluation['status'], number>

    for (const e of evaluations) {
      byStatus[e.status] = (byStatus[e.status] ?? 0) + 1
    }

    return {
      total: evaluations.length,
      novo: byStatus.novo,
      emNegociacao: byStatus.em_negociacao + byStatus.proposta,
      fechado: byStatus.fechado,
    }
  }, [evaluations])

  if (personalMode && loadingServer && evaluations.length === 0) {
    return (
      <>
        <Header fixed>
          <HeaderActions />
        </Header>
        <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
          <PageSkeleton rows={6} />
        </Main>
      </>
    )
  }

  const evaluationsSection = (
    <FluxCard>
      <div className='mb-4 space-y-1'>
        <h2 className='flex items-center gap-2 text-base font-semibold'>
          <Bookmark className='size-5' />
          {personalMode ? 'Avaliações salvas' : 'Histórico de avaliações'}
        </h2>
        <p className='text-sm text-muted-foreground'>
          {personalMode
            ? 'Clique em uma avaliação para ver detalhes ou exportar PDF.'
            : 'Clique em uma avaliação para ver detalhes, editar status ou exportar PDF.'}
        </p>
      </div>
      {evaluations.length === 0 ? (
        <EmptyState
          className='border-0 py-12'
          icon={<Inbox className='size-10' />}
          title='Nenhuma avaliação salva'
          description={
            personalMode
              ? 'Suas avaliações aparecem aqui automaticamente após concluir uma análise com IA.'
              : 'Após avaliar um imóvel, use "Salvar no CRM" para guardar o resultado no pipeline e no histórico.'
          }
          actions={
            <Button variant='outline' asChild>
              <Link to='/avaliacao'>
                <Sparkles className='size-4' />
                Ir para avaliação
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className='space-y-3 md:hidden'>
            {evaluations.map((evaluation) => (
              <button
                key={evaluation.id}
                type='button'
                onClick={() => setSelected(evaluation)}
                className='w-full rounded-2xl border border-black/[0.06] bg-background p-4 text-left transition hover:border-flux-lime/40'
              >
                <div className='flex items-start justify-between gap-3'>
                  <div className='min-w-0 space-y-1'>
                    <p className='flex items-center gap-1 truncate font-medium'>
                      <MapPin className='size-3 shrink-0 text-muted-foreground' />
                      {evaluation.property.address}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {getPropertyTypeLabel(evaluation.property.propertyType)} ·{' '}
                      {evaluation.property.area} m²
                    </p>
                    {!personalMode && evaluation.clientName ? (
                      <p className='text-xs text-muted-foreground'>
                        Cliente: {evaluation.clientName}
                      </p>
                    ) : null}
                  </div>
                  {!personalMode ? (
                    <Badge variant={statusVariant(evaluation.status)}>
                      {getCrmStatusLabel(evaluation.status)}
                    </Badge>
                  ) : null}
                </div>
                <div className='mt-3 flex items-center justify-between text-sm'>
                  <span className='font-medium text-primary'>
                    {formatCurrency(evaluation.result.estimatedValue)}
                  </span>
                  <span className='text-muted-foreground'>
                    Score {evaluation.result.score}/100
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className='hidden md:block'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imóvel</TableHead>
                  {!personalMode && <TableHead>Cliente</TableHead>}
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor estimado</TableHead>
                  <TableHead>Score</TableHead>
                  {!personalMode && <TableHead>Status</TableHead>}
                  <TableHead>Salva em</TableHead>
                  <TableHead className='text-end'>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluations.map((evaluation) => (
                  <TableRow key={evaluation.id}>
                    <TableCell>
                      <div className='flex flex-col'>
                        <span className='flex items-center gap-1 font-medium'>
                          <MapPin className='size-3 text-muted-foreground' />
                          {evaluation.property.address}
                        </span>
                        <span className='text-xs text-muted-foreground'>
                          {evaluation.property.area} m²
                        </span>
                      </div>
                    </TableCell>
                    {!personalMode && (
                      <TableCell>
                        {evaluation.clientName ?? (
                          <span className='text-muted-foreground'>—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      {getPropertyTypeLabel(evaluation.property.propertyType)}
                    </TableCell>
                    <TableCell className='font-medium text-primary'>
                      {formatCurrency(evaluation.result.estimatedValue)}
                    </TableCell>
                    <TableCell>{evaluation.result.score}/100</TableCell>
                    {!personalMode && (
                      <TableCell>
                        <Badge variant={statusVariant(evaluation.status)}>
                          {getCrmStatusLabel(evaluation.status)}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell className='text-sm text-muted-foreground'>
                      {new Date(evaluation.savedAt).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className='text-end'>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => setSelected(evaluation)}
                      >
                        <Eye className='size-4' />
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </FluxCard>
  )

  return (
    <>
      <Header fixed>
        <HeaderActions />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <PageHeader
          breadcrumbs={[
            { label: 'Início', href: '/app' },
            { label: personalMode ? 'Minhas avaliações' : 'CRM' },
          ]}
          title={personalMode ? 'Minhas avaliações' : 'CRM'}
          description={
            personalMode
              ? 'Avaliações de imóveis que você salvou para consultar depois.'
              : 'Pipeline de vendas com Lead Scoring IA, distribuição e histórico completo.'
          }
          actions={
            <Button asChild>
              <Link to='/avaliacao'>
                <Plus className='size-4' />
                Nova avaliação
              </Link>
            </Button>
          }
        />

        <div
          className={`grid gap-4 ${personalMode ? 'sm:grid-cols-1' : 'sm:grid-cols-4'}`}
        >
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium'>
                {personalMode ? 'Total salvas' : 'Total salvas'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{stats.total}</div>
            </CardContent>
          </Card>
          {!personalMode && (
            <>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='text-sm font-medium'>Novas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{stats.novo}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='text-sm font-medium'>
                    Em negociação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{stats.emNegociacao}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='text-sm font-medium'>
                    Fechadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{stats.fechado}</div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {!personalMode ? (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'pipeline' | 'evaluations')}
          >
            <TabsList>
              <TabsTrigger value='pipeline' className='gap-2'>
                <Kanban className='size-4' />
                Negócios
              </TabsTrigger>
              <TabsTrigger value='evaluations' className='gap-2'>
                <Bookmark className='size-4' />
                Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value='pipeline' className='mt-4'>
              <div className='mb-4 overflow-hidden rounded-[1.75rem] border border-flux-lavender/30 bg-gradient-to-br from-flux-lavender/10 to-flux-lime/5 p-4'>
                <p className='flex items-center gap-2 text-sm'>
                  <Sparkles className='size-4 text-flux-lavender' />
                  Lead Scoring IA · Distribuição automática · Timeline · Tags
                  inteligentes
                </p>
              </div>
              <PipelineBoard />
            </TabsContent>

            <TabsContent value='evaluations' className='mt-4'>
              {evaluationsSection}
            </TabsContent>
          </Tabs>
        ) : (
          evaluationsSection
        )}
      </Main>

      <CrmEvaluationDetail
        evaluation={selected}
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        personalMode={personalMode}
      />
    </>
  )
}
