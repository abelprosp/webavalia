import { Calculator, AlertTriangle } from 'lucide-react'
import { BentoCard, FluxBadge } from './bento-card'
import { formatCurrency, type Nbr14653Analysis } from '../data/evaluation-engine'

type Nbr14653PanelProps = {
  nbr: Nbr14653Analysis
  className?: string
}

export function Nbr14653Panel({ nbr, className }: Nbr14653PanelProps) {
  return (
    <BentoCard
      title='Metodologia ABNT NBR 14653'
      subtitle={`${nbr.standard} · Ref. ${new Date(nbr.referenceDate).toLocaleDateString('pt-BR')}`}
      className={className}
      showMenu
    >
      <div className='space-y-5 text-sm'>
        <div className='flex flex-wrap gap-2'>
          <FluxBadge variant='lavender'>{nbr.specificationGradeLabel}</FluxBadge>
          <FluxBadge variant='dark'>±{nbr.maxDeviationPercent}% tolerância</FluxBadge>
        </div>

        <p className='text-xs leading-relaxed text-muted-foreground'>
          {nbr.purpose} — {nbr.specificationDescription}
        </p>

        <div className='rounded-2xl bg-muted/40 p-4'>
          <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
            Método principal
          </p>
          <p className='mt-1 font-medium'>{nbr.primaryMethod.name}</p>
          <p className='mt-1 text-xs leading-relaxed text-muted-foreground'>
            {nbr.primaryMethod.justification}
          </p>
        </div>

        {nbr.complementaryMethods.length > 0 && (
          <div>
            <p className='mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
              Métodos complementares
            </p>
            <div className='space-y-2'>
              {nbr.complementaryMethods.map((method) => (
                <div
                  key={method.id}
                  className='rounded-2xl border border-black/[0.04] bg-muted/20 p-3'
                >
                  <p className='font-medium'>{method.name}</p>
                  <p className='mt-0.5 text-xs text-muted-foreground'>
                    {method.justification}
                  </p>
                  {method.estimatedValue != null && (
                    <p className='mt-2 text-sm font-bold text-flux-dark'>
                      Estimativa: {formatCurrency(method.estimatedValue)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className='mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
            <Calculator className='size-3.5' />
            Comparáveis homogeneizados
          </p>
          <div className='space-y-2'>
            {nbr.homogenizedComparables.map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                className='rounded-2xl border border-black/[0.04] bg-muted/20 p-4'
              >
                <div className='flex flex-wrap items-start justify-between gap-2'>
                  <div className='min-w-0'>
                    <p className='font-medium leading-snug'>{item.title}</p>
                    <p className='mt-1 text-base font-bold text-flux-dark'>
                      {item.declaredPrice}
                    </p>
                    {item.area && (
                      <p className='text-xs text-muted-foreground'>{item.area}</p>
                    )}
                  </div>
                  <FluxBadge variant='lavender'>
                    Peso {(item.weight * 100).toFixed(0)}%
                  </FluxBadge>
                </div>
                {item.homogenizedUnitPriceSqm != null && (
                  <p className='mt-2 text-xs text-muted-foreground'>
                    Unitário homogeneizado:{' '}
                    <strong className='text-foreground'>
                      {formatCurrency(item.homogenizedUnitPriceSqm)}/m²
                    </strong>
                  </p>
                )}
                {item.factors.length > 0 && (
                  <div className='mt-3 flex flex-wrap gap-1.5'>
                    {item.factors.map((factor) => (
                      <span
                        key={factor.id}
                        className='rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground'
                      >
                        {factor.label} ×{factor.value.toFixed(2)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className='rounded-2xl bg-flux-dark p-4 text-white'>
          <p className='text-xs font-semibold uppercase tracking-wide text-white/50'>
            Memória de cálculo
          </p>
          <ol className='mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-white/75'>
            {nbr.calculationMemory.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className='mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-white/10 pt-4'>
            {nbr.calculationMemory.homogenizedAveragePriceSqm != null && (
              <div>
                <p className='text-[10px] text-white/45'>Média unitária</p>
                <p className='text-sm font-semibold'>
                  {formatCurrency(nbr.calculationMemory.homogenizedAveragePriceSqm)}/m²
                </p>
              </div>
            )}
            <div className='text-right'>
              <p className='text-[10px] text-white/45'>Valor NBR 14653</p>
              <p className='text-xl font-bold text-flux-lime'>
                {formatCurrency(nbr.calculationMemory.finalValue)}
              </p>
            </div>
          </div>
        </div>

        <div>
          <p className='mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
            <AlertTriangle className='size-3.5' />
            Limitações
          </p>
          <ul className='space-y-1 text-xs leading-relaxed text-muted-foreground'>
            {nbr.limitations.map((item) => (
              <li key={item} className='flex gap-2'>
                <span className='text-flux-lavender'>·</span>
                {item}
              </li>
            ))}
          </ul>
          <p className='mt-3 rounded-2xl border border-amber-200/60 bg-amber-50/80 px-3 py-2.5 text-[11px] leading-relaxed text-amber-950'>
            {nbr.disclaimer}
          </p>
        </div>
      </div>
    </BentoCard>
  )
}
