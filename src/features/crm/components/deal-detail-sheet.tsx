import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Save,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { propertyTypes } from '@/features/avaliacao/data/criteria'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  fetchCrmAssignees,
  fetchDealDetails,
  rescoreDeal,
  updateDeal,
  type CrmActivity,
  type CrmAssignee,
  type CrmDeal,
  type CrmStageSummary,
  type CrmTask,
  type LeadScore,
} from '@/lib/crm-api'

type DealDetailSheetProps = {
  dealId: string | null
  stages: CrmStageSummary[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
}

type DealFormState = {
  title: string
  stageId: string
  propertyType: string
  clientName: string
  clientPhone: string
  clientEmail: string
  location: string
  assigneeId: string
  notes: string
  tags: string
  expectedTicket: string
  probability: string
  urgency: LeadScore['urgency']
  scoreExpectedTicket: string
  interest: string
  summary: string
}

function tagsToString(tags: string[]) {
  return tags.join(', ')
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

function dealToForm(deal: CrmDeal): DealFormState {
  const score = deal.leadScore
  return {
    title: deal.title,
    stageId: deal.stageId,
    propertyType: deal.propertyType ?? '',
    clientName: deal.clientName ?? '',
    clientPhone: deal.clientPhone ?? '',
    clientEmail: deal.clientEmail ?? '',
    location: deal.location ?? '',
    assigneeId: deal.assigneeId ?? '',
    notes: deal.notes ?? '',
    tags: tagsToString(deal.tags),
    expectedTicket:
      deal.expectedTicket != null ? String(deal.expectedTicket) : '',
    probability: score ? String(score.probability) : '',
    urgency: score?.urgency ?? 'baixa',
    scoreExpectedTicket:
      score?.expectedTicket != null ? String(score.expectedTicket) : '',
    interest: score?.interest ?? '',
    summary: score?.summary ?? '',
  }
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : null
}

export function DealDetailSheet({
  dealId,
  stages,
  open,
  onOpenChange,
  onUpdated,
}: DealDetailSheetProps) {
  const [deal, setDeal] = useState<CrmDeal | null>(null)
  const [form, setForm] = useState<DealFormState | null>(null)
  const [activities, setActivities] = useState<CrmActivity[]>([])
  const [tasks, setTasks] = useState<CrmTask[]>([])
  const [assignees, setAssignees] = useState<CrmAssignee[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scoring, setScoring] = useState(false)

  useEffect(() => {
    if (!open || !dealId) return

    async function load() {
      setLoading(true)
      try {
        const [data, brokerAssignees] = await Promise.all([
          fetchDealDetails(dealId!),
          fetchCrmAssignees(),
        ])
        setDeal(data.deal)
        setForm(dealToForm(data.deal))
        setActivities(data.activities)
        setTasks(data.tasks)
        setAssignees(brokerAssignees)
      } catch {
        toast.error('Erro ao carregar negócio.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [open, dealId])

  function updateField<K extends keyof DealFormState>(key: K, value: DealFormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function handleSave() {
    if (!dealId || !form) return

    const ticket = parseOptionalNumber(form.expectedTicket)
    const scoreTicket = parseOptionalNumber(form.scoreExpectedTicket)
    const probabilityRaw = form.probability.trim()
    const probability = probabilityRaw ? Number(probabilityRaw) : undefined

    if (probabilityRaw && (!Number.isFinite(probability) || probability! < 0 || probability! > 100)) {
      toast.error('Probabilidade deve ser entre 0 e 100.')
      return
    }

    setSaving(true)
    try {
      const tags = parseTags(form.tags)
      const hasScoreFields =
        probabilityRaw ||
        form.interest.trim() ||
        form.summary.trim() ||
        scoreTicket != null

      const updated = await updateDeal(dealId, {
        title: form.title.trim() || deal!.title,
        stageId: form.stageId,
        propertyType: form.propertyType || null,
        clientName: form.clientName.trim() || null,
        clientPhone: form.clientPhone.trim() || null,
        clientEmail: form.clientEmail.trim() || null,
        location: form.location.trim() || null,
        assigneeId: form.assigneeId || null,
        notes: form.notes,
        tags,
        expectedTicket: ticket,
        ...(hasScoreFields
          ? {
              leadScore: {
                ...(probability !== undefined ? { probability } : {}),
                urgency: form.urgency,
                ...(scoreTicket != null ? { expectedTicket: scoreTicket } : {}),
                interest: form.interest.trim(),
                summary: form.summary.trim(),
                tags,
              },
            }
          : {}),
      })

      setDeal(updated)
      setForm(dealToForm(updated))
      onUpdated()
      toast.success('Negócio atualizado.')
    } catch {
      toast.error('Erro ao salvar alterações.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRescore() {
    if (!dealId) return
    setScoring(true)
    try {
      const updated = await rescoreDeal(dealId)
      setDeal(updated)
      setForm(dealToForm(updated))
      onUpdated()
      toast.success('Lead reavaliado pela IA.')
    } catch {
      toast.error('Erro ao reavaliar lead.')
    } finally {
      setScoring(false)
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-lg'>
        {loading || !deal || !form ? (
          <div className='flex h-40 items-center justify-center'>
            <Loader2 className='size-6 animate-spin text-muted-foreground' />
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>Editar negócio</SheetTitle>
              <SheetDescription>
                Todos os campos abaixo podem ser editados e salvos.
              </SheetDescription>
            </SheetHeader>

            <div className='mt-6 space-y-6'>
              <section className='space-y-3'>
                <h3 className='text-sm font-semibold'>Informações gerais</h3>
                <div className='space-y-2'>
                  <Label htmlFor='deal-title'>Título</Label>
                  <Input
                    id='deal-title'
                    value={form.title}
                    onChange={(e) => updateField('title', e.target.value)}
                  />
                </div>
                <div className='grid grid-cols-2 gap-3'>
                  <div className='space-y-2'>
                    <Label>Etapa</Label>
                    <Select
                      value={form.stageId}
                      onValueChange={(v) => updateField('stageId', v)}
                    >
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder='Etapa' />
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='space-y-2'>
                    <Label>Tipo de imóvel</Label>
                    <Select
                      value={form.propertyType || '__none__'}
                      onValueChange={(v) =>
                        updateField('propertyType', v === '__none__' ? '' : v)
                      }
                    >
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder='Tipo' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='__none__'>Não informado</SelectItem>
                        {propertyTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className='space-y-2'>
                  <Label>Responsável</Label>
                  <Select
                    value={form.assigneeId || '__none__'}
                    onValueChange={(v) =>
                      updateField('assigneeId', v === '__none__' ? '' : v)
                    }
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='Responsável' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='__none__'>Sem responsável</SelectItem>
                      {assignees.map((assignee) => (
                        <SelectItem key={assignee.id} value={assignee.id}>
                          {assignee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </section>

              <section className='space-y-3'>
                <h3 className='text-sm font-semibold'>Cliente</h3>
                <div className='space-y-2'>
                  <Label htmlFor='client-name'>Nome</Label>
                  <Input
                    id='client-name'
                    value={form.clientName}
                    onChange={(e) => updateField('clientName', e.target.value)}
                  />
                </div>
                <div className='grid grid-cols-2 gap-3'>
                  <div className='space-y-2'>
                    <Label htmlFor='client-phone'>Telefone</Label>
                    <Input
                      id='client-phone'
                      value={form.clientPhone}
                      onChange={(e) => updateField('clientPhone', e.target.value)}
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='client-email'>E-mail</Label>
                    <Input
                      id='client-email'
                      type='email'
                      value={form.clientEmail}
                      onChange={(e) => updateField('clientEmail', e.target.value)}
                    />
                  </div>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='location'>Localização</Label>
                  <Input
                    id='location'
                    value={form.location}
                    onChange={(e) => updateField('location', e.target.value)}
                  />
                </div>
              </section>

              <section className='rounded-xl border border-flux-lime/30 bg-flux-lime/10 p-4'>
                <div className='mb-3 flex items-center justify-between'>
                  <h3 className='flex items-center gap-2 text-sm font-semibold'>
                    <Sparkles className='size-4 text-flux-lavender' />
                    Lead Scoring
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
                      'Reavaliar com IA'
                    )}
                  </Button>
                </div>
                <div className='grid grid-cols-2 gap-3'>
                  <div className='space-y-2'>
                    <Label htmlFor='probability'>Probabilidade (%)</Label>
                    <Input
                      id='probability'
                      type='number'
                      min={0}
                      max={100}
                      value={form.probability}
                      onChange={(e) => updateField('probability', e.target.value)}
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label>Urgência</Label>
                    <Select
                      value={form.urgency}
                      onValueChange={(v) =>
                        updateField('urgency', v as LeadScore['urgency'])
                      }
                    >
                      <SelectTrigger className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='baixa'>Baixa</SelectItem>
                        <SelectItem value='media'>Média</SelectItem>
                        <SelectItem value='alta'>Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='score-ticket'>Ticket esperado (score)</Label>
                    <Input
                      id='score-ticket'
                      type='number'
                      min={0}
                      value={form.scoreExpectedTicket}
                      onChange={(e) =>
                        updateField('scoreExpectedTicket', e.target.value)
                      }
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='expected-ticket'>Valor esperado</Label>
                    <Input
                      id='expected-ticket'
                      type='number'
                      min={0}
                      value={form.expectedTicket}
                      onChange={(e) => updateField('expectedTicket', e.target.value)}
                    />
                  </div>
                </div>
                <div className='mt-3 space-y-2'>
                  <Label htmlFor='interest'>Interesse</Label>
                  <Input
                    id='interest'
                    value={form.interest}
                    onChange={(e) => updateField('interest', e.target.value)}
                  />
                </div>
                <div className='mt-3 space-y-2'>
                  <Label htmlFor='summary'>Resumo IA</Label>
                  <Textarea
                    id='summary'
                    value={form.summary}
                    onChange={(e) => updateField('summary', e.target.value)}
                    rows={2}
                  />
                </div>
              </section>

              <section className='space-y-2'>
                <Label htmlFor='tags'>Tags (separadas por vírgula)</Label>
                <Input
                  id='tags'
                  value={form.tags}
                  onChange={(e) => updateField('tags', e.target.value)}
                  placeholder='quente, apartamento, zona sul'
                />
                {parseTags(form.tags).length > 0 && (
                  <div className='flex flex-wrap gap-1 pt-1'>
                    {parseTags(form.tags).map((tag) => (
                      <Badge key={tag} variant='secondary' className='text-[10px]'>
                        {tag}
                      </Badge>
                    ))}
                  </div>
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

              <section className='space-y-2'>
                <Label htmlFor='notes'>Notas</Label>
                <Textarea
                  id='notes'
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  rows={4}
                  placeholder='Observações comerciais...'
                />
              </section>

              <Button
                className='w-full'
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? (
                  <Loader2 className='size-4 animate-spin' />
                ) : (
                  <>
                    <Save className='me-2 size-4' />
                    Salvar alterações
                  </>
                )}
              </Button>

              <section>
                <h3 className='mb-2 text-sm font-semibold'>Timeline de atividades</h3>
                <div className='space-y-3 border-l-2 border-muted pl-4'>
                  {activities.length === 0 && (
                    <p className='text-sm text-muted-foreground'>Nenhuma atividade.</p>
                  )}
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
