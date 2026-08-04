import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Droplets,
  Eye,
  Loader2,
  MessageSquare,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  fetchAdminEvaluation,
  fetchAdminEvaluations,
  fetchAdminFeedbacks,
  type AdminEvaluationDetail,
  type AdminEvaluationListItem,
  type AdminFeedbackListItem,
} from '@/lib/admin-api'
import { getAccountTypeLabel } from '@/lib/account-type'
import { formatCurrency } from '@/features/avaliacao/data/evaluation-engine'

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR')
}

function FeedbackRatingBadge({ rating }: { rating: 'good' | 'bad' | null }) {
  if (!rating) return <span className='text-muted-foreground'>—</span>
  return (
    <Badge variant={rating === 'good' ? 'default' : 'destructive'} className='gap-1'>
      {rating === 'good' ? (
        <ThumbsUp className='size-3' />
      ) : (
        <ThumbsDown className='size-3' />
      )}
      {rating === 'good' ? 'Boa' : 'Ruim'}
    </Badge>
  )
}

function FloodFeedbackBadge({
  gotWater,
  severity,
}: {
  gotWater: boolean | null
  severity: string | null
}) {
  if (gotWater == null) return null
  if (!gotWater) {
    return <Badge variant='outline'>Não alaga</Badge>
  }
  return (
    <Badge variant='secondary' className='gap-1 capitalize'>
      <Droplets className='size-3' />
      {severity ?? 'alagou'}
    </Badge>
  )
}

