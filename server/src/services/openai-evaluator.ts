import { z } from 'zod'
import { config } from '../config.js'
import type {
  EvaluationAIDraftResponse,
  EvaluationRequest,
  PhotoInput,
} from '../types/evaluation.js'
import type { SerperResult } from './serper.js'
import { buildFeedbackLearningPrompt } from './evaluation-feedback-service.js'
import { getBuildingAgeLabel } from '../constants/building-age.js'

const aiResponseSchema = z.object({
  estimatedValue: z.number(),
  valuePerSqm: z.number(),
  score: z.number().min(0).max(100),
  scoreLabel: z.string(),
  criteriaScores: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      score: z.number().min(1).max(5),
      weight: z.number(),
    })
  ),
  aiInsights: z.array(z.string()).min(1),
  marketAnalysis: z.object({
    averagePricePerSqm: z.number().nullable(),
    priceRange: z
      .object({
        min: z.number(),
        max: z.number(),
      })
      .nullable(),
    comparables: z.array(
      z.object({
        title: z.string(),
        price: z.string(),
        area: z
          .string()
          .nullish()
          .transform((value) => value ?? undefined),
        source: z.string(),
        link: z
          .string()
          .nullish()
          .transform((value) => value ?? undefined),
      })
    ),
    summary: z.string(),
  }),
  masterPlanAnalysis: z.object({
    zoning: z.string(),
    allowedUses: z.array(z.string()),
    restrictions: z.array(z.string()),
    developmentPotential: z.string(),
    summary: z.string(),
  }),
  nbr14653: z.object({
    purpose: z.string(),
    primaryMethod: z.object({
      id: z.string(),
      name: z.string(),
      justification: z.string(),
    }),
    complementaryMethods: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          justification: z.string(),
          estimatedValue: z.number().nullable().optional(),
        })
      )
      .default([]),
    homogenizedComparables: z
      .array(
        z.object({
          title: z.string(),
          source: z.string(),
          link: z.string().optional(),
          declaredPrice: z.string(),
          area: z.string().optional(),
          areaSqm: z.number().nullable().optional(),
          unitPriceSqm: z.number().nullable().optional(),
          factors: z.array(
            z.object({
              id: z.string(),
              label: z.string(),
              value: z.number().min(0.5).max(1.5),
              justification: z.string(),
            })
          ),
          homogenizedUnitPriceSqm: z.number().nullable(),
          weight: z.number().min(0).max(1),
        })
      )
      .min(1),
    calculationMemory: z.object({
      steps: z.array(z.string()).min(3),
      homogenizedAveragePriceSqm: z.number().nullable(),
      adjustmentsApplied: z.array(z.string()),
      finalValue: z.number(),
      valuePerSqm: z.number(),
    }),
    limitations: z.array(z.string()).min(1),
    disclaimer: z.string(),
  }),
})

function formatSerperResults(results: SerperResult[]) {
  if (results.length === 0) {
    return 'Nenhum resultado encontrado na pesquisa.'
  }

  return results
    .map(
      (r, i) =>
        `${i + 1}. ${r.title}\n   URL: ${r.link}\n   Resumo: ${r.snippet}`
    )
    .join('\n\n')
}

const STANDARD_LEVEL_LABELS: Record<string, string> = {
  padrao: 'Padrão',
  'alto-padrao': 'Alto padrão',
  luxo: 'Luxo',
}

const FURNISHING_LABELS: Record<string, string> = {
  sem: 'Sem mobília',
  semi: 'Semi-mobiliado',
  completo: 'Totalmente mobiliado',
}

const FINISH_LEVEL_LABELS: Record<string, string> = {
  basico: 'Básico',
  padrao: 'Padrão',
  'alto-padrao': 'Alto padrão',
  luxo: 'Luxo',
}

const CONDOMINIUM_LEVEL_LABELS: Record<string, string> = {
  'nao-aplica': 'Não se aplica',
  padrao: 'Padrão',
  'alto-padrao': 'Alto padrão',
  clube: 'Clube / resort',
}

const VIEW_TYPE_LABELS: Record<string, string> = {
  nenhuma: 'Sem vista privilegiada',
  cidade: 'Vista para a cidade',
  mar: 'Vista para o mar',
  montanha: 'Vista para montanhas',
  parque: 'Vista para parque / área verde',
  lago: 'Vista para lago / represa',
}

