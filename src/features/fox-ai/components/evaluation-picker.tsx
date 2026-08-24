import { useQuery } from '@tanstack/react-query'
import { Building2, Loader2 } from 'lucide-react'
import { listFoxAiEvaluations } from '@/lib/fox-ai-api'
import { FOX_AI_QUERY_META } from '@/lib/query-meta'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type EvaluationPickerProps = {
  value?: string
  onChange: (evaluationId: string | undefined) => void
  disabled?: boolean
}

export function EvaluationPicker({
  value,
  onChange,
  disabled,
}: EvaluationPickerProps) {
  const { data: evaluations, isLoading } = useQuery({
    queryKey: ['fox-ai', 'evaluations'],
    queryFn: listFoxAiEvaluations,
    meta: FOX_AI_QUERY_META,
  })

  if (isLoading) {
    return (
      <div className='flex items-center gap-2 text-xs text-muted-foreground'>
        <Loader2 className='size-3 animate-spin' />
        Carregando avaliações...
      </div>
    )
  }

  if (!evaluations?.length) return null

  return (
    <div className='flex items-center gap-2'>
      <Building2 className='size-3.5 shrink-0 text-orange-500' />
      <Select
        value={value ?? 'none'}
        onValueChange={(v) => onChange(v === 'none' ? undefined : v)}
        disabled={disabled}
      >
        <SelectTrigger className='h-8 w-full max-w-xs text-xs'>
          <SelectValue placeholder='Modo análise de imóvel' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='none'>Conversa geral</SelectItem>
          {evaluations.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
