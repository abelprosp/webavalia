import { useState } from 'react'
import { FileDown, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { exportEvaluationPdf } from '@/features/avaliacao/lib/export-evaluation-pdf'
import { formatCurrency } from '@/features/avaliacao/data/evaluation-engine'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { useCrmStore } from '@/stores/crm-store'
import {
  crmStatuses,
  deserializeEvaluationResult,
  getCrmStatusLabel,
  type CrmEvaluation,
} from '../data/schema'
import { propertyTypes } from '@/features/avaliacao/data/criteria'

type CrmEvaluationDetailProps = {
  evaluation: CrmEvaluation | null
  open: boolean
  onOpenChange: (open: boolean) => void
  personalMode?: boolean
}

function getPropertyTypeLabel(value: string) {
  return propertyTypes.find((t) => t.value === value)?.label ?? value
}

export function CrmEvaluationDetail({
  evaluation,
  open,
  onOpenChange,
  personalMode = false,
}: CrmEvaluationDetailProps) {
  const updateEvaluation = useCrmStore((s) => s.updateEvaluation)
  const removeEvaluation = useCrmStore((s) => s.removeEvaluation)
  const [isExporting, setIsExporting] = useState(false)
  const [clientName, setClientName] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] =
    useState<(typeof crmStatuses)[number]['value']>('novo')

  if (!evaluation) return null

  const result = deserializeEvaluationResult(evaluation.result)

  function syncFormFromEvaluation(e: CrmEvaluation) {
    setClientName(e.clientName ?? '')
    setNotes(e.notes ?? '')
    setStatus(e.status)
  }

  function handleOpenChange(next: boolean) {
    if (next) syncFormFromEvaluation(evaluation!)
    onOpenChange(next)
  }

  function handleSaveChanges() {
    updateEvaluation(evaluation!.id, {
      clientName: clientName.trim() || undefined,
      notes: notes.trim() || undefined,
      status,
    })
    toast.success(
      personalMode
        ? 'Avaliação atualizada'
        : 'Avaliação atualizada no CRM'
    )
  }

  async function handleExportPdf() {
    setIsExporting(true)
    try {
      await exportEvaluationPdf({
        result,
        property: evaluation!.property,
      })
      toast.success('PDF exportado com sucesso!')
    } catch {
      toast.error('Não foi possível gerar o PDF.')
    } finally {
      setIsExporting(false)
    }
  }

  function handleDelete() {
    removeEvaluation(evaluation!.id)
    toast.success(
      personalMode
        ? 'Avaliação removida'
        : 'Avaliação removida do CRM'
    )
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{evaluation.property.address}</DialogTitle>
          <DialogDescription>
            Salva em{' '}
            {new Date(evaluation.savedAt).toLocaleString('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='rounded-lg bg-primary/5 p-4 text-center'>
            <p className='text-sm text-muted-foreground'>Valor estimado</p>
            <p className='text-2xl font-bold text-primary'>
              {formatCurrency(result.estimatedValue)}
            </p>
            <p className='mt-1 text-sm text-muted-foreground'>
              {formatCurrency(result.valuePerSqm)}/m² · Score {result.score}
              /100
            </p>
            <Badge className='mt-2' variant='secondary'>
              {result.scoreLabel}
            </Badge>
          </div>

          <div className='grid grid-cols-2 gap-3 text-sm'>
            <div>
              <p className='text-xs text-muted-foreground'>Tipo</p>
              <p>{getPropertyTypeLabel(evaluation.property.propertyType)}</p>
            </div>
            <div>
              <p className='text-xs text-muted-foreground'>Área</p>
              <p>{evaluation.property.area} m²</p>
            </div>
            <div>
              <p className='text-xs text-muted-foreground'>Quartos</p>
              <p>{evaluation.property.bedrooms}</p>
            </div>
            {!personalMode && (
              <div>
                <p className='text-xs text-muted-foreground'>Status CRM</p>
                <p>{getCrmStatusLabel(evaluation.status)}</p>
              </div>
            )}
          </div>

          <Separator />

          <div className='space-y-3'>
            {!personalMode && (
              <>
                <div className='space-y-2'>
                  <Label htmlFor='detail-client'>Cliente</Label>
                  <Input
                    id='detail-client'
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder='Nome do cliente'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='detail-status'>Status</Label>
                  <Select
                    value={status}
                    onValueChange={(v) =>
                      setStatus(v as (typeof crmStatuses)[number]['value'])
                    }
                  >
                    <SelectTrigger id='detail-status'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {crmStatuses.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className='space-y-2'>
              <Label htmlFor='detail-notes'>Observações</Label>
              <Textarea
                id='detail-notes'
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className='min-h-20'
              />
            </div>
          </div>

          {result.aiInsights.length > 0 && (
            <>
              <Separator />
              <div>
                <p className='mb-2 text-sm font-medium'>Insights da IA</p>
                <ul className='space-y-1 text-sm text-muted-foreground'>
                  {result.aiInsights.slice(0, 3).map((insight, i) => (
                    <li key={i}>• {insight}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>

        <DialogFooter className='flex-col gap-2 sm:flex-row'>
          <Button
            variant='destructive'
            size='sm'
            onClick={handleDelete}
            className='sm:me-auto'
          >
            <Trash2 className='size-4' />
            Remover
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={handleExportPdf}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <FileDown className='size-4' />
            )}
            PDF
          </Button>
          <Button size='sm' onClick={handleSaveChanges}>
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
