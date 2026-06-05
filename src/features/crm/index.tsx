import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Bookmark,
  Eye,
  Inbox,
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
import { CreditsBadge } from '@/components/credits-badge'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { useCrmStore } from '@/stores/crm-store'
import { crmStatuses, getCrmStatusLabel, type CrmEvaluation } from './data/schema'
import { CrmEvaluationDetail } from './components/crm-evaluation-detail'

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

export function Crm() {
  const evaluations = useCrmStore((s) => s.evaluations)
  const [selected, setSelected] = useState<CrmEvaluation | null>(null)

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

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <CreditsBadge />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>CRM</h2>
            <p className='text-muted-foreground'>
              Avaliações salvas para acompanhar clientes e negociações.
            </p>
          </div>
          <Button asChild>
            <Link to='/avaliacao'>
              <Plus className='size-4' />
              Nova avaliação
            </Link>
          </Button>
        </div>

        <div className='grid gap-4 sm:grid-cols-4'>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium'>Total salvas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{stats.total}</div>
            </CardContent>
          </Card>
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
              <CardTitle className='text-sm font-medium'>Em negociação</CardTitle>
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
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Bookmark className='size-5' />
              Avaliações no CRM
            </CardTitle>
            <CardDescription>
              Clique em uma avaliação para ver detalhes, editar status ou
              exportar PDF.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {evaluations.length === 0 ? (
              <div className='flex flex-col items-center gap-3 py-12 text-center'>
                <Inbox className='size-10 text-muted-foreground' />
                <div>
                  <p className='font-medium'>Nenhuma avaliação salva</p>
                  <p className='mt-1 max-w-sm text-sm text-muted-foreground'>
                    Após avaliar um imóvel, use &quot;Salvar no CRM&quot; para
                    guardar o resultado aqui.
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
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor estimado</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
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
                      <TableCell>
                        {evaluation.clientName ?? (
                          <span className='text-muted-foreground'>—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getPropertyTypeLabel(evaluation.property.propertyType)}
                      </TableCell>
                      <TableCell className='font-medium text-primary'>
                        {formatCurrency(evaluation.result.estimatedValue)}
                      </TableCell>
                      <TableCell>{evaluation.result.score}/100</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(evaluation.status)}>
                          {getCrmStatusLabel(evaluation.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>
                        {new Date(evaluation.savedAt).toLocaleDateString(
                          'pt-BR'
                        )}
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
      </Main>

      <CrmEvaluationDetail
        evaluation={selected}
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </>
  )
}
