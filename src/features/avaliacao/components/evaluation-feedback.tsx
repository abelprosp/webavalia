import { useState } from 'react'
import { ThumbsDown, ThumbsUp, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { getApiErrorMessage } from '@/lib/api-error'
import { submitEvaluationFeedback } from '@/lib/evaluation-api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { showGamificationUpdates } from '@/features/gamification/lib/show-gamification-toasts'

type EvaluationFeedbackPanelProps = {
  evaluationId: string
  onSubmitted?: () => void
}

export function EvaluationFeedbackPanel({
  evaluationId,
  onSubmitted,
}: EvaluationFeedbackPanelProps) {
  const [rating, setRating] = useState<'good' | 'bad' | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [rewardMessage, setRewardMessage] = useState<string | null>(null)
  const updateCredits = useAuthStore((s) => s.auth.updateCredits)

  async function handleSubmit() {
    if (!rating) {
      toast.error('Selecione se a avaliação foi boa ou ruim.')
      return
    }

    if (comment.trim().length < 10) {
      toast.error('Explique o motivo com ao menos 10 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      const result = await submitEvaluationFeedback({
        evaluationId,
        rating,
        comment: comment.trim(),
      })

      if (result.reward?.trialEvaluationsRemaining != null) {
        updateCredits(result.reward.trialEvaluationsRemaining)
      }

      showGamificationUpdates(result.gamification)
      setRewardMessage(result.message)
      setSubmitted(true)
      toast.success(result.message)
      onSubmitted?.()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Erro ao enviar feedback.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Card className='border-primary/30 bg-primary/5'>
        <CardContent className='flex items-center gap-3 py-6'>
          <Sparkles className='size-5 shrink-0 text-primary' />
          <p className='text-sm text-muted-foreground'>
            {rewardMessage ??
              'Feedback registrado. A IA usará sua avaliação para calibrar os próximos resultados.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className='rounded-[1.75rem] border border-dashed border-flux-lavender/30 bg-card shadow-sm'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-lg'>
          <Sparkles className='size-5 text-flux-dark' />
          Modo experimental — ajude a IA a aprender
        </CardTitle>
        <CardDescription>
          Esta avaliação ficou boa ou ruim? Explique o porquê para calibrar os
          próximos resultados. Você ganha +1 avaliação bônus ao enviar feedback.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid grid-cols-2 gap-3'>
          <Button
            type='button'
            variant={rating === 'good' ? 'default' : 'outline'}
            className={cn(
              'h-auto flex-col gap-2 rounded-2xl py-4',
              rating === 'good' &&
                'bg-flux-lime text-flux-dark ring-2 ring-flux-lime ring-offset-2 hover:bg-flux-lime/90'
            )}
            onClick={() => setRating('good')}
          >
            <ThumbsUp className='size-5' />
            Boa avaliação
          </Button>
          <Button
            type='button'
            variant={rating === 'bad' ? 'default' : 'outline'}
            className={cn(
              'h-auto flex-col gap-2 rounded-2xl py-4',
              rating === 'bad' && 'ring-2 ring-destructive ring-offset-2'
            )}
            onClick={() => setRating('bad')}
          >
            <ThumbsDown className='size-5' />
            Ruim / imprecisa
          </Button>
        </div>

        <div className='space-y-2'>
          <label htmlFor='feedback-comment' className='text-sm font-medium'>
            Por quê?
          </label>
          <Textarea
            id='feedback-comment'
            placeholder={
              rating === 'bad'
                ? 'Ex.: Valor estimado muito alto, ignorou ruído da avenida e falta de vaga...'
                : 'Ex.: Valor condizente com comparáveis da região e considerou bem o acabamento...'
            }
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            maxLength={2000}
          />
          <p className='text-xs text-muted-foreground'>
            Mínimo 10 caracteres · {comment.length}/2000
          </p>
        </div>

        <Button
          type='button'
          className='w-full rounded-full bg-flux-lime font-semibold text-flux-dark hover:bg-flux-lime/90'
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className='size-4 animate-spin' />
              Enviando feedback...
            </>
          ) : (
            'Enviar feedback para a IA'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
