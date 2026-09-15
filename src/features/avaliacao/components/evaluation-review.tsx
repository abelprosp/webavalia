import { useWatch, type Control } from 'react-hook-form'
import { CheckCircle2, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  propertyTypes,
  getStandardLevelLabel,
  getFurnishingLabel,
} from '../data/criteria'
import type { EvaluationFormValues } from '../data/evaluation-engine'

type Props = {
  control: Control<EvaluationFormValues>
  photoCount: number
  currentStep: number
  busy: boolean
  cost: number | null
  onEdit: (step: number) => void
}

export function EvaluationReview({
  control,
  photoCount,
  currentStep,
  busy,
  cost,
  onEdit,
}: Props) {
  const values = useWatch({ control })
  return (
    <aside
      aria-label='Resumo da avaliação'
      className={`h-fit rounded-3xl border bg-card p-5 shadow-sm lg:sticky lg:top-24 ${currentStep === 3 ? 'order-first lg:order-last' : ''}`}
    >
      <div className='mb-4 flex items-center gap-2'>
        <ClipboardList className='size-5 text-muted-foreground' />
        <h2 className='font-semibold'>Confira sua avaliação</h2>
      </div>
      <p className='mb-5 text-sm text-muted-foreground'>
        Revise os dados antes de iniciar. Informações completas ajudam a
        selecionar imóveis comparáveis.
      </p>
      <dl className='space-y-3 text-sm'>
        {[
          [
            'Objetivo',
            values.listingIntent === 'alugar'
              ? 'Simular aluguel'
              : 'Estimar valor de venda',
          ],
          [
            'Imóvel',
            propertyTypes.find((type) => type.value === values.propertyType)
              ?.label ?? 'Não informado',
          ],
          ['Endereço', values.address || 'Preencha o endereço'],
          ['Área', values.area ? `${values.area} m²` : 'Não informada'],
          [
            'Andar',
            values.floor === 0
              ? 'Térreo'
              : values.floor != null
                ? `${values.floor}º andar`
                : 'Não informado / não se aplica',
          ],
          [
            'Elevador até a unidade',
            values.elevatorAccess === 'sim'
              ? 'Sim'
              : values.elevatorAccess === 'nao'
                ? 'Não'
                : 'Não informado',
          ],
          ['Padrão', getStandardLevelLabel(values.standardLevel ?? 'padrao')],
          ['Mobília', getFurnishingLabel(values.furnishing ?? 'sem')],
          ['Fotos', `${photoCount} de 5 · opcionais`],
        ].map(([label, value]) => (
          <div
            key={label}
            className='flex flex-wrap justify-between gap-x-4 gap-y-1 border-b pb-2 last:border-0'
          >
            <dt className='text-muted-foreground'>{label}</dt>
            <dd className='max-w-full font-medium break-words sm:max-w-[65%] sm:text-right'>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div className='mt-4 flex flex-wrap gap-2'>
        {currentStep > 1 && (
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={busy}
            onClick={() => onEdit(1)}
          >
            Editar imóvel
          </Button>
        )}
        {currentStep > 2 && (
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={busy}
            onClick={() => onEdit(2)}
          >
            Editar detalhes
          </Button>
        )}
      </div>
      <div className='mt-5 rounded-2xl bg-muted/50 p-3 text-sm'>
        <p className='flex items-center gap-2 font-medium'>
          <CheckCircle2 className='size-4' />
          {cost != null && cost > 0
            ? `${cost} créditos por avaliação`
            : 'Limites e créditos conforme sua conta'}
        </p>
        <p className='mt-2 text-xs leading-relaxed text-muted-foreground'>
          Você receberá a estimativa, os comparáveis e as limitações da
          pesquisa. O resultado depende dos dados de mercado disponíveis.
        </p>
      </div>
    </aside>
  )
}
