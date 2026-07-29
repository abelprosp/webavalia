import { z } from 'zod'
import { config } from '../config.js'
import type { LeadScore } from '../types/crm.js'

const leadScoreSchema = z.object({
  probability: z.number().min(0).max(100),
  urgency: z.enum(['baixa', 'media', 'alta']),
  expectedTicket: z.number().min(0),
  interest: z.string().min(1),
  summary: z.string().min(1),
  tags: z.array(z.string()).default([]),
})

type ScoreInput = {
  name?: string | null
  phone?: string | null
  propertyType?: string | null
  interest?: string | null
  budget?: string | null
  location?: string | null
  listingIntent?: string | null
  estimatedValue?: number | null
  evaluationScore?: number | null
}

function heuristicLeadScore(input: ScoreInput): LeadScore {
  let probability = 45
  if (input.estimatedValue && input.estimatedValue > 500_000) probability += 15
  if (input.evaluationScore && input.evaluationScore >= 70) probability += 10
  if (input.interest?.toLowerCase().includes('vender')) probability += 8
  if (input.interest?.toLowerCase().includes('alugar')) probability += 5
  if (input.budget && input.budget !== '—') probability += 7

  const urgency =
    input.interest?.toLowerCase().includes('urgente') ||
    input.interest?.toLowerCase().includes('rápido')
      ? 'alta'
      : input.estimatedValue && input.estimatedValue > 800_000
        ? 'media'
        : 'baixa'

  const expectedTicket = input.estimatedValue ?? 350_000

  const tags = [
    input.listingIntent === 'alugar' ? 'Locação' : 'Venda',
    input.propertyType ? input.propertyType : null,
    urgency === 'alta' ? 'Urgente' : null,
    expectedTicket > 700_000 ? 'Alto ticket' : 'Ticket médio',
  ].filter(Boolean) as string[]

  return {
    probability: Math.min(95, probability),
    urgency,
    expectedTicket,
    interest: input.interest ?? 'Interesse em avaliação imobiliária',
    summary: 'Score estimado com base nos dados disponíveis do lead.',
    tags,
    scoredAt: new Date().toISOString(),
  }
}

export async function scoreLeadWithAI(input: ScoreInput): Promise<LeadScore> {
  if (!config.openaiApiKey) {
    return heuristicLeadScore(input)
  }

  const prompt = `Analise este lead imobiliário e retorne JSON com scoring comercial.

Lead:
- Nome: ${input.name ?? 'Não informado'}
- Tipo imóvel: ${input.propertyType ?? 'Não informado'}
- Interesse: ${input.interest ?? 'Não informado'}
- Orçamento/valor: ${input.budget ?? 'Não informado'}
- Localização: ${input.location ?? 'Não informado'}
- Intent: ${input.listingIntent ?? 'vender'}
- Valor estimado avaliação: ${input.estimatedValue ?? 'N/A'}
- Score avaliação imóvel: ${input.evaluationScore ?? 'N/A'}

Retorne APENAS JSON:
{
  "probability": number (0-100, probabilidade de fechamento),
  "urgency": "baixa" | "media" | "alta",
  "expectedTicket": number (valor esperado em BRL),
  "interest": string (resumo do interesse),
  "summary": string (1 frase sobre o potencial),
  "tags": string[] (3-5 tags inteligentes em português)
}`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.openaiModel,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Você é especialista em qualificação de leads imobiliários no Brasil. Responda somente JSON válido.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    })

    if (!response.ok) {
      return heuristicLeadScore(input)
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content
    if (!content) return heuristicLeadScore(input)

    const parsed = leadScoreSchema.safeParse(JSON.parse(content))
    if (!parsed.success) return heuristicLeadScore(input)

    return {
      ...parsed.data,
      scoredAt: new Date().toISOString(),
    }
  } catch {
    return heuristicLeadScore(input)
  }
}