const AMENITY_LABELS: Record<string, string> = {
  'ar-condicionado': 'Ar condicionado',
  piscina: 'Piscina',
  'varanda-terraco': 'Varanda / Terraço',
  'vista-privilegiada': 'Vista privilegiada',
  'portaria-24h': 'Portaria 24h',
  seguranca: 'Segurança reforçada',
  academia: 'Academia / fitness',
  'area-lazer': 'Área de lazer',
  automacao: 'Automação / casa inteligente',
  elevador: 'Elevador',
  'suite-master': 'Suíte master',
  closet: 'Closet',
  'cozinha-planejada': 'Cozinha planejada',
  churrasqueira: 'Churrasqueira',
  jardim: 'Jardim privativo',
  'garagem-coberta': 'Garagem coberta',
  hidromassagem: 'Hidromassagem / spa',
  'piso-importado': 'Piso de alto padrão',
}

function formatAmenities(amenities: string[] | undefined) {
  if (!amenities?.length) return 'nenhum informado'
  return amenities.map((amenity) => AMENITY_LABELS[amenity] ?? amenity).join(', ')
}

function buildImageContent(photos: PhotoInput[]) {
  return photos.slice(0, 5).map((photo) => ({
    type: 'image_url' as const,
    image_url: {
      url: `data:${photo.mimeType};base64,${photo.data}`,
      detail: 'low' as const,
    },
  }))
}

