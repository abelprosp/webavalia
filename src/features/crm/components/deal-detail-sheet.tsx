import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  MapPin,
  Sparkles,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/features/avaliacao/data/evaluation-engine'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import {
  completeCrmTask,
  fetchDealDetails,
  getUrgencyLabel,
  rescoreDeal,
  updateDealNotes,
  type CrmActivity,
  type CrmDeal,
  type CrmTask,
} from '@/lib/crm-api'

type DealDetailSheetProps = {
  dealId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
}

export function DealDetailSheet({
  dealId,
  open,
  onOpenChange,
  onUpdated,
}: DealDetailSheetProps) {
  const [deal, setDeal] = useState<CrmDeal | null>(null)
  const [activities, setActivities] = useState<CrmActivity[]>([])
  const [tasks, setTasks] = useState<CrmTask[]>([])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [scoring, setScoring] = useState(false)

  useEffect(() => {
    if (!open || !dealId) return

    async function load() {
      setLoading(true)
      try {
        const data = await fetchDealDetails(dealId!)
        setDeal(data.deal)
        setActivities(data.activities)
        setTasks(data.tasks)
        setNotes(data.deal.notes ?? '')
      } catch {
        toast.error('Erro ao carregar negócio.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [open, dealId])

  async function handleRescore() {
    if (!dealId) return
    setScoring(true)
    try {
      const updated = await rescoreDeal(dealId)
      setDeal(updated)
      onUpdated()
      toast.success('Lead reavaliado pela IA.')
    } catch {
      toast.error('Erro ao reavaliar lead.')
    } finally {
      setScoring(false)
    }
  }

  async function handleSaveNotes() {
    if (!dealId) return
    try {
      await updateDealNotes(dealId, notes)
      toast.success('Notas salvas.')
      onUpdated()
    } catch {
      toast.error('Erro ao salvar notas.')
    }
  }

  async function handleCompleteTask(taskId: string) {
    try {
      await completeCrmTask(taskId)
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, completedAt: new Date().toISOString() } : t
        )
      )
      toast.success('Tarefa concluída.')
    } catch {
      toast.error('Erro ao concluir tarefa.')
    }
  }

  const score = deal?.leadScore

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-lg'>
        {loading || !deal ? (
          <div className='flex h-40 items-center justify-center'>
            <Loader2 className='size-6 animate-spin text-muted-foreground' />
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{deal.title}</SheetTitle>
              <SheetDescription>
                {deal.clientName ?? 'Lead'} · {deal.propertyType ?? 'Imóvel'}
              </SheetDescription>
            </SheetHeader>

            <div className='mt-6 space-y-6'>
              {score && (
                <section className='rounded-xl border border-flux-lime/30 bg-flux-lime/10 p-4'>
                  <div className='mb-3 flex items-center justify-between'>
                    <h3 className='flex items-center gap-2 text-sm font-semibold'>
                      <Sparkles className='size-4 text-flux-lavender' />
                      Lead Scoring IA
                    </h3>
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={scoring}
                      onClick={() => void handleRescore()}
                    >
                      {scoring ? (
                        <Loader2 className='size-4 animate-spin' />
                      ) : (
                        'Reavaliar'
                      )}
                    </Button>
                  </div>
                  <div className='grid grid-cols-2 gap-3 text-sm'>
                    <div>
                      <p className='text-muted-foreground'>Probabilidade</p>
                      <p className='text-xl font-bold'>{score.probability}%</p>
                    </div>
                    <div>
                      <p className='text-muted-foreground'>Urgência</p>
                      <p className='font-semibold'>{getUrgencyLabel(score.urgency)}</p>
                    </div>
                    <div>
                      <p className='text-muted-foreground'>Ticket esperado</p>
                      <p className='font-semibold'>
                        {formatCurrency(score.expectedTicket)}
                      </p>
                    </div>
                    <div>
                      <p className='text-muted-foreground'>Interesse</p>
                      <p className='line-clamp-2 font-medium'>{score.interest}</p>
                    </div>
                  </div>
                  <p className='mt-3 text-xs text-muted-foreground'>{score.summary}</p>
                  <div className='mt-3 flex flex-wrap gap-1'>
                    {deal.tags.map((tag) => (
                      <Badge key={tag} variant='secondary' className='text-[10px]'>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              <section className='space-y-2 text-sm'>
                {deal.clientPhone && (
                  <p className='flex items-center gap-2'>
                    <User className='size-4' /> {deal.clientPhone}
                  </p>
                )}
                {deal.location && (
                  <p className='flex items-center gap-2'>
                    <MapPin className='size-4' /> {deal.location}
                  </p>
                )}
              </section>

              <section>
                <h3 className='mb-2 text-sm font-semibold'>Tarefas da etapa</h3>
                <div className='space-y-2'>
                  {tasks.length === 0 && (
                    <p className='text-sm text-muted-foreground'>Nenhuma tarefa.</p>
                  )}
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className='flex items-start gap-2 rounded-lg border p-2 text-sm'
                    >
                      <button
                        type='button'
                        className='mt-0.5 shrink-0'
                        disabled={Boolean(task.completedAt)}
                        onClick={() => void handleCompleteTask(task.id)}
                      >
                        {task.completedAt ? (
                          <CheckCircle2 className='size-4 text-emerald-600' />
                        ) : (
                          <Circle className='size-4 text-muted-foreground' />
                        )}
                      </button>
                      <div>
                        <p
                          className={
                            task.completedAt ? 'text-muted-foreground line-through' : ''
                          }
                        >
                          {task.title}
                        </p>
                        {task.dueAt && (
                          <p className='flex items-center gap-1 text-xs text-muted-foreground'>
                            <Clock className='size-3' />
                            {new Date(task.dueAt).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className='mb-2 text-sm font-semibold'>Notas</h3>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder='Observações comerciais...'
                />
                <Button
                  size='sm'
                  className='mt-2'
                  onClick={() => void handleSaveNotes()}
                >
                  Salvar notas
                </Button>
              </section>

              <section>
                <h3 className='mb-2 text-sm font-semibold'>Timeline de atividades</h3>
                <div className='space-y-3 border-l-2 border-muted pl-4'>
                  {activities.map((activity) => (
                    <div key={activity.id} className='relative'>
                      <span className='absolute -left-[21px] top-1 size-2.5 rounded-full bg-flux-lavender' />
                      <p className='text-sm font-medium'>{activity.title}</p>
                      {activity.body && (
                        <p className='text-xs text-muted-foreground'>{activity.body}</p>
                      )}
                      <p className='text-[10px] text-muted-foreground'>
                        {new Date(activity.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
