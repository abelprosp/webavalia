import { z } from 'zod'
import { config } from '../config.js'
import type {
  EvaluationAIDraftResponse,
  EvaluationRequest,
  PhotoInput,
} from '../types/evaluation.js'
import type { SerperResult } from './serper.js'
import { buildFeedbackLearningPrompt } from './evaluation-feedback-service.js'
import { isHighStandardProperty } from './nbr-14653-service.js'
import { getBuildingAgeLabel } from '../constants/building-age.js'
import { isLandOnlyPropertyType } from '../constants/evaluation-defaults.js'
import {
  extractCityFromAddress,
  extractNeighborhoodFromAddress,
} from '../utils/address-parsing.js'

const aiResponseSchema = z.object({
  estimatedValue: z.number(),
  valuePerSqm: z.number(),
  score: z.number().min(0).max(100),
  scoreLabel: z.string(),
  finishScore: z.number().min(0).max(100).optional(),
  conservationScore: z.number().min(0).max(100).optional(),
  locationScore: z.number().min(0).max(100).optional(),
  constructionScore: z.number().min(0).max(100).optional(),
  appreciationScore: z.number().min(0).max(100).optional(),
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
  neighborhoodAnalysis: z.object({
    overview: z.string(),
    infrastructure: z.array(z.string()),
    services: z.array(z.string()),
    mobility: z.array(z.string()),
    safetyPerception: z.string(),
    qualityOfLife: z.string(),
    highlights: z.array(z.string()),
    concerns: z.array(z.string()),
    summary: z.string(),
  }),
  marketAppreciationAnalysis: z.object({
    trend: z.enum(['valorizacao', 'estavel', 'desvalorizacao', 'indeterminado']),
    trendLabel: z.string(),
    annualGrowthEstimatePercent: z.number().nullable(),
    historicalContext: z.string(),
    demandLevel: z.string(),
    liquidity: z.string(),
    priceTrendFactors: z.array(z.string()),
    projectionSummary: z.string(),
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
  calefacao: 'Calefação',
  'placas-solares': 'Placas solares',
  'moveis-alto-padrao': 'Móveis alto padrão',
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

type EvaluationSearchResults = {
  marketResults: SerperResult[]
  masterPlanResults: SerperResult[]
  neighborhoodResults: SerperResult[]
  appreciationResults: SerperResult[]
}

export async function evaluateWithOpenAI(
  input: EvaluationRequest,
  searchResults: EvaluationSearchResults
): Promise<EvaluationAIDraftResponse> {
  const {
    marketResults,
    masterPlanResults,
    neighborhoodResults,
    appreciationResults,
  } = searchResults
  if (!config.openaiApiKey) {
    throw new Error(
      'OPENAI_API_KEY não configurada. Adicione a chave no arquivo server/.env'
    )
  }

  const isLand = isLandOnlyPropertyType(input.propertyType)
  const propertyNeighborhood = extractNeighborhoodFromAddress(input.address)
  const propertyCity = extractCityFromAddress(input.address)

  const locationRuleBlock = propertyNeighborhood
    ? `
REGRA CRÍTICA DE LOCALIZAÇÃO (OBRIGATÓRIA):
- Bairro do imóvel avaliando: ${propertyNeighborhood}${propertyCity ? ` (${propertyCity})` : ''}
- Use APENAS comparáveis do MESMO bairro (${propertyNeighborhood}).
- NUNCA inclua comparáveis de bairros diferentes na mesma cidade (ex.: Igrejinha quando o imóvel está em Moinhos).
- Se não houver comparáveis no mesmo bairro, informe essa limitação em nbr14653.limitations e reduza a amostra — NÃO substitua por bairros distintos sem aviso explícito.
${isLand ? '- TERRENO/LOTE: rejeite rigorosamente comparáveis de bairros distintos; preços de terreno variam drasticamente entre bairros.' : ''}
`
    : ''

  const propertyBlock = isLand
    ? `
Dados do terreno/lote:
- CEP: ${input.cep || 'não informado'}
- Endereço: ${input.address}
- Tipo: ${input.propertyType} (somente terreno — sem edificação)
- Área do terreno: ${input.area} m²
- Valor pedido: ${input.askingPrice ? `R$ ${input.askingPrice}` : 'não informado'}
- Observações: ${input.notes || 'nenhuma'}
`
    : `
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
- Andar: ${input.floor != null ? `${input.floor}º andar` : 'não informado'}
- Mezanino: ${input.hasMezzanine == null ? 'não informado' : input.hasMezzanine ? 'sim' : 'não'}
- Estrutura (pavilhão/galpão): ${
  input.structureType === 'alvenaria'
    ? 'Alvenaria'
    : input.structureType === 'pre-moldado'
      ? 'Pré-moldado'
      : 'não informada'
}
- Diferenciais: ${formatAmenities(input.amenities)}
- Valor estimado dos móveis alto padrão: ${input.highEndFurnitureValue ? `R$ ${input.highEndFurnitureValue.toLocaleString('pt-BR')}` : 'não informado'}
- Valor pedido / desejado pelo proprietário: ${input.askingPrice ? `R$ ${input.askingPrice}` : 'não informado'}
- Observações: ${input.notes || 'nenhuma'}
`

  const feedbackLearning = await buildFeedbackLearningPrompt()
  const useMedian = isHighStandardProperty(input) || isLand

  const landMethodologyBlock = isLand
    ? `
REGRAS ESPECÍFICAS PARA TERRENO/LOTE:
1. A área relevante é SEMPRE a área do terreno (${input.area} m²) — ignore área construída.
2. Busque comparáveis do mesmo tipo (terreno, lote, loteamento) no MESMO BAIRRO (${propertyNeighborhood ?? 'identificado no endereço'}) e mesma cidade.
3. Valores unitários de terreno costumam ficar entre R$ 80/m² e R$ 15.000/m² conforme localização — NÃO use faixas de imóveis edificados.
4. ATENÇÃO A PREÇOS DE TERRENO: anúncios podem informar preço TOTAL (ex.: R$ 450.000 por 500 m²) ou preço POR M² (ex.: R$ 900/m²). declaredPrice = preço total do anúncio; unitPriceSqm = R$/m² do terreno (total ÷ área do lote quando necessário).
5. estimatedValue DEVE ser exatamente valuePerSqm × ${input.area} m². Nunca retorne estimatedValue igual ao valor unitário por m².
6. Homogeneize por: localização, área do lote, zoneamento/plano diretor, topografia, infraestrutura viária e serviços, formato do lote e mercado local. Não aplique fatores de conservação, mobília ou acabamento.
7. marketAnalysis.averagePricePerSqm = média/mediana dos R$/m² dos terrenos comparáveis homogeneizados.
`
    : ''

  const builtPriceRule =
    '5. ATENÇÃO A PREÇOS: anúncios frequentemente informam valor POR M² (ex.: R$ 8.500/m²). Não divida novamente pela área nesses casos. declaredPrice deve refletir o preço total do anúncio; unitPriceSqm e homogenizedUnitPriceSqm devem estar em R$/m² coerentes com a região (tipicamente acima de R$ 1.500/m² em cidades médias/grandes).'

  const landPriceRule =
    '5. ATENÇÃO A PREÇOS DE TERRENO: distinga preço total do lote vs. R$/m². declaredPrice = valor total do anúncio; unitPriceSqm = R$/m² do terreno. estimatedValue = valuePerSqm × área do terreno avaliando.'

  const systemPrompt = `Você é um avaliador imobiliário sênior no mercado brasileiro, com rigor técnico conforme ABNT NBR 14653-1 e NBR 14653-2 (imóveis urbanos).
${locationRuleBlock}
AVALIAÇÃO AVANÇADA — OBRIGATÓRIO:
1. Integre TODAS as características informadas (tipo, área${isLand ? ' do terreno' : ', terreno, idade, conservação, padrão, acabamento, mobília, condomínio, vista, andar, mezanino, estrutura, amenidades, móveis alto padrão'}, valor pedido/desejado e observações) na homogeneização e no score final.
2. Pesquisa de bairro: analise infraestrutura, serviços, mobilidade, segurança percebida e qualidade de vida com base nos resultados Serper.
3. Valorização de mercado: estime tendência (valorização/estável/desvalorização), crescimento anual estimado quando possível, demanda, liquidez e projeção — cruzando pesquisa de mercado e valorização.
4. O score (0-100) e criteriaScores devem refletir perfil do bairro e tendência de valorização, além das características ${isLand ? 'do terreno e zoneamento' : 'físicas do imóvel'}.
4b. OBRIGATÓRIO — scores do radar (0-100, inteiros, NÃO cosméticos/vazios): finishScore (acabamento), conservationScore (conservação), constructionScore (construção/padrão), locationScore (localização), appreciationScore (valorização). Eles DEVEM ser coerentes com criteriaScores e marketAppreciationAnalysis.
5. Inclua em aiInsights conclusões acionáveis sobre valorização e diferenciais ${isLand ? 'do terreno' : 'do imóvel'}.
5b. Considere explicitamente o valor desejado/pedido pelo proprietário (askingPrice) na calibração — não ignore.
${landMethodologyBlock}
METODOLOGIA OBRIGATÓRIA (NBR 14653):
1. Objetivo: determinação do valor de mercado ${isLand ? 'do terreno avaliando' : 'do imóvel avaliando'}.
2. Método principal: Comparativo Direto de Dados de Mercado (preferencial conforme norma).
3. Selecione de 3 a 6 ${isLand ? 'terrenos/lotes' : 'imóveis'} comparáveis reais da pesquisa Serper, prioritariamente do bairro ${propertyNeighborhood ?? 'do endereço informado'}.
4. Para cada comparável, aplique fatores de homogeneização (multiplicadores entre 0,85 e 1,15 por fator) para: localização, área${isLand ? ' do lote, zoneamento, infraestrutura viária' : ', terreno, conservação, padrão, idade, layout, vagas, condomínio, vista, amenidades'} e mercado. O produto combinado dos fatores de cada comparável deve ficar entre 0,75 e 1,25.
${isLand ? landPriceRule : builtPriceRule}
6. Calcule o valor unitário homogeneizado de cada comparável.${isLand ? '' : ' Some valor de móveis alto padrão ao valor final se informado.'}
7. ${
    useMedian
      ? `${isLand ? 'TERRENO' : 'IMÓVEL DE ALTO PADRÃO'}: use MEDIANA (não média) dos valores unitários homogeneizados — mais realista em segmentos com dispersão de preços. O campo marketAnalysis.averagePricePerSqm deve ser a mediana R$/m² dos comparáveis do mesmo padrão. nbr14653.calculationMemory.homogenizedAveragePriceSqm = mediana unitária. Valor final = mediana × área do ${isLand ? 'terreno' : 'imóvel'}${isLand ? '' : ' (+ móveis)'}.`
      : `Obtenha média ponderada dos valores unitários homogeneizados (pesos somando 1,0). Valor final = média unitária × área ${isLand ? 'do terreno' : 'do imóvel'}${isLand ? '' : ' (+ móveis se houver)'}.`
  }
8. Calibração: se houver valor pedido, o estimatedValue deve ficar em faixa plausível (em geral entre 75% e 115% do valor pedido, salvo evidência forte em contrário). Não subestime sistematicamente.
9. Registre memória de cálculo passo a passo e limitações da amostra.
10. CONSISTÊNCIA OBRIGATÓRIA: estimatedValue = valuePerSqm × ${input.area} m² (área ${isLand ? 'do terreno' : 'útil/construída'}). Os três campos (estimatedValue, valuePerSqm, nbr14653.calculationMemory.finalValue) devem ser coerentes entre si.

Analise também o Plano Diretor/zoneamento urbano.
Estime pontuações de critérios (1 a 5) ponderando localização (inclui bairro), infraestrutura, conservação, layout, mercado (inclui valorização) e documentação.
Responda APENAS com JSON válido, sem markdown, seguindo exatamente esta estrutura:
{
  "estimatedValue": number,
  "valuePerSqm": number,
  "score": number (0-100),
  "scoreLabel": "Excelente" | "Bom" | "Médio" | "Regular",
  "finishScore": number (0-100),
  "conservationScore": number (0-100),
  "constructionScore": number (0-100),
  "locationScore": number (0-100),
  "appreciationScore": number (0-100),
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
  "neighborhoodAnalysis": {
    "overview": "string",
    "infrastructure": ["string"],
    "services": ["string — escolas, saúde, comércio"],
    "mobility": ["string — transporte, vias, acessos"],
    "safetyPerception": "string",
    "qualityOfLife": "string",
    "highlights": ["string"],
    "concerns": ["string"],
    "summary": "string"
  },
  "floodRiskAnalysis": omitido,
  "marketAppreciationAnalysis": {
    "trend": "valorizacao" | "estavel" | "desvalorizacao" | "indeterminado",
    "trendLabel": "string",
    "annualGrowthEstimatePercent": number | null,
    "historicalContext": "string",
    "demandLevel": "string",
    "liquidity": "string",
    "priceTrendFactors": ["string"],
    "projectionSummary": "string",
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
${propertyNeighborhood ? `\nBairro de referência obrigatório para comparáveis: ${propertyNeighborhood}${propertyCity ? `, ${propertyCity}` : ''}\n` : ''}
--- PESQUISA DE MERCADO (imobiliárias locais via Serper) ---
${formatSerperResults(marketResults)}

--- PLANO DIRETOR / ZONEAMENTO (via Serper) ---
${formatSerperResults(masterPlanResults)}

--- PESQUISA AVANÇADA DO BAIRRO (via Serper) ---
${formatSerperResults(neighborhoodResults)}

--- VALORIZAÇÃO E TENDÊNCIA DE MERCADO (via Serper) ---
${formatSerperResults(appreciationResults)}

${input.photos?.length ? `Foram enviadas ${input.photos.length} foto(s) do imóvel para análise visual.` : 'Nenhuma foto enviada.'}

${input.askingPrice ? `O valor pedido pelo proprietário é R$ ${input.askingPrice.toLocaleString('pt-BR')} — use como referência de calibração do mercado local.` : ''}
${feedbackLearning ? `\n${feedbackLearning}\n` : ''}

Gere a avaliação avançada completa, integrando bairro, valorização e todas as características do imóvel. Priorize precisão do valor de mercado — evite estimativas sistematicamente baixas.`

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
