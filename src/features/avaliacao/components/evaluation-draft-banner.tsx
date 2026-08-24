import { FileText, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type EvaluationDraftBannerProps = {
  updatedAt: string
  onDiscard: () => void
}

export function EvaluationDraftBanner({
  updatedAt,
  onDiscard,
}: EvaluationDraftBannerProps) {
  const formattedDate = new Date(updatedAt).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  return (
    <Alert className='border-amber-200/80 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30'>
      <FileText className='size-4 text-amber-700 dark:text-amber-300' />
      <div className='flex flex-1 flex-wrap items-start justify-between gap-3'>
        <div>
          <AlertTitle className='text-amber-950 dark:text-amber-100'>
            Rascunho salvo automaticamente
          </AlertTitle>
          <AlertDescription className='text-amber-900/90 dark:text-amber-200/90'>
            O formulário é salvo automaticamente para você não perder o
            preenchimento. Última atualização: {formattedDate}. As fotos não
            entram no rascunho e precisam ser enviadas novamente.
          </AlertDescription>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='shrink-0'
          onClick={onDiscard}
        >
          <X className='size-4' />
          Descartar rascunho
        </Button>
      </div>
    </Alert>
  )
}
