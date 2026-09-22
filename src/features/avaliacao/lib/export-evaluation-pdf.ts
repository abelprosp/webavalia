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

const PAGE_WIDTH = 210
const MARGIN = 16
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const FOOTER_Y = 285
const CONTENT_BOTTOM = 278
const LINE_HEIGHT = 5.2
const BRAND = 'Avalia Imobe'

/** Paleta alinhada ao design system Flux */
const C = {
  dark: [28, 29, 42] as const,
  darkSoft: [42, 44, 62] as const,
  lime: [197, 242, 66] as const,
  lavender: [196, 168, 232] as const,
  ink: [28, 29, 42] as const,
  body: [55, 58, 78] as const,
  muted: [120, 124, 148] as const,
  line: [228, 230, 238] as const,
  wash: [246, 247, 252] as const,
  white: [255, 255, 255] as const,
  cardBorder: [232, 234, 242] as const,
}

type ExportPdfInput = {
  result: EvaluationResult
  property: EvaluationFormValues
}

type PdfCtx = {
  doc: jsPDF
  y: number
  page: number
}

function rgb(c: readonly [number, number, number]) {
  return c
}

function getPropertyTypeLabel(value: string) {
  return propertyTypes.find((t) => t.value === value)?.label ?? value
}

function getConservationLabel(value: string) {
  return conservationStates.find((s) => s.value === value)?.label ?? value
}

function ensureSpace(ctx: PdfCtx, needed: number) {
  if (ctx.y + needed <= CONTENT_BOTTOM) return
  ctx.doc.addPage()
  ctx.page += 1
  drawPageChrome(ctx.doc)
  ctx.y = MARGIN + 10
}

function drawPageChrome(doc: jsPDF) {
  doc.setFillColor(...rgb(C.dark))
  doc.rect(0, 0, PAGE_WIDTH, 4, 'F')
  doc.setFillColor(...rgb(C.lime))
  doc.rect(0, 4, PAGE_WIDTH, 1.2, 'F')
}

function drawFooter(
  doc: jsPDF,
  page: number,
  total: number,
  dateLabel: string
) {
  doc.setDrawColor(...rgb(C.line))
  doc.setLineWidth(0.3)
  doc.line(MARGIN, FOOTER_Y - 4, PAGE_WIDTH - MARGIN, FOOTER_Y - 4)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...rgb(C.muted))
  doc.text(`${BRAND} · Relatório de avaliação`, MARGIN, FOOTER_Y)
  doc.text(dateLabel, PAGE_WIDTH / 2, FOOTER_Y, { align: 'center' })
  doc.text(`${page} / ${total}`, PAGE_WIDTH - MARGIN, FOOTER_Y, {
    align: 'right',
  })
}

function addSectionTitle(ctx: PdfCtx, title: string) {
  ensureSpace(ctx, 16)
  const { doc } = ctx

  doc.setFillColor(...rgb(C.lime))
  doc.roundedRect(MARGIN, ctx.y - 2.5, 2.2, 8, 0.6, 0.6, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...rgb(C.ink))
  doc.text(title, MARGIN + 6, ctx.y + 3)

  ctx.y += 12
}

function addParagraph(
  ctx: PdfCtx,
  text: string,
  options?: {
    bold?: boolean
    fontSize?: number
    color?: readonly [number, number, number]
    indent?: number
  }
) {
  const { doc } = ctx
  const fontSize = options?.fontSize ?? 9.5
  const indent = options?.indent ?? 0
  const width = CONTENT_WIDTH - indent

  doc.setFont('helvetica', options?.bold ? 'bold' : 'normal')
  doc.setFontSize(fontSize)
  doc.setTextColor(...rgb(options?.color ?? C.body))

  const lines: string[] = doc.splitTextToSize(text, width)
  const blockHeight = lines.length * LINE_HEIGHT
  ensureSpace(ctx, blockHeight + 2)

  doc.text(lines, MARGIN + indent, ctx.y)
  ctx.y += blockHeight + 3
}

