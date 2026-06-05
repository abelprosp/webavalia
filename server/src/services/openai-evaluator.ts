import { z } from 'zod'
import { config } from '../config.js'
import type {
  EvaluationAIResponse,
  EvaluationRequest,
  PhotoInput,
} from '../types/evaluation.js'
import type { SerperResult } from './serper.js'

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
        area: z.string().optional(),
        source: z.string(),
        link: z.string().optional(),
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
): Promise<EvaluationAIResponse> {
  if (!config.openaiApiKey) {
    throw new Error(
      'OPENAI_API_KEY não configurada. Adicione a chave no arquivo server/.env'
    )
  }

  const criteriaBlock = `
Critérios avaliados pelo corretor (1 a 5):
- Localização: ${input.location}
- Infraestrutura do bairro: ${input.infrastructure}
- Estado de conservação: ${input.condition}
- Layout e funcionalidade: ${input.layout}
- Potencial de mercado: ${input.market}
- Documentação: ${input.documentation}
`

  const propertyBlock = `
Dados do imóvel:
- Endereço: ${input.address}
- Tipo: ${input.propertyType}
- Área: ${input.area} m²
- Quartos: ${input.bedrooms}
- Banheiros: ${input.bathrooms}
- Vagas: ${input.parking}
- Ano de construção: ${input.yearBuilt}
- Conservação: ${input.conservation}
- Valor pedido: ${input.askingPrice ? `R$ ${input.askingPrice}` : 'não informado'}
- Observações: ${input.notes || 'nenhuma'}
`

  const systemPrompt = `Você é um avaliador imobiliário especialista no mercado brasileiro.
Analise o imóvel com base nos dados informados, nos resultados de pesquisa de mercado (imobiliárias locais) e no Plano Diretor/zoneamento urbano.
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
  }
}

Use os resultados Serper para estimar média de preço/m² e listar comparáveis reais.
Para o Plano Diretor, analise zoneamento, usos permitidos, restrições e potencial de valorização/desenvolvimento.
Se faltar informação oficial, indique incerteza no texto mas faça a melhor análise possível com os snippets.
Valores em reais (BRL). Textos em português do Brasil.`

  const userText = `${propertyBlock}

${criteriaBlock}

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
