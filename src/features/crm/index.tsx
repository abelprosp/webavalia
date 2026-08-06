import { useMemo, useState } from 'react'
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
import { formatCurrency } from '@/features/avaliacao/data/evaluation-engine'
import { propertyTypes } from '@/features/avaliacao/data/criteria'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { HeaderActions } from '@/components/layout/header-actions'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { useCrmStore } from '@/stores/crm-store'
import { crmStatuses, getCrmStatusLabel, type CrmEvaluation } from './data/schema'
import { CrmEvaluationDetail } from './components/crm-evaluation-detail'
import { PipelineBoard } from './components/pipeline-board'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

function getPropertyTypeLabel(value: string) {
  return propertyTypes.find((t) => t.value === value)?.label ?? value
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
  const evaluations = useCrmStore((s) => s.evaluations)
  const [selected, setSelected] = useState<CrmEvaluation | null>(null)
  const [activeTab, setActiveTab] = useState<'pipeline' | 'evaluations'>('pipeline')

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

  const evaluationsSection = (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Bookmark className='size-5' />
          {personalMode ? 'Avaliações salvas' : 'Avaliações no CRM'}
        </CardTitle>
        <CardDescription>
          {personalMode
            ? 'Clique em uma avaliação para ver detalhes ou exportar PDF.'
            : 'Clique em uma avaliação para ver detalhes, editar status ou exportar PDF.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {evaluations.length === 0 ? (
          <div className='flex flex-col items-center gap-3 py-12 text-center'>
            <Inbox className='size-10 text-muted-foreground' />
            <div>
              <p className='font-medium'>Nenhuma avaliação salva</p>
              <p className='mt-1 max-w-sm text-sm text-muted-foreground'>
                {personalMode
                  ? 'Após avaliar um imóvel, use "Salvar em minhas avaliações" para guardar o resultado aqui.'
                  : 'Após avaliar um imóvel, use "Salvar no CRM" para guardar o resultado aqui.'}
              </p>
            </div>
            <Button variant='outline' asChild>
              <Link to='/avaliacao'>
                <Sparkles className='size-4' />
                Ir para avaliação
              </Link>
            </Button>
          </div>
        ) : (
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
        )}
      </CardContent>
    </Card>
  )

  return (
    <>
      <Header fixed>
        <HeaderActions />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <Breadcrumbs
          items={[
            { label: 'Início', href: '/' },
            { label: personalMode ? 'Minhas avaliações' : 'CRM' },
          ]}
          className='mb-1'
        />
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>
              {personalMode ? 'Minhas avaliações' : 'CRM'}
            </h2>
            <p className='text-muted-foreground'>
              {personalMode
                ? 'Avaliações de imóveis que você salvou para consultar depois.'
                : 'Pipeline de vendas com Lead Scoring IA, distribuição e histórico completo.'}
            </p>
          </div>
          <Button asChild>
            <Link to='/avaliacao'>
              <Plus className='size-4' />
              Nova avaliação
            </Link>
          </Button>
        </div>

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
                  <CardTitle className='text-sm font-medium'>Fechadas</CardTitle>
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
                Pipeline
                <span className='hidden text-xs text-muted-foreground sm:inline'>
                  (principal)
                </span>
              </TabsTrigger>
              <TabsTrigger value='evaluations' className='gap-2'>
                <Bookmark className='size-4' />
                Avaliações salvas
              </TabsTrigger>
            </TabsList>

            <TabsContent value='pipeline' className='mt-4'>
              <div className='mb-4 overflow-hidden rounded-[1.75rem] border border-flux-lavender/30 bg-gradient-to-br from-flux-lavender/10 to-flux-lime/5 p-4'>
                <p className='flex items-center gap-2 text-sm'>
                  <Sparkles className='size-4 text-flux-lavender' />
                  Lead Scoring IA · Distribuição automática · Timeline · Tags inteligentes
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