function addBulletList(ctx: PdfCtx, items: string[]) {
  const { doc } = ctx
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)

  for (const item of items) {
    const lines: string[] = doc.splitTextToSize(item, CONTENT_WIDTH - 8)
    const blockHeight = lines.length * LINE_HEIGHT
    ensureSpace(ctx, blockHeight + 2)

    doc.setFillColor(...rgb(C.lavender))
    doc.circle(MARGIN + 2.5, ctx.y - 1.2, 1.1, 'F')

    doc.setTextColor(...rgb(C.body))
    doc.text(lines, MARGIN + 7, ctx.y)
    ctx.y += blockHeight + 2.5
  }

  ctx.y += 1
}

function addKeyValueGrid(
  ctx: PdfCtx,
  pairs: Array<{ label: string; value: string }>
) {
  const colGap = 4
  const colWidth = (CONTENT_WIDTH - colGap) / 2
  const rowH = 11
  let col = 0
  let rowY = ctx.y

  for (const pair of pairs) {
    if (col === 0) ensureSpace(ctx, rowH + 2)

    const x = MARGIN + col * (colWidth + colGap)
    const { doc } = ctx

    doc.setFillColor(...rgb(C.wash))
    doc.roundedRect(x, rowY - 3.5, colWidth, rowH, 1.5, 1.5, 'F')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...rgb(C.muted))
    doc.text(pair.label.toUpperCase(), x + 3, rowY)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...rgb(C.ink))
    const valueLines: string[] = doc.splitTextToSize(pair.value, colWidth - 6)
    doc.text(valueLines[0] ?? '—', x + 3, rowY + 4.5)

    col += 1
    if (col === 2) {
      col = 0
      rowY += rowH + 2.5
      ctx.y = rowY
    }
  }

  if (col === 1) {
    ctx.y = rowY + rowH + 2.5
  } else {
    ctx.y = rowY + 2
  }
}

function addMetricCards(
  ctx: PdfCtx,
  cards: Array<{
    label: string
    value: string
    hint?: string
    accent?: 'lime' | 'lavender' | 'dark'
  }>
) {
  const gap = 3.5
  const n = cards.length
  const cardW = (CONTENT_WIDTH - gap * (n - 1)) / n
  const cardH = 28
  ensureSpace(ctx, cardH + 6)

  cards.forEach((card, i) => {
    const x = MARGIN + i * (cardW + gap)
    const { doc } = ctx
    const isDark = card.accent === 'dark'
    const isLavender = card.accent === 'lavender'

    if (isDark) {
      doc.setFillColor(...rgb(C.dark))
    } else if (isLavender) {
      doc.setFillColor(...rgb(C.lavender))
    } else {
      doc.setFillColor(...rgb(C.lime))
    }
    doc.roundedRect(x, ctx.y, cardW, cardH, 2.5, 2.5, 'F')

    const labelColor = isDark ? ([180, 185, 210] as const) : C.darkSoft
    const valueColor = isDark ? C.white : C.ink
    const hintColor = isDark ? ([160, 165, 190] as const) : C.body

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...rgb(labelColor))
    doc.text(card.label.toUpperCase(), x + 4, ctx.y + 7)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(card.value.length > 16 ? 11 : 13)
    doc.setTextColor(...rgb(valueColor))
    const valueLines: string[] = doc.splitTextToSize(card.value, cardW - 8)
    doc.text(valueLines[0] ?? '', x + 4, ctx.y + 15)

    if (card.hint) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...rgb(hintColor))
      const hintLines: string[] = doc.splitTextToSize(card.hint, cardW - 8)
      doc.text(hintLines[0] ?? '', x + 4, ctx.y + 22)
    }
  })

  ctx.y += cardH + 8
}

