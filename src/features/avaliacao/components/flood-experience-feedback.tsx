import { Droplets, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { submitFloodExperienceFeedback } from '@/lib/evaluation-api'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'

type FloodExperienceFeedbackProps = {
  evaluationId?: string | null
  address: string
  onUpdated?: () => void
}

type FloodChoice = 'none' | 'baixo' | 'moderado' | 'alto'

const choices: { id: FloodChoice; label: string; description: string }[] = [
  {
    id: 'none',
    label: 'Não, nunca pegou água',
    description: 'Endereço seco mesmo em chuvas fortes',
  },
  {
    id: 'baixo',
    label: 'Sim, pouco / quase',
    description: 'Poças, entupimento ou quase alagou',
  },
  {
    id: 'moderado',
    label: 'Sim, moderado',
    description: 'Água entrou ou alagou com frequência moderada',
  },
  {
    id: 'alto',
    label: 'Sim, grave',
    description: 'Enchente severa ou alagamento recorrente',
  },
]

export function FloodExperienceFeedback({
  evaluationId,
  address,
  onUpdated,
}: FloodExperienceFeedbackProps) {
  const [choice, setChoice] = useState<FloodChoice | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit() {
    if (!choice) {
      toast.error('Selecione se este endereço já pegou água.')
      return
    }

    setSubmitting(true)
    try {
      const gotWater = choice !== 'none'
      const result = await submitFloodExperienceFeedback({
        evaluationId: evaluationId ?? undefined,
        address,
        gotWater,
        severity: gotWater ? choice : null,
        comment: comment.trim() || undefined,
      })

      onUpdated?.()
      setSubmitted(true)
      toast.success(result.message)
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, 'Erro ao registrar informação de alagamento.')
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Card className='border-blue-200/60 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/20'>
        <CardContent className='flex items-center gap-3 py-5'>
          <Droplets className='size-5 shrink-0 text-blue-600' />
          <p className='text-sm text-muted-foreground'>
            Informação registrada. A IA usará seu relato nas próximas avaliações
            deste endereço.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className='rounded-[1.75rem] border border-dashed border-blue-200/70 bg-card shadow-sm dark:border-blue-900/40'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-lg'>
          <Droplets className='size-5 text-blue-600' />
          Este endereço já pegou água?
        </CardTitle>
        <CardDescription>
          Sua experiência local treina a IA para avaliações futuras neste
          endereço.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-2 sm:grid-cols-2'>
          {choices.map((item) => (
            <button
              key={item.id}
              type='button'
              className={cn(
                'rounded-2xl border p-3 text-start transition-colors',
                choice === item.id
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/30 dark:bg-blue-950/30'
                  : 'border-border hover:bg-muted/40'
              )}
              onClick={() => setChoice(item.id)}
            >
              <p className='text-sm font-medium'>{item.label}</p>
              <p className='mt-1 text-xs text-muted-foreground'>
                {item.description}
              </p>
            </button>
          ))}
        </div>

        <div className='space-y-2'>
          <label htmlFor='flood-comment' className='text-sm font-medium'>
            Detalhes (opcional)
          </label>
          <Textarea
            id='flood-comment'
            placeholder='Ex.: Alagou em maio/2024 com ~20 cm; bueiro entope na esquina...'
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={2000}
          />
        </div>

        <Button
          type='button'
          className='w-full rounded-full'
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className='size-4 animate-spin' />
              Salvando...
            </>
          ) : (
            'Salvar informação para a IA'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
