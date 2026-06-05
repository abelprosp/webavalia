import { jsPDF } from 'jspdf'
import {
  conservationStates,
  propertyTypes,
} from '../data/criteria'
import {
  formatCurrency,
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
  const propertyLines = [
    `Endereço: ${property.address}`,
    `Tipo: ${getPropertyTypeLabel(property.propertyType)}`,
    `Área: ${property.area} m² · Quartos: ${property.bedrooms} · Banheiros: ${property.bathrooms} · Vagas: ${property.parking}`,
    `Ano: ${property.yearBuilt} · Conservação: ${getConservationLabel(property.conservation)}`,
    property.askingPrice
      ? `Valor pedido: ${formatCurrency(property.askingPrice)}`
      : 'Valor pedido: não informado',
  ]
  for (const line of propertyLines) {
    y = addParagraph(doc, line, y)
  }
  if (property.notes) {
    y = addParagraph(doc, `Observações: ${property.notes}`, y)
  }

  y = addSectionTitle(doc, 'Resultado da avaliação', y)
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

  y = addSectionTitle(doc, 'Pontuação por critério', y)
  for (const criterion of result.criteriaScores) {
    y = addParagraph(doc, `${criterion.label}: ${criterion.score}/5`, y)
  }

  y = addSectionTitle(doc, 'Insights da avaliação', y)
  y = addBulletList(doc, result.aiInsights, y)

  if (result.photoPreviews.length > 0) {
    y = await addPhotos(doc, result.photoPreviews, y)
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