export function AdminEvaluationsPage() {
  const [tab, setTab] = useState<'evaluations' | 'feedbacks'>('evaluations')
  const [search, setSearch] = useState('')
  const [evaluations, setEvaluations] = useState<AdminEvaluationListItem[]>([])
  const [evaluationsTotal, setEvaluationsTotal] = useState(0)
  const [feedbacks, setFeedbacks] = useState<AdminFeedbackListItem[]>([])
  const [feedbacksTotal, setFeedbacksTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AdminEvaluationDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  async function loadEvaluations() {
    setLoading(true)
    try {
      const data = await fetchAdminEvaluations({
        search: search || undefined,
        limit: 100,
      })
      setEvaluations(data.evaluations)
      setEvaluationsTotal(data.total)
    } catch {
      toast.error('Erro ao carregar avaliações.')
    } finally {
      setLoading(false)
    }
  }

  async function loadFeedbacks() {
    setLoading(true)
    try {
      const data = await fetchAdminFeedbacks({ limit: 100 })
      setFeedbacks(data.feedbacks)
      setFeedbacksTotal(data.total)
    } catch {
      toast.error('Erro ao carregar feedbacks.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'evaluations') loadEvaluations()
    else loadFeedbacks()
  }, [tab])

  async function openEvaluation(id: string) {
    setLoadingDetail(true)
    try {
      const detail = await fetchAdminEvaluation(id)
      setSelected(detail)
    } catch {
      toast.error('Erro ao carregar detalhes da avaliação.')
    } finally {
      setLoadingDetail(false)
    }
  }

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-xl font-semibold'>Avaliações e feedbacks</h2>
        <p className='text-sm text-muted-foreground'>
          Visualize todas as avaliações IA e os feedbacks enviados pelos usuários.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as 'evaluations' | 'feedbacks')}
      >
        <TabsList>
          <TabsTrigger value='evaluations' className='gap-2'>
            <Sparkles className='size-4' />
            Avaliações ({evaluationsTotal})
          </TabsTrigger>
          <TabsTrigger value='feedbacks' className='gap-2'>
            <MessageSquare className='size-4' />
            Feedbacks ({feedbacksTotal})
          </TabsTrigger>
        </TabsList>

        <TabsContent value='evaluations' className='mt-4 space-y-4'>
          <div className='flex flex-col gap-3 sm:flex-row'>
            <div className='relative flex-1'>
              <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                className='pl-9'
                placeholder='Buscar por usuário, e-mail ou endereço...'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadEvaluations()}
              />
            </div>
            <Button variant='outline' onClick={loadEvaluations}>
              Buscar
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Todas as avaliações</CardTitle>
              <CardDescription>
                {evaluationsTotal} avaliação(ões) registrada(s) na plataforma
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className='flex items-center gap-2 py-8 text-sm text-muted-foreground'>
                  <Loader2 className='size-4 animate-spin' />
                  Carregando...
                </div>
              ) : evaluations.length === 0 ? (
                <p className='py-8 text-sm text-muted-foreground'>
                  Nenhuma avaliação encontrada.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Endereço</TableHead>
                      <TableHead>Valor estimado</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Risco hídrico</TableHead>
                      <TableHead>Feedbacks</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className='text-end'>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evaluations.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className='font-medium'>{item.userName}</div>
                          <div className='text-xs text-muted-foreground'>
                            {item.userEmail} · {getAccountTypeLabel(item.accountType)}
                          </div>
                        </TableCell>
                        <TableCell className='max-w-48 truncate' title={item.address}>
                          {item.address}
                        </TableCell>
                        <TableCell>
                          {item.estimatedValue != null
                            ? formatCurrency(item.estimatedValue)
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {item.score != null ? `${item.score}/100` : '—'}
                        </TableCell>
                        <TableCell className='capitalize'>
                          {item.floodRiskLevel ?? '—'}
                        </TableCell>
                        <TableCell>
                          <div className='flex flex-wrap gap-1'>
                            {item.hasEvaluationFeedback && (
                              <FeedbackRatingBadge
                                rating={item.evaluationFeedbackRating}
                              />
                            )}
                            {item.floodFeedbackCount > 0 && (
                              <Badge variant='outline' className='gap-1'>
                                <Droplets className='size-3' />
                                {item.floodFeedbackCount}
                              </Badge>
                            )}
                            {!item.hasEvaluationFeedback &&
                              item.floodFeedbackCount === 0 && (
                                <span className='text-muted-foreground'>—</span>
                              )}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(item.createdAt)}</TableCell>
                        <TableCell className='text-end'>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => openEvaluation(item.id)}
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
        </TabsContent>

        <TabsContent value='feedbacks' className='mt-4'>
          <Card>
            <CardHeader>
              <CardTitle>Todos os feedbacks</CardTitle>
              <CardDescription>
                Feedbacks de qualidade da avaliação e relatos de alagamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className='flex items-center gap-2 py-8 text-sm text-muted-foreground'>
                  <Loader2 className='size-4 animate-spin' />
                  Carregando...
                </div>
              ) : feedbacks.length === 0 ? (
                <p className='py-8 text-sm text-muted-foreground'>
                  Nenhum feedback registrado ainda.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Endereço</TableHead>
                      <TableHead>Conteúdo</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feedbacks.map((item) => (
                      <TableRow key={`${item.type}-${item.id}`}>
                        <TableCell>
                          <Badge variant='outline'>
                            {item.type === 'evaluation' ? 'Avaliação' : 'Alagamento'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className='font-medium'>{item.userName}</div>
                          <div className='text-xs text-muted-foreground'>
                            {item.userEmail}
                          </div>
                        </TableCell>
                        <TableCell className='max-w-40 truncate' title={item.address ?? ''}>
                          {item.address ?? '—'}
                        </TableCell>
                        <TableCell className='max-w-md'>
                          <div className='space-y-1'>
                            {item.type === 'evaluation' ? (
                              <FeedbackRatingBadge rating={item.rating} />
                            ) : (
                              <FloodFeedbackBadge
                                gotWater={item.gotWater}
                                severity={item.severity}
                              />
                            )}
                            {item.comment && (
                              <p className='text-sm text-muted-foreground'>
                                {item.comment}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(item.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className='max-h-[90vh] max-w-3xl overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Detalhes da avaliação</DialogTitle>
          </DialogHeader>
          {loadingDetail || !selected ? (
            <div className='flex items-center gap-2 py-8 text-sm text-muted-foreground'>
              <Loader2 className='size-4 animate-spin' />
              Carregando detalhes...
            </div>
          ) : (
            <div className='space-y-4 text-sm'>
              <div className='grid gap-3 sm:grid-cols-2'>
                <div>
                  <p className='text-xs font-medium text-muted-foreground'>Usuário</p>
                  <p>{selected.userName}</p>
                  <p className='text-muted-foreground'>{selected.userEmail}</p>
                </div>
                <div>
                  <p className='text-xs font-medium text-muted-foreground'>Data</p>
                  <p>{formatDate(selected.createdAt)}</p>
                </div>
                <div className='sm:col-span-2'>
                  <p className='text-xs font-medium text-muted-foreground'>Endereço</p>
                  <p>{selected.address}</p>
                </div>
                <div>
                  <p className='text-xs font-medium text-muted-foreground'>Valor estimado</p>
                  <p>
                    {selected.estimatedValue != null
                      ? formatCurrency(selected.estimatedValue)
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className='text-xs font-medium text-muted-foreground'>Score</p>
                  <p>{selected.score != null ? `${selected.score}/100` : '—'}</p>
                </div>
              </div>

              {selected.evaluationFeedback && (
                <div className='rounded-lg border p-3'>
                  <p className='mb-2 font-medium'>Feedback da avaliação</p>
                  <FeedbackRatingBadge rating={selected.evaluationFeedback.rating} />
                  <p className='mt-2 text-muted-foreground'>
                    {selected.evaluationFeedback.comment}
                  </p>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    {formatDate(selected.evaluationFeedback.createdAt)}
                  </p>
                </div>
              )}

              {selected.floodFeedbacks.length > 0 && (
                <div className='rounded-lg border p-3'>
                  <p className='mb-2 font-medium'>Feedbacks de alagamento</p>
                  <div className='space-y-3'>
                    {selected.floodFeedbacks.map((item) => (
                      <div key={item.id} className='rounded-md bg-muted/40 p-2'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <span className='font-medium'>{item.userName}</span>
                          <FloodFeedbackBadge
                            gotWater={item.gotWater}
                            severity={item.severity}
                          />
                        </div>
                        {item.comment && (
                          <p className='mt-1 text-muted-foreground'>{item.comment}</p>
                        )}
                        <p className='mt-1 text-xs text-muted-foreground'>
                          {formatDate(item.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className='mb-2 font-medium'>Entrada do imóvel</p>
                <pre className='max-h-48 overflow-auto rounded-lg bg-muted/40 p-3 text-xs'>
                  {JSON.stringify(selected.propertyInput, null, 2)}
                </pre>
              </div>

              <div>
                <p className='mb-2 font-medium'>Resultado da IA</p>
                <pre className='max-h-64 overflow-auto rounded-lg bg-muted/40 p-3 text-xs'>
                  {JSON.stringify(selected.evaluationResult, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
