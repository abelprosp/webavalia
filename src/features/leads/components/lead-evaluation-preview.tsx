import { Building2, MapPin, ShieldCheck, Sparkles } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdvancedAnalysisPanel } from '@/features/avaliacao/components/advanced-analysis-panel'
import { EvaluationEvidence } from '@/features/avaliacao/components/evaluation-evidence'
import { Nbr14653Panel } from '@/features/avaliacao/components/nbr-14653-panel'
import {
  propertyTypes,
  conservationStates,
  getStandardLevelLabel,
} from '@/features/avaliacao/data/criteria'
import {
  formatCurrency,
  estimateMonthlyRent,
  type EvaluationFormValues,
  type EvaluationResult,
} from '@/features/avaliacao/data/evaluation-engine'

function sourceUrl(link?: string) {
  try {
    const url = new URL(link ?? '')
    return ['https:', 'http:'].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined
  } catch {
    return undefined
  }
}

export function LeadEvaluationPreview({
  property,
  result,
  location,
}: {
  property: EvaluationFormValues
  result: EvaluationResult
  location: string
}) {
  const rental =
    property.listingIntent === 'alugar'
      ? estimateMonthlyRent(result.estimatedValue, property)
      : null
  const type =
    propertyTypes.find((item) => item.value === property.propertyType)?.label ??
    property.propertyType
  const characteristics = [
    ['Área', `${property.area} m²`],
    ['Quartos', String(property.bedrooms)],
    ['Banheiros', String(property.bathrooms)],
    ['Vagas', String(property.parking)],
    [
      'Conservação',
      conservationStates.find((item) => item.value === property.conservation)
        ?.label ?? property.conservation,
    ],
    ['Padrão', getStandardLevelLabel(property.standardLevel)],
    ...(property.floor != null
      ? [
          [
            'Andar',
            property.floor === 0 ? 'Térreo' : `${property.floor}º andar`,
          ],
        ]
      : []),
  ]
  return (
    <div className='min-w-0 space-y-5'>
      <section className='overflow-hidden rounded-2xl border bg-card'>
        <div className='space-y-4 p-4 sm:p-6'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <p className='flex items-center gap-2 text-sm font-medium'>
              <Building2 className='size-4 text-muted-foreground' />
              {type} · {rental ? 'Para alugar' : 'À venda'}
            </p>
            <span className='rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground'>
              Avaliação disponível
            </span>
          </div>
          <p className='flex items-start gap-2 text-sm text-muted-foreground'>
            <MapPin className='mt-0.5 size-4 shrink-0' />
            <span className='break-words'>{location}</span>
          </p>
          <div>
            <p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
              {rental ? 'Simulação de aluguel' : 'Valor estimado de venda'}
            </p>
            <p className='mt-1 text-3xl font-bold tracking-tight break-words tabular-nums sm:text-4xl'>
              {formatCurrency(rental?.monthlyRent ?? result.estimatedValue)}
              {rental && (
                <span className='text-base font-medium text-muted-foreground'>
                  {' '}
                  /mês
                </span>
              )}
            </p>
            <p className='mt-2 text-sm text-muted-foreground'>
              {formatCurrency(rental?.rentPerSqm ?? result.valuePerSqm)}/m²
              {rental
                ? ' · calculado por rendimento estimado'
                : ' · referência de mercado'}
            </p>
          </div>
        </div>
        <dl className='grid grid-cols-2 gap-px border-t bg-border sm:grid-cols-4'>
          {characteristics.map(([label, value]) => (
            <div key={label} className='min-w-0 bg-card px-4 py-3'>
              <dt className='text-xs text-muted-foreground'>{label}</dt>
              <dd className='mt-1 text-sm font-semibold break-words'>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <Tabs defaultValue='overview' className='min-w-0'>
        <TabsList
          aria-label='Informações da avaliação'
          className='grid h-auto w-full grid-cols-3 rounded-xl p-1'
        >
          <TabsTrigger value='overview' className='min-h-10'>
            Resumo
          </TabsTrigger>
          <TabsTrigger value='market' className='min-h-10'>
            Mercado
          </TabsTrigger>
          <TabsTrigger value='details' className='min-h-10'>
            Análise
          </TabsTrigger>
        </TabsList>
        <TabsContent value='overview' className='space-y-4 pt-3'>
          {result.nbr14653?.sampleQuality && (
            <EvaluationEvidence
              quality={result.nbr14653.sampleQuality}
              showRange={!rental}
            />
          )}
          <section className='rounded-2xl border bg-card p-4 sm:p-5'>
            <h3 className='flex items-center gap-2 text-sm font-semibold'>
              <Sparkles className='size-4' />O que considerar neste imóvel
            </h3>
            {result.aiInsights.length > 0 ? (
              <ul className='mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground'>
                {result.aiInsights.map((insight, index) => (
                  <li key={index} className='flex gap-2'>
                    <span
                      aria-hidden
                      className='mt-2 size-1.5 shrink-0 rounded-full bg-foreground/40'
                    />
                    <span className='min-w-0 break-words'>{insight}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className='mt-3 text-sm text-muted-foreground'>
                Não há observações adicionais nesta avaliação.
              </p>
            )}
          </section>
          <p className='flex gap-2 px-1 text-xs leading-relaxed text-muted-foreground'>
            <ShieldCheck className='size-4 shrink-0' />
            Nome completo, contato e endereço completo permanecem protegidos até
            o desbloqueio.
          </p>
        </TabsContent>
        <TabsContent value='market' className='space-y-4 pt-3'>
          <section className='rounded-2xl border bg-card p-4 sm:p-5'>
            <h3 className='text-sm font-semibold'>Pesquisa de mercado</h3>
            <p className='mt-2 text-sm leading-relaxed text-muted-foreground'>
              {result.marketAnalysis.summary ||
                'Resumo de mercado não disponível.'}
            </p>
            <p className='mt-4 text-xs text-muted-foreground'>
              {result.marketAnalysis.comparables.length} anúncio(s) de
              referência · preços de oferta
            </p>
          </section>
          {result.marketAnalysis.comparables.map((item, index) => (
            <article
              key={index}
              className='min-w-0 rounded-2xl border bg-card p-4'
            >
              <h4 className='text-sm font-medium break-words'>{item.title}</h4>
              <p className='mt-2 text-lg font-semibold break-words'>
                {item.price}
              </p>
              <p className='mt-1 text-xs text-muted-foreground'>
                {item.area ? `${item.area} · ` : ''}
                {item.source}
              </p>
              {sourceUrl(item.link) && (
                <a
                  href={sourceUrl(item.link)}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='mt-3 inline-flex min-h-10 items-center text-sm font-medium underline underline-offset-4'
                >
                  Consultar anúncio<span className='sr-only'> (nova aba)</span>
                </a>
              )}
            </article>
          ))}
          {result.marketAnalysis.comparables.length === 0 && (
            <p className='rounded-xl border border-dashed p-4 text-sm text-muted-foreground'>
              Esta avaliação não possui anúncios de referência disponíveis.
            </p>
          )}
        </TabsContent>
        <TabsContent value='details' className='space-y-4 pt-3'>
          <AdvancedAnalysisPanel
            neighborhood={result.neighborhoodAnalysis}
            appreciation={result.marketAppreciationAnalysis}
          />
          <section className='rounded-2xl border bg-card p-4 sm:p-5'>
            <h3 className='text-sm font-semibold'>Zoneamento e potencial</h3>
            <p className='mt-2 text-sm font-medium'>
              {result.masterPlanAnalysis.zoning}
            </p>
            <p className='mt-2 text-sm leading-relaxed text-muted-foreground'>
              {result.masterPlanAnalysis.summary ||
                'Sem análise de zoneamento disponível.'}
            </p>
            {result.masterPlanAnalysis.restrictions.map((item, index) => (
              <p key={index} className='mt-2 text-sm text-muted-foreground'>
                {item}
              </p>
            ))}
          </section>
          {result.floodRiskAnalysis && (
            <section className='rounded-2xl border bg-card p-4'>
              <h3 className='text-sm font-semibold'>
                Alagamento · {result.floodRiskAnalysis.riskLevelLabel}
              </h3>
              <p className='mt-2 text-sm leading-relaxed text-muted-foreground'>
                {result.floodRiskAnalysis.summary}
              </p>
            </section>
          )}
          {result.nbr14653 && <Nbr14653Panel nbr={result.nbr14653} />}
        </TabsContent>
      </Tabs>
      <p className='px-1 text-xs leading-relaxed text-muted-foreground'>
        Estimativa automatizada de{' '}
        {result.evaluatedAt.toLocaleDateString('pt-BR')}. O valor pode variar
        conforme as condições do imóvel e do mercado.
      </p>
    </div>
  )
}
