import { jsPDF } from 'jspdf'
import {
  conservationStates,
  formatAmenities,
  getBuildingAgeLabel,
  getCondominiumLevelLabel,
  getFinishLevelLabel,
  getFurnishingLabel,
  getStandardLevelLabel,
  getViewTypeLabel,
  isLandOnlyPropertyType,
  propertyTypes,
} from '../data/criteria'
import {
  estimateMonthlyRent,
  formatCurrency,
  getListingIntentLabel,
  getSaleScenarios,
  type EvaluationFormValues,
  type EvaluationResult,
} from '../data/evaluation-engine'

const MARGIN = 20
const PAGE_WIDTH = 210
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const LINE_HEIGHT = 6

type ExportPdfInput = {
  result: EvaluationResult
  property: EvaluationFormValues
}

function getPropertyTypeLabel(value: string) {
  return propertyTypes.find((t) => t.value === value)?.label ?? value
}

function getConservationLabel(value: string) {
  return conservationStates.find((s) => s.value === value)?.label ?? value
}

function addSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(22, 101, 52)
  doc.text(title, MARGIN, y)
  doc.setDrawColor(22, 101, 52)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, y + 2, PAGE_WIDTH - MARGIN, y + 2)
  doc.setTextColor(30, 30, 30)
  return y + 10
}

function addParagraph(
  doc: jsPDF,
  text: string,
  y: number,
  options?: { bold?: boolean; fontSize?: number }
) {
  doc.setFont('helvetica', options?.bold ? 'bold' : 'normal')
  doc.setFontSize(options?.fontSize ?? 10)
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH)
  const blockHeight = lines.length * LINE_HEIGHT

  if (y + blockHeight > 280) {
    doc.addPage()
    y = MARGIN
  }

  doc.text(lines, MARGIN, y)
  return y + blockHeight + 4
}

function addBulletList(doc: jsPDF, items: string[], y: number) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  for (const item of items) {
    const lines = doc.splitTextToSize(`• ${item}`, CONTENT_WIDTH - 4)
    const blockHeight = lines.length * LINE_HEIGHT

    if (y + blockHeight > 280) {
      doc.addPage()
      y = MARGIN
    }

    doc.text(lines, MARGIN + 2, y)
    y += blockHeight + 2
  }

  return y + 2
}

async function addPhotos(
  doc: jsPDF,
  previews: string[],
  y: number
): Promise<number> {
  if (previews.length === 0) return y

  y = addSectionTitle(doc, `Fotos do imóvel (${previews.length})`, y)
  const imageSize = 40
  let x = MARGIN
  const maxPerRow = 4

  for (let i = 0; i < Math.min(previews.length, 8); i++) {
    try {
      const response = await fetch(previews[i])
      const blob = await response.blob()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      if (y + imageSize > 275) {
        doc.addPage()
        y = MARGIN
        x = MARGIN
      }

      const format = dataUrl.includes('image/png') ? 'PNG' : 'JPEG'
      doc.addImage(dataUrl, format, x, y, imageSize, imageSize)
      x += imageSize + 4

      if ((i + 1) % maxPerRow === 0) {
        y += imageSize + 8
        x = MARGIN
      }
    } catch {
      // ignora foto que não puder ser carregada
    }
  }

  if (x > MARGIN) y += imageSize + 8
  return y + 4
}

