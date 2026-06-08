import { useState } from 'react'
import {
  Sparkles,
  TrendingUp,
  BarChart3,
  Images,
  Building2,
  MapPin,
  ExternalLink,
  Landmark,
  FileDown,
  Loader2,
  BookmarkPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { useCrmStore } from '@/stores/crm-store'
import {
  CrmSavedToastAction,
  SaveToCrmDialog,
} from '@/features/crm/components/save-to-crm-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  getFinishLevelLabel,
  getFurnishingLabel,
  getStandardLevelLabel,
} from '../data/criteria'
import {
  formatCurrency,
  type EvaluationFormValues,
  type EvaluationResult,
} from '../data/evaluation-engine'
import { exportEvaluationPdf } from '../lib/export-evaluation-pdf'
import { Nbr14653Panel } from './nbr-14653-panel'

type EvaluationResultPanelProps = {
  result: EvaluationResult
  property: EvaluationFormValues
}

function getPropertyHighlights(property: EvaluationFormValues) {
  const highlights: string[] = []

  if (property.standardLevel && property.standardLevel !== 'padrao') {
    highlights.push(getStandardLevelLabel(property.standardLevel))
  }
  if (property.furnishing && property.furnishing !== 'sem') {
    highlights.push(getFurnishingLabel(property.furnishing))
  }
  if (property.finishLevel && !['basico', 'padrao'].includes(property.finishLevel)) {
    highlights.push(`Acabamento ${getFinishLevelLabel(property.finishLevel).toLowerCase()}`)
  }
  if (property.amenities?.length) {
    highlights.push(`${property.amenities.length} diferenciais`)
  }

  return highlights
}

