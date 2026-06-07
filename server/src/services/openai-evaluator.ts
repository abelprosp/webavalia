import { z } from 'zod'
import { config } from '../config.js'
import type {
  EvaluationAIResponse,
  EvaluationRequest,
  PhotoInput,
} from '../types/evaluation.js'
import type { SerperResult } from './serper.js'
import { buildFeedbackLearningPrompt } from './evaluation-feedback-service.js'

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
): Promise<EvaluationAIResponse> {
  if (!config.openaiApiKey) {
    throw new Error(
      'OPENAI_API_KEY não configurada. Adicione a chave no arquivo server/.env'
    )
  }

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

  const systemPrompt = `Você é um avaliador imobiliário especialista no mercado brasileiro.
Analise o imóvel com base nos dados informados, nos resultados de pesquisa de mercado (imobiliárias locais) e no Plano Diretor/zoneamento urbano.
Estime você mesmo as pontuações de cada critério (1 a 5) com base nas informações disponíveis.
Considere com peso significativo: padrão do imóvel (alto padrão/luxo), nível de acabamento, mobília, condomínio, vista, diferenciais e amenidades — estes fatores devem impactar valor estimado, preço/m² e comparáveis selecionados.
Para imóveis de alto padrão ou luxo, busque comparáveis equivalentes e aplique prêmio de valorização sobre a média de mercado quando justificado.
Mobília completa ou semi-mobiliada deve ser considerada no valor final quando relevante para o segmento.
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
Valores em reais (BRL). Textos em português do Brasil.${feedbackLearning}`

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
