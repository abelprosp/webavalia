import { SearchCheck } from 'lucide-react'
import {
  formatCurrency,
  type EvaluationSampleQuality,
} from '../data/evaluation-engine'

export function EvaluationEvidence({
  quality,
  showRange = true,
}: {
  quality: EvaluationSampleQuality
  showRange?: boolean
}) {
  const label =
    quality.status === 'insuficiente'
      ? 'Amostra insuficiente'
      : quality.status === 'limitada'
        ? 'Amostra limitada'
        : 'Amostra disponível'
  return (
    <section
      aria-label='Qualidade da amostra'
      className='rounded-2xl border bg-card p-4 sm:p-5'
    >
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h3 className='flex items-center gap-2 font-semibold'>
          <SearchCheck className='size-5' />
          Base desta estimativa
        </h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${quality.status === 'insuficiente' ? 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100' : 'bg-muted text-foreground'}`}
        >
          {label}
        </span>
      </div>
      <dl className='mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4'>
        {[
          ['Comparáveis usados', quality.usedCount],
          ['Repetidos removidos', quality.duplicatesRemoved],
          ['Excluídos da conta', quality.excludedCount],
          [
            'Links na pesquisa',
            quality.sourceCheckPerformed
              ? quality.matchedSourceCount
              : 'Não verificados',
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className='text-xs text-muted-foreground'>{label}</dt>
            <dd className='mt-1 text-lg font-semibold'>{value}</dd>
          </div>
        ))}
      </dl>
      {showRange && quality.observedValueRange && (
        <div className='mt-4 border-t pt-4'>
          <p className='text-sm font-medium'>
            Faixa observada nos comparáveis ajustados
          </p>
          <p className='mt-1 text-lg font-semibold'>
            {formatCurrency(quality.observedValueRange.min)} –{' '}
            {formatCurrency(quality.observedValueRange.max)}
          </p>
          <p className='mt-1 text-xs text-muted-foreground'>
            Valores convertidos para a área deste imóvel. Não é intervalo de
            confiança nem garantia de preço de venda.
          </p>
        </div>
      )}
      <details className='mt-4 text-sm'>
        <summary className='cursor-pointer rounded font-medium focus-visible:outline-2 focus-visible:outline-offset-4'>
          Como interpretar esta amostra
        </summary>
        <ul className='mt-3 list-disc space-y-2 pl-5 text-xs leading-relaxed text-muted-foreground'>
          {quality.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </details>
    </section>
  )
}