function addScenarioCards(
  ctx: PdfCtx,
  scenarios: ReturnType<typeof getSaleScenarios>
) {
  for (const scenario of scenarios) {
    const cardH = 22
    ensureSpace(ctx, cardH + 4)
    const { doc } = ctx

    doc.setFillColor(...rgb(C.wash))
    doc.setDrawColor(...rgb(C.cardBorder))
    doc.setLineWidth(0.3)
    doc.roundedRect(MARGIN, ctx.y, CONTENT_WIDTH, cardH, 2, 2, 'FD')

    doc.setFillColor(...rgb(C.dark))
    doc.roundedRect(MARGIN, ctx.y, 2.5, cardH, 1, 1, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...rgb(C.ink))
    doc.text(scenario.label, MARGIN + 7, ctx.y + 7)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...rgb(C.muted))
    doc.text(scenario.timeframe, MARGIN + 7, ctx.y + 12.5)

    const adjustmentLabel =
      scenario.adjustmentPercent === 0
        ? 'valor de mercado'
        : `${scenario.adjustmentPercent > 0 ? '+' : ''}${scenario.adjustmentPercent}% vs. estimado`

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...rgb(C.ink))
    doc.text(
      formatCurrency(scenario.value),
      PAGE_WIDTH - MARGIN - 4,
      ctx.y + 8,
      {
        align: 'right',
      }
    )

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...rgb(C.muted))
    doc.text(
      `${formatCurrency(scenario.valuePerSqm)}/m² · ${adjustmentLabel}`,
      PAGE_WIDTH - MARGIN - 4,
      ctx.y + 14,
      { align: 'right' }
    )

    ctx.y += cardH + 3

    addParagraph(ctx, scenario.description, {
      fontSize: 8.5,
      color: C.muted,
      indent: 2,
    })
  }
}

function addScoreBars(ctx: PdfCtx, scores: EvaluationResult['criteriaScores']) {
  for (const criterion of scores) {
    ensureSpace(ctx, 10)
    const { doc } = ctx
    const barX = MARGIN + 52
    const barW = CONTENT_WIDTH - 52 - 18
    const pct = Math.max(0, Math.min(1, criterion.score / 5))

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...rgb(C.body))
    doc.text(criterion.label, MARGIN, ctx.y)

    doc.setFillColor(...rgb(C.line))
    doc.roundedRect(barX, ctx.y - 2.8, barW, 4, 1.2, 1.2, 'F')

    if (pct > 0) {
      doc.setFillColor(...rgb(C.lavender))
      doc.roundedRect(
        barX,
        ctx.y - 2.8,
        Math.max(2, barW * pct),
        4,
        1.2,
        1.2,
        'F'
      )
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...rgb(C.ink))
    doc.text(`${criterion.score}/5`, PAGE_WIDTH - MARGIN, ctx.y, {
      align: 'right',
    })

    ctx.y += 8
  }
  ctx.y += 2
}

async function addPhotos(ctx: PdfCtx, previews: string[]): Promise<void> {
  if (previews.length === 0) return

  addSectionTitle(ctx, `Fotos do imóvel (${previews.length})`)

  const gap = 3.5
  const cols = 3
  const imageSize = (CONTENT_WIDTH - gap * (cols - 1)) / cols
  let col = 0

  for (let i = 0; i < Math.min(previews.length, 9); i++) {
    try {
      const response = await fetch(previews[i])
      const blob = await response.blob()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      if (col === 0) ensureSpace(ctx, imageSize + 6)

      const x = MARGIN + col * (imageSize + gap)
      const { doc } = ctx
      const format = dataUrl.includes('image/png') ? 'PNG' : 'JPEG'

      doc.setFillColor(...rgb(C.line))
      doc.roundedRect(
        x - 0.6,
        ctx.y - 0.6,
        imageSize + 1.2,
        imageSize + 1.2,
        1.5,
        1.5,
        'F'
      )
      doc.addImage(dataUrl, format, x, ctx.y, imageSize, imageSize)

      col += 1
      if (col === cols) {
        col = 0
        ctx.y += imageSize + gap + 2
      }
    } catch {
      // ignora foto que não puder ser carregada
    }
  }

  if (col > 0) ctx.y += imageSize + gap + 2
}