export async function exportEvaluationPdf({
  result,
  property,
}: ExportPdfInput) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGIN

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(22, 101, 52)
  doc.text('Avalia Imobe', MARGIN, y)
  y += 8

  doc.setFontSize(14)
  doc.setTextColor(30, 30, 30)
  doc.text('Relatório de Avaliação de Imóvel', MARGIN, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text(
    `Gerado em ${result.evaluatedAt.toLocaleString('pt-BR', {
      dateStyle: 'long',
      timeStyle: 'short',
    })}`,
    MARGIN,
    y
  )
  y += 12

  y = addSectionTitle(doc, 'Dados do imóvel', y)
  const landOnly = isLandOnlyPropertyType(property.propertyType)
  const propertyLines = [
    property.cep ? `CEP: ${property.cep}` : null,
    `Endereço: ${property.address}`,
    `Tipo: ${getPropertyTypeLabel(property.propertyType)}`,
    landOnly
      ? `Metragem do terreno: ${property.area} m²`
      : `Área: ${property.area} m² · Quartos: ${property.bedrooms} · Banheiros: ${property.bathrooms} · Vagas: ${property.parking}`,
    property.lotArea ? `Terreno: ${property.lotArea} m²` : null,
    !landOnly
      ? `Idade da construção: ${getBuildingAgeLabel(property.buildingAge)} · Conservação: ${getConservationLabel(property.conservation)}`
      : `Conservação: ${getConservationLabel(property.conservation)}`,
    `Padrão: ${getStandardLevelLabel(property.standardLevel ?? 'padrao')} · Mobília: ${getFurnishingLabel(property.furnishing ?? 'sem')}`,
    `Acabamento: ${getFinishLevelLabel(property.finishLevel ?? 'padrao')} · Condomínio: ${getCondominiumLevelLabel(property.condominiumLevel ?? 'nao-aplica')}`,
    property.viewType
      ? `Vista: ${getViewTypeLabel(property.viewType)}`
      : 'Vista: não informada',
    `Diferenciais: ${formatAmenities(property.amenities)}`,
    property.highEndFurnitureValue
      ? `Móveis alto padrão (valor estimado): ${formatCurrency(property.highEndFurnitureValue)}`
      : null,
    property.askingPrice
      ? `Valor pedido: ${formatCurrency(property.askingPrice)}`
      : 'Valor pedido: não informado',
  ]
  for (const line of propertyLines.filter(Boolean)) {
    y = addParagraph(doc, line as string, y)
  }
  if (property.notes) {
    y = addParagraph(doc, `Observações: ${property.notes}`, y)
  }

  y = addSectionTitle(doc, 'Resultado da avaliação', y)
  const listingIntent = property.listingIntent ?? 'vender'
  y = addParagraph(doc, `Objetivo: ${getListingIntentLabel(listingIntent)}`, y)

  if (listingIntent === 'alugar') {
    const rental = estimateMonthlyRent(result.estimatedValue, property)
    y = addParagraph(
      doc,
      `Aluguel estimado: ${formatCurrency(rental.monthlyRent)}/mês`,
      y,
      { bold: true, fontSize: 12 }
    )
    y = addParagraph(
      doc,
      `${formatCurrency(rental.rentPerSqm)}/m² · Valor de venda de referência: ${formatCurrency(result.estimatedValue)} · Score: ${result.score}/100 (${result.scoreLabel})`,
      y
    )
  } else {
    y = addParagraph(
      doc,
      `Valor estimado: ${formatCurrency(result.estimatedValue)}`,
      y,
      { bold: true, fontSize: 12 }
    )
    y = addParagraph(
      doc,
      `${formatCurrency(result.valuePerSqm)}/m² · Score: ${result.score}/100 (${result.scoreLabel})`,
      y
    )

    const saleScenarios = getSaleScenarios(result, property.area)
    y = addSectionTitle(doc, 'Cenários de venda', y)
    y = addParagraph(
      doc,
      'Faixas de preço conforme o tempo esperado para vender, com base no valor estimado de mercado.',
      y
    )
    for (const scenario of saleScenarios) {
      const adjustmentLabel =
        scenario.adjustmentPercent === 0
          ? 'valor de mercado'
          : `${scenario.adjustmentPercent > 0 ? '+' : ''}${scenario.adjustmentPercent}% vs. estimado`
      y = addParagraph(
        doc,
        `${scenario.label} (${scenario.timeframe}): ${formatCurrency(scenario.value)} — ${formatCurrency(scenario.valuePerSqm)}/m² · ${adjustmentLabel}`,
        y
      )
      y = addParagraph(doc, scenario.description, y)
    }
  }
  if (result.marketAnalysis.averagePricePerSqm != null) {
    y = addParagraph(
      doc,
      `Média de mercado: ${formatCurrency(result.marketAnalysis.averagePricePerSqm)}/m²`,
      y
    )
  }

  y = addSectionTitle(doc, 'Análise de mercado local', y)
  y = addParagraph(doc, result.marketAnalysis.summary, y)
  if (result.marketAnalysis.priceRange) {
    y = addParagraph(
      doc,
      `Faixa de preços: ${formatCurrency(result.marketAnalysis.priceRange.min)} – ${formatCurrency(result.marketAnalysis.priceRange.max)}`,
      y
    )
  }
  if (result.marketAnalysis.comparables.length > 0) {
    y = addParagraph(doc, 'Imóveis comparáveis:', y, { bold: true })
    for (const item of result.marketAnalysis.comparables) {
      const text = `${item.title} — ${item.price}${item.area ? ` (${item.area})` : ''} [${item.source}]`
      y = addParagraph(doc, text, y)
    }
  }

  y = addSectionTitle(doc, 'Plano Diretor e zoneamento', y)
  y = addParagraph(doc, `Zoneamento: ${result.masterPlanAnalysis.zoning}`, y)
  y = addParagraph(doc, 'Usos permitidos:', y, { bold: true })
  y = addBulletList(
    doc,
    result.masterPlanAnalysis.allowedUses.length > 0
      ? result.masterPlanAnalysis.allowedUses
      : ['Informação não encontrada nas fontes consultadas'],
    y
  )
  y = addParagraph(doc, 'Restrições:', y, { bold: true })
  y = addBulletList(
    doc,
    result.masterPlanAnalysis.restrictions.length > 0
      ? result.masterPlanAnalysis.restrictions
      : ['Nenhuma restrição identificada nas fontes'],
    y
  )
  y = addParagraph(
    doc,
    `Potencial de desenvolvimento: ${result.masterPlanAnalysis.developmentPotential}`,
    y
  )
  y = addParagraph(doc, result.masterPlanAnalysis.summary, y)

  if (result.neighborhoodAnalysis) {
    const n = result.neighborhoodAnalysis
    y = addSectionTitle(doc, 'Pesquisa avançada do bairro', y)
    y = addParagraph(doc, n.overview, y)
    if (n.infrastructure.length > 0) {
      y = addParagraph(doc, 'Infraestrutura:', y, { bold: true })
      y = addBulletList(doc, n.infrastructure, y)
    }
    if (n.services.length > 0) {
      y = addParagraph(doc, 'Serviços:', y, { bold: true })
      y = addBulletList(doc, n.services, y)
    }
    if (n.mobility.length > 0) {
      y = addParagraph(doc, 'Mobilidade:', y, { bold: true })
      y = addBulletList(doc, n.mobility, y)
    }
    y = addParagraph(doc, `Segurança percebida: ${n.safetyPerception}`, y)
    y = addParagraph(doc, `Qualidade de vida: ${n.qualityOfLife}`, y)
    if (n.highlights.length > 0) {
      y = addParagraph(doc, 'Destaques:', y, { bold: true })
      y = addBulletList(doc, n.highlights, y)
    }
    if (n.concerns.length > 0) {
      y = addParagraph(doc, 'Pontos de atenção:', y, { bold: true })
      y = addBulletList(doc, n.concerns, y)
    }
    y = addParagraph(doc, n.summary, y)
  }

  if (result.marketAppreciationAnalysis) {
    const a = result.marketAppreciationAnalysis
    y = addSectionTitle(doc, 'Valorização e tendência de mercado', y)
    y = addParagraph(doc, `Tendência: ${a.trendLabel}`, y, { bold: true })
    if (a.annualGrowthEstimatePercent != null) {
      y = addParagraph(
        doc,
        `Crescimento estimado: ${a.annualGrowthEstimatePercent > 0 ? '+' : ''}${a.annualGrowthEstimatePercent}% ao ano`,
        y
      )
    }
    y = addParagraph(doc, a.historicalContext, y)
    y = addParagraph(doc, `Demanda: ${a.demandLevel}`, y)
    y = addParagraph(doc, `Liquidez: ${a.liquidity}`, y)
    if (a.priceTrendFactors.length > 0) {
      y = addParagraph(doc, 'Fatores de tendência:', y, { bold: true })
      y = addBulletList(doc, a.priceTrendFactors, y)
    }
    y = addParagraph(doc, `Projeção: ${a.projectionSummary}`, y)
    y = addParagraph(doc, a.summary, y)
  }

  if (result.nbr14653) {
    const nbr = result.nbr14653
    y = addSectionTitle(doc, 'Metodologia ABNT NBR 14653', y)
    y = addParagraph(doc, `${nbr.standard}`, y)
    y = addParagraph(doc, `Objetivo: ${nbr.purpose}`, y)
    y = addParagraph(
      doc,
      `${nbr.specificationGradeLabel} — tolerância máxima de ±${nbr.maxDeviationPercent}%`,
      y
    )
    y = addParagraph(
      doc,
      `Método principal: ${nbr.primaryMethod.name}. ${nbr.primaryMethod.justification}`,
      y
    )
    if (nbr.homogenizedComparables.length > 0) {
      y = addParagraph(doc, 'Comparáveis homogeneizados:', y, { bold: true })
      for (const item of nbr.homogenizedComparables) {
        const factors = item.factors
          .map((f) => `${f.label} ×${f.value.toFixed(3)}`)
          .join('; ')
        y = addParagraph(
          doc,
          `${item.title} — ${item.declaredPrice}${item.homogenizedUnitPriceSqm != null ? ` → ${formatCurrency(item.homogenizedUnitPriceSqm)}/m²` : ''}. Fatores: ${factors}`,
          y
        )
      }
    }
    y = addParagraph(doc, 'Memória de cálculo:', y, { bold: true })
    y = addBulletList(doc, nbr.calculationMemory.steps, y)
    y = addParagraph(
      doc,
      `Valor de mercado (NBR 14653): ${formatCurrency(nbr.calculationMemory.finalValue)} (${formatCurrency(nbr.calculationMemory.valuePerSqm)}/m²)`,
      y,
      { bold: true }
    )
    y = addParagraph(doc, 'Limitações:', y, { bold: true })
    y = addBulletList(doc, nbr.limitations, y)
    y = addParagraph(doc, nbr.disclaimer, y)
  }

  y = addSectionTitle(doc, 'Pontuação por critério', y)
  for (const criterion of result.criteriaScores) {
    y = addParagraph(doc, `${criterion.label}: ${criterion.score}/5`, y)
  }

  y = addSectionTitle(doc, 'Insights da avaliação', y)
  y = addBulletList(doc, result.aiInsights, y)

  if (result.photoPreviews.length > 0) {
    await addPhotos(doc, result.photoPreviews, y)
  }

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Avalia Imobe — Página ${i} de ${pageCount}`,
      PAGE_WIDTH / 2,
      290,
      { align: 'center' }
    )
  }

  const addressSlug = property.address
    .slice(0, 30)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const dateSlug = result.evaluatedAt.toISOString().slice(0, 10)
  doc.save(`avalia-imob-${addressSlug || 'imovel'}-${dateSlug}.pdf`)
}
