import { Scale, Calculator, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatCurrency, type Nbr14653Analysis } from '../data/evaluation-engine'

type Nbr14653PanelProps = {
  nbr: Nbr14653Analysis
}

export function Nbr14653Panel({ nbr }: Nbr14653PanelProps) {
  return (
    <Card className='border-emerald-200/60 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/20'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Scale className='size-5 text-emerald-700 dark:text-emerald-400' />
          Metodologia ABNT NBR 14653
        </CardTitle>
        <CardDescription>
          {nbr.standard} · Data de referência:{' '}
          {new Date(nbr.referenceDate).toLocaleDateString('pt-BR')}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-5 text-sm'>
        <div className='flex flex-wrap gap-2'>
          <Badge variant='outline'>{nbr.specificationGradeLabel}</Badge>
          <Badge variant='secondary'>
            Tolerância máxima: ±{nbr.maxDeviationPercent}%
          </Badge>
        </div>

        <p className='text-muted-foreground'>{nbr.purpose}</p>
        <p className='text-xs text-muted-foreground'>
          {nbr.specificationDescription}
        </p>

        <div>
          <p className='mb-1 font-medium'>Método principal</p>
          <p>{nbr.primaryMethod.name}</p>
          <p className='mt-1 text-muted-foreground'>
            {nbr.primaryMethod.justification}
          </p>
        </div>

        {nbr.complementaryMethods.length > 0 && (
          <div>
            <p className='mb-2 font-medium'>Métodos complementares</p>
            <div className='space-y-2'>
              {nbr.complementaryMethods.map((method) => (
                <div
                  key={method.id}
                  className='rounded-lg border bg-background/60 p-3'
                >
                  <p className='font-medium'>{method.name}</p>
                  <p className='text-muted-foreground'>{method.justification}</p>
                  {method.estimatedValue != null && (
                    <p className='mt-1 text-primary'>
                      Estimativa: {formatCurrency(method.estimatedValue)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className='mb-2 flex items-center gap-2 font-medium'>
            <Calculator className='size-4' />
            Comparáveis homogeneizados
          </p>
          <div className='space-y-3'>
            {nbr.homogenizedComparables.map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                className='rounded-lg border bg-background/60 p-3'
              >
                <div className='flex flex-wrap items-start justify-between gap-2'>
                  <div>
                    <p className='font-medium'>{item.title}</p>
                    <p className='text-primary'>{item.declaredPrice}</p>
                    {item.area && (
                      <p className='text-xs text-muted-foreground'>{item.area}</p>
                    )}
                  </div>
                  <Badge variant='outline'>
                    Peso {(item.weight * 100).toFixed(0)}%
                  </Badge>
                </div>
                {item.homogenizedUnitPriceSqm != null && (
                  <p className='mt-2 text-xs'>
                    Unitário homogeneizado:{' '}
                    <strong>
                      {formatCurrency(item.homogenizedUnitPriceSqm)}/m²
                    </strong>
                  </p>
                )}
                {item.factors.length > 0 && (
                  <ul className='mt-2 space-y-1 text-xs text-muted-foreground'>
                    {item.factors.map((factor) => (
                      <li key={factor.id}>
                        {factor.label}: ×{factor.value.toFixed(3)} —{' '}
                        {factor.justification}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className='mb-2 font-medium'>Memória de cálculo</p>
          <ol className='list-decimal space-y-1 pl-5 text-muted-foreground'>
            {nbr.calculationMemory.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {nbr.calculationMemory.homogenizedAveragePriceSqm != null && (
            <p className='mt-3'>
              Média unitária homogeneizada:{' '}
              <strong>
                {formatCurrency(nbr.calculationMemory.homogenizedAveragePriceSqm)}
                /m²
              </strong>
            </p>
          )}
          <p className='mt-1'>
            Valor de mercado (NBR 14653):{' '}
            <strong className='text-primary'>
              {formatCurrency(nbr.calculationMemory.finalValue)}
            </strong>
          </p>
        </div>

        <div>
          <p className='mb-2 flex items-center gap-2 font-medium'>
            <AlertTriangle className='size-4' />
            Limitações
          </p>
          <ul className='list-disc space-y-1 pl-5 text-muted-foreground'>
            {nbr.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className='mt-3 rounded-lg border border-amber-200/80 bg-amber-50/80 p-3 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100'>
            {nbr.disclaimer}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