function drawCoverHeader(
  ctx: PdfCtx,
  property: EvaluationFormValues,
  dateLabel: string
) {
  const { doc } = ctx
  const headerH = 42

  doc.setFillColor(...rgb(C.dark))
  doc.rect(0, 0, PAGE_WIDTH, headerH, 'F')

  doc.setFillColor(...rgb(C.lime))
  doc.rect(0, headerH, PAGE_WIDTH, 2.5, 'F')

  // accent blob
  doc.setFillColor(...rgb(C.lavender))
  doc.circle(PAGE_WIDTH - 18, 12, 18, 'F')
  doc.setFillColor(...rgb(C.lime))
  doc.circle(PAGE_WIDTH - 8, 32, 10, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...rgb(C.lime))
  doc.text(BRAND, MARGIN, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(200, 205, 220)
  doc.text('Relatório de Avaliação de Imóvel', MARGIN, 23)

  doc.setFontSize(8)
  doc.setTextColor(160, 165, 185)
  doc.text(dateLabel, MARGIN, 30)

  const address = property.address || 'Endereço não informado'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...rgb(C.white))
  const addrLines: string[] = doc.splitTextToSize(address, CONTENT_WIDTH - 40)
  doc.text(addrLines[0] ?? '', MARGIN, 37)

  ctx.y = headerH + 12
}

