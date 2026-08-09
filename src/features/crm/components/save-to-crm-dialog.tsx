import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { BookmarkPlus } from 'lucide-react'
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
import type {
  EvaluationFormValues,
  EvaluationResult,
} from '@/features/avaliacao/data/evaluation-engine'
import { crmStatuses } from '../data/schema'

type SaveToCrmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  property: EvaluationFormValues
  result: EvaluationResult
  mode?: 'broker' | 'personal'
  onSave: (data: {
    clientName?: string
    notes?: string
    status: (typeof crmStatuses)[number]['value']
  }) => void | Promise<void>
}

export function SaveToCrmDialog({
  open,
  onOpenChange,
  property,
  result,
  mode = 'broker',
  onSave,
}: SaveToCrmDialogProps) {
  const isPersonal = mode === 'personal'
  const [clientName, setClientName] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] =
    useState<(typeof crmStatuses)[number]['value']>('novo')

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({
        clientName: isPersonal ? undefined : clientName || undefined,
        notes: notes || undefined,
        status: isPersonal ? 'novo' : status,
      })
      setClientName('')
      setNotes('')
      setStatus('novo')
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <BookmarkPlus className='size-5 text-primary' />
            {isPersonal ? 'Salvar em minhas avaliações' : 'Salvar no CRM'}
          </DialogTitle>
          <DialogDescription>
            {isPersonal
              ? 'Guarde esta avaliação para consultar depois.'
              : 'Guarde esta avaliação para acompanhar o negócio com o cliente.'}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='rounded-lg border bg-muted/30 p-3 text-sm'>
            <p className='font-medium'>{property.address}</p>
            <p className='text-muted-foreground'>
              Valor estimado:{' '}
              {result.estimatedValue.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                maximumFractionDigits: 0,
              })}
            </p>
          </div>

          {!isPersonal && (
            <>
              <div className='space-y-2'>
                <Label htmlFor='crm-client'>Nome do cliente (opcional)</Label>
                <Input
                  id='crm-client'
                  placeholder='Ex.: Maria Silva'
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='crm-status'>Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) =>
                    setStatus(v as (typeof crmStatuses)[number]['value'])
                  }
                >
                  <SelectTrigger id='crm-status'>
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
            <Label htmlFor='crm-notes'>Observações (opcional)</Label>
            <Textarea
              id='crm-notes'
              placeholder={
                isPersonal
                  ? 'Anotações sobre o imóvel ou a avaliação...'
                  : 'Anotações sobre o cliente ou próximos passos...'
              }
              className='min-h-20'
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className='gap-2 sm:gap-0'>
          <Button
            variant='outline'
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button disabled={saving} onClick={() => void handleSave()}>
            {saving ? 'Salvando…' : 'Salvar avaliação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CrmSavedToastAction({
  mode = 'broker',
}: {
  mode?: 'broker' | 'personal'
}) {
  return (
    <Button variant='outline' size='sm' asChild>
      <Link to={mode === 'personal' ? '/minhas-avaliacoes' : '/crm'}>
        {mode === 'personal' ? 'Ver minhas avaliações' : 'Ver no CRM'}
      </Link>
    </Button>
  )
}