export async function evaluateWithOpenAI(
  input: EvaluationRequest,
  marketResults: SerperResult[],
  masterPlanResults: SerperResult[]
): Promise<EvaluationAIDraftResponse> {
  if (!config.openaiApiKey) {
    throw new Error(
      'OPENAI_API_KEY não configurada. Adicione a chave no arquivo server/.env'
    )
  }

  const propertyBlock = `
Dados do imóvel:
- CEP: ${input.cep || 'não informado'}
- Endereço: ${input.address}
- Tipo: ${input.propertyType}
- Área útil/construída: ${input.area} m²
- Metragem do terreno: ${input.lotArea ? `${input.lotArea} m²` : 'não informada'}
- Quartos: ${input.bedrooms}
- Banheiros: ${input.bathrooms}
- Vagas: ${input.parking}
- Idade da construção: ${getBuildingAgeLabel(input.buildingAge)}
- Conservação: ${input.conservation}
- Padrão do imóvel: ${STANDARD_LEVEL_LABELS[input.standardLevel] ?? input.standardLevel}
- Mobília: ${FURNISHING_LABELS[input.furnishing] ?? input.furnishing}
- Acabamento: ${FINISH_LEVEL_LABELS[input.finishLevel] ?? input.finishLevel}
- Condomínio: ${CONDOMINIUM_LEVEL_LABELS[input.condominiumLevel] ?? input.condominiumLevel}
- Vista: ${input.viewType ? (VIEW_TYPE_LABELS[input.viewType] ?? input.viewType) : 'não informada'}
- Diferenciais: ${formatAmenities(input.amenities)}
- Valor pedido: ${input.askingPrice ? `R$ ${input.askingPrice}` : 'não informado'}
- Observações: ${input.notes || 'nenhuma'}
`

  const feedbackLearning = await buildFeedbackLearningPrompt()

  const systemPrompt = `Você é um avaliador imobiliário especialista no mercado brasileiro, com rigor técnico conforme ABNT NBR 14653-1 e NBR 14653-2 (imóveis urbanos).

METODOLOGIA OBRIGATÓRIA (NBR 14653):
1. Objetivo: determinação do valor de mercado do imóvel avaliando.
2. Método principal: Comparativo Direto de Dados de Mercado (preferencial conforme norma).
3. Selecione de 3 a 6 imóveis comparáveis reais da pesquisa Serper.
4. Para cada comparável, aplique fatores de homogeneização (multiplicadores entre 0,50 e 1,50) para: localização, área, conservação, padrão, idade, layout, vagas, condomínio, vista e mercado.
5. Calcule o valor unitário homogeneizado de cada comparável: (preço ÷ área) × produto dos fatores.
6. Obtenha média ponderada dos valores unitários homogeneizados (pesos somando 1,0).
7. Valor final = média unitária homogeneizada × área do imóvel avaliando.
8. Métodos complementares (renda ou evolutivo): inclua somente se aplicável, com justificativa técnica.
9. Registre memória de cálculo passo a passo e limitações da amostra.

Analise também o Plano Diretor/zoneamento urbano.
Estime pontuações de critérios (1 a 5). Considere padrão, acabamento, mobília, condomínio, vista e amenidades.
Responda APENAS com JSON válido, sem markdown, seguindo exatamente esta estrutura:
{
  "estimatedValue": number,
  "valuePerSqm": number,
  "score": number (0-100),
  "scoreLabel": "Excelente" | "Bom" | "Médio" | "Regular",
  "criteriaScores": [
    { "id": "location", "label": "Localização", "score": number, "weight": 0.25 },
    { "id": "infrastructure", "label": "Infraestrutura", "score": number, "weight": 0.15 },
    { "id": "condition", "label": "Conservação", "score": number, "weight": 0.20 },
    { "id": "layout", "label": "Layout", "score": number, "weight": 0.15 },
    { "id": "market", "label": "Mercado", "score": number, "weight": 0.15 },
    { "id": "documentation", "label": "Documentação", "score": number, "weight": 0.10 }
  ],
  "aiInsights": ["string"],
  "marketAnalysis": {
    "averagePricePerSqm": number | null,
    "priceRange": { "min": number, "max": number } | null,
    "comparables": [{ "title": "string", "price": "string", "area": "string?", "source": "string", "link": "string?" }],
    "summary": "string"
  },
  "masterPlanAnalysis": {
    "zoning": "string",
    "allowedUses": ["string"],
    "restrictions": ["string"],
    "developmentPotential": "string",
    "summary": "string"
  },
  "nbr14653": {
    "purpose": "Determinação do valor de mercado conforme NBR 14653",
    "primaryMethod": {
      "id": "comparativo_direto",
      "name": "Método Comparativo Direto de Dados de Mercado",
      "justification": "string — por que este método foi adotado"
    },
    "complementaryMethods": [
      {
        "id": "renda|evolutivo|custo",
        "name": "string",
        "justification": "string",
        "estimatedValue": number | null
      }
    ],
    "homogenizedComparables": [
      {
        "title": "string",
        "source": "string",
        "link": "string?",
        "declaredPrice": "R$ ...",
        "area": "string?",
        "areaSqm": number,
        "unitPriceSqm": number,
        "factors": [
          { "id": "location|area|conservation|standard|age|layout|parking|condominium|view|market", "label": "string", "value": 0.95, "justification": "string" }
        ],
        "homogenizedUnitPriceSqm": number,
        "weight": 0.25
      }
    ],
    "calculationMemory": {
      "steps": ["string — passos da memória de cálculo"],
      "homogenizedAveragePriceSqm": number,
      "adjustmentsApplied": ["string — fatores aplicados"],
      "finalValue": number,
      "valuePerSqm": number
    },
    "limitations": ["string"],
    "disclaimer": "string — ressalva sobre laudo formal"
  }
}

Os campos estimatedValue e valuePerSqm DEVEM ser consistentes com nbr14653.calculationMemory.
Use os resultados Serper para comparáveis reais. Valores em reais (BRL). Textos em português do Brasil.${feedbackLearning}`

  const userText = `${propertyBlock}

--- PESQUISA DE MERCADO (imobiliárias locais via Serper) ---
${formatSerperResults(marketResults)}

--- PLANO DIRETOR / ZONEAMENTO (via Serper) ---
${formatSerperResults(masterPlanResults)}

${input.photos?.length ? `Foram enviadas ${input.photos.length} foto(s) do imóvel para análise visual.` : 'Nenhuma foto enviada.'}

Gere a avaliação completa.`

  const userContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail: 'low' | 'high' } }
  > = [{ type: 'text', text: userText }]

  if (input.photos?.length) {
    userContent.push(...buildImageContent(input.photos))
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.openaiModel,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI API error: ${response.status} ${text}`)
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[]
  }

  const content = data.choices[0]?.message?.content
  if (!content) {
    throw new Error('OpenAI retornou resposta vazia.')
  }

  const parsed = aiResponseSchema.parse(JSON.parse(content))
  return parsed
}