export function EvaluationResultPanel({
  result,
  property,
}: EvaluationResultPanelProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const saveEvaluation = useCrmStore((s) => s.saveEvaluation)
  const { marketAnalysis, masterPlanAnalysis } = result
  const propertyHighlights = getPropertyHighlights(property)

  async function handleExportPdf() {
    setIsExporting(true)
    try {
      await exportEvaluationPdf({ result, property })
      toast.success('PDF exportado com sucesso!')
    } catch {
      toast.error('Não foi possível gerar o PDF. Tente novamente.')
    } finally {
      setIsExporting(false)
    }
  }

  function handleSaveToCrm(data: {
    clientName?: string
    notes?: string
    status: 'novo' | 'em_negociacao' | 'proposta' | 'fechado' | 'arquivado'
  }) {
    saveEvaluation({
      property,
      result,
      ...data,
    })
    toast.success('Avaliação salva no CRM!', {
      action: <CrmSavedToastAction />,
    })
  }

  return (
    <>
    <Card>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <Sparkles className='size-5 text-primary' />
              Resultado da IA
            </CardTitle>
            <CardDescription>
              {result.evaluatedAt.toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </CardDescription>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setSaveDialogOpen(true)}
            >
              <BookmarkPlus className='size-4' />
              Salvar no CRM
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
              Exportar PDF
            </Button>
            <Badge
              variant={result.score >= 70 ? 'default' : 'secondary'}
              className='text-sm'
            >
              {result.scoreLabel}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-6'>
        <div className='rounded-lg bg-primary/5 p-6 text-center'>
          <p className='text-sm text-muted-foreground'>Valor estimado</p>
          <p className='mt-1 text-3xl font-bold text-primary'>
            {formatCurrency(result.estimatedValue)}
          </p>
          <p className='mt-2 text-sm text-muted-foreground'>
            {formatCurrency(result.valuePerSqm)}/m² · Score {result.score}/100
          </p>
          {marketAnalysis.averagePricePerSqm != null && (
            <p className='mt-1 text-xs text-muted-foreground'>
              Média de mercado:{' '}
              {formatCurrency(marketAnalysis.averagePricePerSqm)}/m²
            </p>
          )}
          {propertyHighlights.length > 0 && (
            <div className='mt-3 flex flex-wrap justify-center gap-2'>
              {propertyHighlights.map((highlight) => (
                <Badge key={highlight} variant='outline' className='text-xs'>
                  {highlight}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className='mb-3 flex items-center gap-2 text-sm font-medium'>
            <Building2 className='size-4' />
            Análise de mercado local
          </h4>
          <p className='mb-3 text-sm leading-relaxed text-muted-foreground'>
            {marketAnalysis.summary}
          </p>
          {marketAnalysis.priceRange && (
            <p className='mb-3 text-sm'>
              Faixa de preços:{' '}
              <strong>
                {formatCurrency(marketAnalysis.priceRange.min)} –{' '}
                {formatCurrency(marketAnalysis.priceRange.max)}
              </strong>
            </p>
          )}
          {marketAnalysis.comparables.length > 0 && (
            <div className='space-y-2'>
              <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                Imóveis comparáveis
              </p>
              {marketAnalysis.comparables.map((item, i) => (
                <div
                  key={i}
                  className='rounded-lg border bg-muted/30 p-3 text-sm'
                >
                  <div className='flex items-start justify-between gap-2'>
                    <div>
                      <p className='font-medium'>{item.title}</p>
                      <p className='text-primary'>{item.price}</p>
                      {item.area && (
                        <p className='text-xs text-muted-foreground'>
                          {item.area}
                        </p>
                      )}
                      <Badge variant='outline' className='mt-1 text-xs'>
                        {item.source}
                      </Badge>
                    </div>
                    {item.link && (
                      <a
                        href={item.link}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='shrink-0 text-muted-foreground hover:text-primary'
                      >
                        <ExternalLink className='size-4' />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div>
          <h4 className='mb-3 flex items-center gap-2 text-sm font-medium'>
            <Landmark className='size-4' />
            Plano Diretor e zoneamento
          </h4>
          <div className='space-y-3 rounded-lg border bg-muted/20 p-4 text-sm'>
            <div>
              <p className='text-xs font-medium text-muted-foreground'>
                Zoneamento
              </p>
              <p className='mt-0.5'>{masterPlanAnalysis.zoning}</p>
            </div>
            <div>
              <p className='text-xs font-medium text-muted-foreground'>
                Usos permitidos
              </p>
              <ul className='mt-1 list-inside list-disc space-y-0.5'>
                {masterPlanAnalysis.allowedUses.length > 0 ? (
                  masterPlanAnalysis.allowedUses.map((use, i) => (
                    <li key={i}>{use}</li>
                  ))
                ) : (
                  <li>Informação não encontrada nas fontes consultadas</li>
                )}
              </ul>
            </div>
            <div>
              <p className='text-xs font-medium text-muted-foreground'>
                Restrições
              </p>
              <ul className='mt-1 list-inside list-disc space-y-0.5'>
                {masterPlanAnalysis.restrictions.length > 0 ? (
                  masterPlanAnalysis.restrictions.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))
                ) : (
                  <li>Nenhuma restrição identificada nas fontes</li>
                )}
              </ul>
            </div>
            <div>
              <p className='text-xs font-medium text-muted-foreground'>
                Potencial de desenvolvimento
              </p>
              <p className='mt-0.5'>{masterPlanAnalysis.developmentPotential}</p>
            </div>
            <p className='border-t pt-3 leading-relaxed text-muted-foreground'>
              {masterPlanAnalysis.summary}
            </p>
          </div>
        </div>

        {result.nbr14653 && (
          <>
            <Separator />
            <Nbr14653Panel nbr={result.nbr14653} />
          </>
        )}

        <Separator />

        <div>
          <h4 className='mb-3 flex items-center gap-2 text-sm font-medium'>
            <BarChart3 className='size-4' />
            Pontuação por critério
          </h4>
          <div className='space-y-3'>
            {result.criteriaScores.map((criterion) => (
              <div key={criterion.id} className='space-y-1'>
                <div className='flex justify-between text-sm'>
                  <span>{criterion.label}</span>
                  <span className='font-medium'>{criterion.score}/5</span>
                </div>
                <div className='h-2 overflow-hidden rounded-full bg-muted'>
                  <div
                    className='h-full rounded-full bg-primary transition-all'
                    style={{ width: `${(criterion.score / 5) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {result.photoCount > 0 && (
          <>
            <Separator />
            <div>
              <h4 className='mb-3 flex items-center gap-2 text-sm font-medium'>
                <Images className='size-4' />
                Fotos analisadas ({result.photoCount})
              </h4>
              <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
                {result.photoPreviews.map((url, i) => (
                  <div
                    key={url}
                    className='aspect-square overflow-hidden rounded-lg border bg-muted'
                  >
                    <img
                      src={url}
                      alt={`Foto ${i + 1} do imóvel`}
                      className='size-full object-cover'
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <Separator />

        <div>
          <h4 className='mb-3 flex items-center gap-2 text-sm font-medium'>
            <TrendingUp className='size-4' />
            Insights da IA
          </h4>
          <ul className='space-y-2'>
            {result.aiInsights.map((insight, i) => (
              <li
                key={i}
                className='rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed'
              >
                {insight}
              </li>
            ))}
          </ul>
        </div>

        {result.sources && (
          <p className='flex items-center gap-1 text-xs text-muted-foreground'>
            <MapPin className='size-3' />
            Fontes: {result.sources.marketResultsCount} resultados de mercado,{' '}
            {result.sources.masterPlanResultsCount} do plano diretor
          </p>
        )}
      </CardContent>
    </Card>

    <SaveToCrmDialog
      open={saveDialogOpen}
      onOpenChange={setSaveDialogOpen}
      property={property}
      result={result}
      onSave={handleSaveToCrm}
    />
    </>
  )
}