export async function exportEvaluationPdf({
  result,
  property,
}: ExportPdfInput) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const dateLabel = result.evaluatedAt.toLocaleString('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
  })
  const ctx: PdfCtx = { doc, y: MARGIN, page: 1 }

  drawCoverHeader(ctx, property, `Gerado em ${dateLabel}`)

  const listingIntent = property.listingIntent ?? 'vender'
  const landOnly = isLandOnlyPropertyType(property.propertyType)

  // —— Resultado principal ——
  addSectionTitle(ctx, 'Resultado da avaliação')
  addParagraph(ctx, `Objetivo: ${getListingIntentLabel(listingIntent)}`, {
    fontSize: 9,
    color: C.muted,
  })

  if (listingIntent === 'alugar') {
    const rental = estimateMonthlyRent(result.estimatedValue, property)
    addMetricCards(ctx, [
      {
        label: 'Aluguel estimado',
        value: `${formatCurrency(rental.monthlyRent)}/mês`,
        hint: `${formatCurrency(rental.rentPerSqm)}/m²`,
        accent: 'lime',
      },
      {
        label: 'Ref. de venda',
        value: formatCurrency(result.estimatedValue),
        hint: `${formatCurrency(result.valuePerSqm)}/m²`,
        accent: 'lavender',
      },
      {
        label: 'Score',
        value: `${result.score}/100`,
        hint: result.scoreLabel,
        accent: 'dark',
      },
    ])
  } else {
    addMetricCards(ctx, [
      {
        label: 'Valor estimado',
        value: formatCurrency(result.estimatedValue),
        hint: `${formatCurrency(result.valuePerSqm)}/m²`,
        accent: 'lime',
      },
      {
        label: 'Score',
        value: `${result.score}/100`,
        hint: result.scoreLabel,
        accent: 'dark',
      },
      ...(result.marketAnalysis.averagePricePerSqm != null
        ? [
            {
              label: 'Média de mercado',
              value: `${formatCurrency(result.marketAnalysis.averagePricePerSqm)}/m²`,
              hint: 'preço médio/m²',
              accent: 'lavender' as const,
            },
          ]
        : [
            {
              label: 'Tipo',
              value: getPropertyTypeLabel(property.propertyType),
              hint: landOnly
                ? `${property.area} m² terreno`
                : `${property.area} m²`,
              accent: 'lavender' as const,
            },
          ]),
    ])

    const saleScenarios = getSaleScenarios(result, property.area)
    addSectionTitle(ctx, 'Cenários de venda')
    addParagraph(
      ctx,
      'Faixas de preço conforme o tempo esperado para vender, com base no valor estimado de mercado.',
      { fontSize: 8.5, color: C.muted }
    )
    addScenarioCards(ctx, saleScenarios)
  }

  if (
    listingIntent === 'alugar' &&
    result.marketAnalysis.averagePricePerSqm != null
  ) {
    addParagraph(
      ctx,
      `Média de mercado: ${formatCurrency(result.marketAnalysis.averagePricePerSqm)}/m²`,
      { fontSize: 9 }
    )
  }

  // —— Dados do imóvel ——
  addSectionTitle(ctx, 'Dados do imóvel')
  const propertyPairs: Array<{ label: string; value: string }> = [
    ...(property.cep ? [{ label: 'CEP', value: property.cep }] : []),
    {
      label: 'Tipo',
      value: getPropertyTypeLabel(property.propertyType),
    },
    landOnly
      ? { label: 'Terreno', value: `${property.area} m²` }
      : { label: 'Área', value: `${property.area} m²` },
    ...(!landOnly
      ? [
          { label: 'Quartos', value: String(property.bedrooms) },
          { label: 'Banheiros', value: String(property.bathrooms) },
          { label: 'Vagas', value: String(property.parking) },
        ]
      : []),
    ...(property.floor != null
      ? [
          {
            label: 'Andar',
            value: property.floor === 0 ? 'Térreo' : `${property.floor}º`,
          },
        ]
      : []),
    ...(property.totalFloors != null
      ? [{ label: 'Andares do prédio', value: String(property.totalFloors) }]
      : []),
    ...(property.floor != null
      ? [
          {
            label: 'Elevador',
            value: property.elevatorAccess ?? 'não informado',
          },
        ]
      : []),
    ...(property.lotArea
      ? [{ label: 'Terreno', value: `${property.lotArea} m²` }]
      : []),
    ...(!landOnly
      ? [
          {
            label: 'Idade',
            value: getBuildingAgeLabel(property.buildingAge),
          },
        ]
      : []),
    {
      label: 'Conservação',
      value: getConservationLabel(property.conservation),
    },
    {
      label: 'Padrão',
      value: getStandardLevelLabel(property.standardLevel ?? 'padrao'),
    },
    {
      label: 'Mobília',
      value: getFurnishingLabel(property.furnishing ?? 'sem'),
    },
    {
      label: 'Acabamento',
      value: getFinishLevelLabel(property.finishLevel ?? 'padrao'),
    },
    {
      label: 'Condomínio',
      value: getCondominiumLevelLabel(
        property.condominiumLevel ?? 'nao-aplica'
      ),
    },
    {
      label: 'Vista',
      value: property.viewType
        ? getViewTypeLabel(property.viewType)
        : 'não informada',
    },
    {
      label: 'Valor pedido',
      value: property.askingPrice
        ? formatCurrency(property.askingPrice)
        : 'não informado',
    },
  ]
  addKeyValueGrid(ctx, propertyPairs)

  addParagraph(ctx, `Diferenciais: ${formatAmenities(property.amenities)}`, {
    fontSize: 9,
  })
  if (property.highEndFurnitureValue) {
    addParagraph(
      ctx,
      `Móveis alto padrão (valor estimado): ${formatCurrency(property.highEndFurnitureValue)}`,
      { fontSize: 9 }
    )
  }
  if (property.notes) {
    addParagraph(ctx, `Observações: ${property.notes}`, { fontSize: 9 })
  }

  // —— Mercado ——
  addSectionTitle(ctx, 'Análise de mercado local')
  addParagraph(ctx, result.marketAnalysis.summary)
  if (result.marketAnalysis.priceRange) {
    addParagraph(
      ctx,
      `Faixa de preços: ${formatCurrency(result.marketAnalysis.priceRange.min)} – ${formatCurrency(result.marketAnalysis.priceRange.max)}`
    )
  }
  if (result.marketAnalysis.comparables.length > 0) {
    addParagraph(ctx, 'Imóveis comparáveis', { bold: true, fontSize: 9 })
    for (const item of result.marketAnalysis.comparables) {
      addParagraph(
        ctx,
        `${item.title} — ${item.price}${item.area ? ` (${item.area})` : ''} · ${item.source}`,
        { fontSize: 8.5, indent: 2, color: C.body }
      )
    }
  }

  // —— Plano diretor ——
  addSectionTitle(ctx, 'Plano Diretor e zoneamento')
  addParagraph(ctx, `Zoneamento: ${result.masterPlanAnalysis.zoning}`, {
    bold: true,
  })
  addParagraph(ctx, 'Usos permitidos', { bold: true, fontSize: 9 })
  addBulletList(
    ctx,
    result.masterPlanAnalysis.allowedUses.length > 0
      ? result.masterPlanAnalysis.allowedUses
      : ['Informação não encontrada nas fontes consultadas']
  )
  addParagraph(ctx, 'Restrições', { bold: true, fontSize: 9 })
  addBulletList(
    ctx,
    result.masterPlanAnalysis.restrictions.length > 0
      ? result.masterPlanAnalysis.restrictions
      : ['Nenhuma restrição identificada nas fontes']
  )
  addParagraph(
    ctx,
    `Potencial de desenvolvimento: ${result.masterPlanAnalysis.developmentPotential}`
  )
  addParagraph(ctx, result.masterPlanAnalysis.summary)

  // —— Bairro ——
  if (result.neighborhoodAnalysis) {
    const n = result.neighborhoodAnalysis
    addSectionTitle(ctx, 'Pesquisa avançada do bairro')
    addParagraph(ctx, n.overview)
    if (n.infrastructure.length > 0) {
      addParagraph(ctx, 'Infraestrutura', { bold: true, fontSize: 9 })
      addBulletList(ctx, n.infrastructure)
    }
    if (n.services.length > 0) {
      addParagraph(ctx, 'Serviços', { bold: true, fontSize: 9 })
      addBulletList(ctx, n.services)
    }
    if (n.mobility.length > 0) {
      addParagraph(ctx, 'Mobilidade', { bold: true, fontSize: 9 })
      addBulletList(ctx, n.mobility)
    }
    addParagraph(ctx, `Segurança percebida: ${n.safetyPerception}`)
    addParagraph(ctx, `Qualidade de vida: ${n.qualityOfLife}`)
    if (n.highlights.length > 0) {
      addParagraph(ctx, 'Destaques', { bold: true, fontSize: 9 })
      addBulletList(ctx, n.highlights)
    }
    if (n.concerns.length > 0) {
      addParagraph(ctx, 'Pontos de atenção', { bold: true, fontSize: 9 })
      addBulletList(ctx, n.concerns)
    }
    addParagraph(ctx, n.summary)
  }

  // —— Valorização ——
  if (result.marketAppreciationAnalysis) {
    const a = result.marketAppreciationAnalysis
    addSectionTitle(ctx, 'Valorização e tendência de mercado')
    addParagraph(ctx, `Tendência: ${a.trendLabel}`, { bold: true })
    if (a.annualGrowthEstimatePercent != null) {
      addParagraph(
        ctx,
        `Crescimento estimado: ${a.annualGrowthEstimatePercent > 0 ? '+' : ''}${a.annualGrowthEstimatePercent}% ao ano`
      )
    }
    addParagraph(ctx, a.historicalContext)
    addParagraph(ctx, `Demanda: ${a.demandLevel}`)
    addParagraph(ctx, `Liquidez: ${a.liquidity}`)
    if (a.priceTrendFactors.length > 0) {
      addParagraph(ctx, 'Fatores de tendência', { bold: true, fontSize: 9 })
      addBulletList(ctx, a.priceTrendFactors)
    }
    addParagraph(ctx, `Projeção: ${a.projectionSummary}`)
    addParagraph(ctx, a.summary)
  }

  // —— NBR ——
  if (result.nbr14653) {
    const nbr = result.nbr14653
    addSectionTitle(ctx, 'Metodologia ABNT NBR 14653')
    addParagraph(ctx, nbr.standard)
    addParagraph(ctx, `Objetivo: ${nbr.purpose}`)
    if (nbr.sampleQuality) {
      const quality = nbr.sampleQuality
      addParagraph(
        ctx,
        `Amostra: ${quality.usedCount} comparáveis usados; ${quality.duplicatesRemoved} repetidos removidos; ${quality.excludedCount} excluídos.`
      )
      addParagraph(
        ctx,
        'Preços de oferta. Precisão e atualidade dos anúncios não certificadas.',
        { fontSize: 8.5, color: C.muted }
      )
      if (quality.observedValueRange && listingIntent !== 'alugar') {
        addParagraph(
          ctx,
          `Faixa observada para a área do imóvel: ${formatCurrency(quality.observedValueRange.min)} a ${formatCurrency(quality.observedValueRange.max)}. Não é intervalo de confiança.`
        )
      }
    }

    addParagraph(
      ctx,
      'Estimativa automatizada — grau e precisão não aferidos',
      {
        bold: true,
        fontSize: 9,
      }
    )
    addParagraph(
      ctx,
      `Método principal: ${nbr.primaryMethod.name}. ${nbr.primaryMethod.justification}`
    )
    if (nbr.homogenizedComparables.length > 0) {
      addParagraph(ctx, 'Comparáveis homogeneizados', {
        bold: true,
        fontSize: 9,
      })
      for (const item of nbr.homogenizedComparables) {
        const factors = item.factors
          .map((f) => `${f.label} ×${f.value.toFixed(3)}`)
          .join('; ')
        addParagraph(
          ctx,
          `${item.title} — ${item.declaredPrice}${item.homogenizedUnitPriceSqm != null ? ` → ${formatCurrency(item.homogenizedUnitPriceSqm)}/m²` : ''}. Fatores: ${factors}`,
          { fontSize: 8.5, indent: 2 }
        )
      }
    }
    addParagraph(ctx, 'Memória de cálculo', { bold: true, fontSize: 9 })
    addBulletList(ctx, nbr.calculationMemory.steps)
    addParagraph(
      ctx,
      `Valor de mercado (NBR 14653): ${formatCurrency(nbr.calculationMemory.finalValue)} (${formatCurrency(nbr.calculationMemory.valuePerSqm)}/m²)`,
      { bold: true }
    )
    addParagraph(ctx, 'Limitações', { bold: true, fontSize: 9 })
    addBulletList(ctx, nbr.limitations)
    addParagraph(ctx, nbr.disclaimer, { fontSize: 8.5, color: C.muted })
  }

  // —— Score ——
  addSectionTitle(ctx, 'Pontuação por critério')
  addScoreBars(ctx, result.criteriaScores)

  // —— Insights ——
  addSectionTitle(ctx, 'Insights da avaliação')
  addBulletList(ctx, result.aiInsights)

  if (result.photoPreviews.length > 0) {
    await addPhotos(ctx, result.photoPreviews)
  }

  const pageCount = doc.getNumberOfPages()
  const shortDate = result.evaluatedAt.toLocaleDateString('pt-BR')
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    if (i > 1) drawPageChrome(doc)
    drawFooter(doc, i, pageCount, shortDate)
  }

  const addressSlug = property.address
    .slice(0, 30)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const dateSlug = result.evaluatedAt.toISOString().slice(0, 10)
  doc.save(`avalia-imob-${addressSlug || 'imovel'}-${dateSlug}.pdf`)
}
