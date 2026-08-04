import { z } from 'zod'
import { config } from '../config.js'
import type { FloodRiskAnalysis } from '../types/advanced-analysis.js'
import {
  floodAnalysisFromKnowledge,
  formatLocationFloodKnowledgeForPrompt,
  getLocationFloodKnowledge,
} from './location-flood-feedback-service.js'
import type { SerperResult } from './serper.js'
import { extractLocationHint } from './serper.js'

const FLOOD_TERMS =
  /\b(enchente|enchentes|alagamento|alagamentos|inundaç|inundac|cheia|cheias|alagou|alagaram|cota de cheia|área alagável|area alagavel|risco hídrico|risco hidrico|defesa civil|bueiro|enxurrada)\b/i

const NEGATIVE_FLOOD_TERMS =
  /\b(sem histórico|sem registro|não alaga|nao alaga|nunca alagou|área seca|area seca|livre de inunda|fora da área de risco|fora da area de risco)\b/i

const SEVERITY_ALTO =
  /\b(sever[oa]|grave|destrui|evacua|recorrente|crônic|cronica|alto risco|nível crítico|nivel critico|inundaç.*total|submers)\b/i

const SEVERITY_MODERADO =
  /\b(moderad|recorrente|frequente|área de risco|area de risco|alagável|alagavel|mapa de inunda|histórico de enchente|historico de enchente)\b/i

const SEVERITY_BAIXO =
  /\b(pontual|leve|pouco|quase alag|parcial|eventual|isolad|entupimento|poça|poca d.?água|alagamento leve)\b/i

const floodAiSchema = z.object({
  hasEvidence: z.boolean(),
  riskLevel: z.enum(['baixo', 'moderado', 'alto']).nullable(),
  riskLevelLabel: z.string().nullable(),
  floodQuota: z.string().nullable(),
  historicalEvents: z.array(z.string()),
  affectedAreas: z.array(z.string()),
  mitigationMeasures: z.array(z.string()),
  impactOnValue: z.string().nullable(),
  summary: z.string().nullable(),
})

function formatSerperResults(results: SerperResult[]) {
  if (results.length === 0) return 'Nenhum resultado encontrado.'
  return results
    .map(
      (r, i) =>
        `${i + 1}. ${r.title}\n   URL: ${r.link}\n   Resumo: ${r.snippet}`
    )
    .join('\n\n')
}

function extractLocationParts(address: string) {
  const parts = address
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const cityState = extractLocationHint(address)
  const neighborhood = parts.length >= 3 ? parts[parts.length - 3] : parts[0] ?? ''
  const street = parts.length >= 4 ? parts.slice(0, -3).join(', ') : ''

  return { cityState, neighborhood, street, full: address.trim() }
}

function snippetMatchesLocation(text: string, location: ReturnType<typeof extractLocationParts>) {
  const normalized = text.toLowerCase()
  const tokens = [location.neighborhood, ...location.cityState.split(/[,\/]/)]
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 4)

  return tokens.some((token) => normalized.includes(token))
}

function prefilterRelevantResults(
  results: SerperResult[],
  location: ReturnType<typeof extractLocationParts>
) {
  return results.filter((r) => {
    const blob = `${r.title} ${r.snippet}`.toLowerCase()
    if (!FLOOD_TERMS.test(blob)) return false
    if (NEGATIVE_FLOOD_TERMS.test(blob) && !SEVERITY_ALTO.test(blob)) {
      return snippetMatchesLocation(blob, location)
    }
    return snippetMatchesLocation(blob, location) || FLOOD_TERMS.test(blob)
  })
}

function riskLabel(level: FloodRiskAnalysis['riskLevel']) {
  switch (level) {
    case 'baixo':
      return 'Baixo'
    case 'moderado':
      return 'Moderado'
    case 'alto':
      return 'Alto'
  }
}

function analyzeWithHeuristics(
  address: string,
  results: SerperResult[]
): FloodRiskAnalysis | null {
  const location = extractLocationParts(address)
  const relevant = prefilterRelevantResults(results, location)
  if (relevant.length === 0) return null

  const blob = relevant.map((r) => `${r.title} ${r.snippet}`).join('\n')

  if (NEGATIVE_FLOOD_TERMS.test(blob) && !SEVERITY_ALTO.test(blob) && !SEVERITY_MODERADO.test(blob)) {
    return null
  }

  let riskLevel: FloodRiskAnalysis['riskLevel'] = 'baixo'
  if (SEVERITY_ALTO.test(blob)) riskLevel = 'alto'
  else if (SEVERITY_MODERADO.test(blob)) riskLevel = 'moderado'
  else if (SEVERITY_BAIXO.test(blob)) riskLevel = 'baixo'
  else if (!snippetMatchesLocation(blob, location)) return null

  const quotaMatch = blob.match(/cota[^.\n]{0,80}cheia[^.\n]{0,120}/i)

  const events = relevant
    .slice(0, 4)
    .map((r) => r.snippet.trim())
    .filter(Boolean)

  return {
    riskLevel,
    riskLevelLabel: riskLabel(riskLevel),
    floodQuota: quotaMatch?.[0]?.trim() ?? null,
    historicalEvents: events,
    affectedAreas: location.neighborhood ? [location.neighborhood] : [],
    mitigationMeasures: [],
    impactOnValue:
      riskLevel === 'alto'
        ? 'Risco hídrico elevado pode reduzir liquidez e exigir desconto no valor de mercado.'
        : riskLevel === 'moderado'
          ? 'Risco hídrico moderado pode influenciar negociações em períodos de chuva intensa.'
          : 'Risco hídrico baixo — impacto limitado, mas vale monitorar eventos extremos.',
    summary: `Foram encontrados registros de risco hídrico na região de ${location.cityState}. Classificação: ${riskLabel(riskLevel).toLowerCase()}.`,
  }
}

async function analyzeWithOpenAI(
  address: string,
  results: SerperResult[],
  userKnowledgePrompt?: string
): Promise<FloodRiskAnalysis | null> {
  const location = extractLocationParts(address)
  const relevant = prefilterRelevantResults(results, location)

  const systemPrompt = `Você analisa risco hídrico de imóveis no Brasil com base EXCLUSIVAMENTE nos resultados de busca fornecidos.

REGRAS OBRIGATÓRIAS:
1. Analise SOMENTE a localização específica informada (endereço, bairro, cidade).
2. Se NÃO houver evidência de alagamento/enchente NAQUELA localização específica → hasEvidence=false e riskLevel=null.
3. NÃO invente eventos. NÃO generalize risco de outras cidades/bairros.
4. Se a região nunca alagou ou está fora de área de risco → hasEvidence=false.
5. Se houver RELATOS DE USUÁRIOS abaixo, eles têm PRIORIDADE MÁXIMA sobre resultados de busca genéricos.

CLASSIFICAÇÃO (somente se hasEvidence=true):
- baixo: alagamento pontual/leve, quase alagou, poças, entupimento de bueiros, evento isolado com pouca água
- moderado: alagamentos recorrentes moderados, área em mapa de risco médio, cota de cheia próxima
- alto: enchentes severas/recorrentes, área de alto risco em mapas oficiais, histórico grave documentado

floodQuota: extraia cota de cheia, nível do rio/córrego ou referência oficial quando mencionados; senão null.

Responda JSON válido em português do Brasil.`

  const userText = `Localização do imóvel:
- Endereço completo: ${location.full}
- Bairro/região: ${location.neighborhood || 'não informado'}
- Cidade/UF: ${location.cityState}

Resultados de busca sobre enchentes, cota de cheia e risco hídrico:
${formatSerperResults(relevant.length > 0 ? relevant : results)}
${userKnowledgePrompt ? `\n--- RELATOS CONFIRMADOS POR USUÁRIOS (PRIORIDADE MÁXIMA) ---\n${userKnowledgePrompt}` : ''}

Retorne JSON:
{
  "hasEvidence": boolean,
  "riskLevel": "baixo" | "moderado" | "alto" | null,
  "riskLevelLabel": "string ou null",
  "floodQuota": "cota de cheia / nível de referência ou null",
  "historicalEvents": ["eventos documentados na localização"],
  "affectedAreas": ["áreas afetadas na localização"],
  "mitigationMeasures": ["medidas oficiais se houver"],
  "impactOnValue": "string ou null",
  "summary": "string ou null"
}`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.openaiModel,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText },
      ],
    }),
  })

  if (!response.ok) {
    return analyzeWithHeuristics(address, results)
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[]
  }

  const content = data.choices[0]?.message?.content
  if (!content) return analyzeWithHeuristics(address, results)

  const parsed = floodAiSchema.parse(JSON.parse(content))

  if (!parsed.hasEvidence || !parsed.riskLevel) return null

  return {
    riskLevel: parsed.riskLevel,
    riskLevelLabel: parsed.riskLevelLabel ?? riskLabel(parsed.riskLevel),
    floodQuota: parsed.floodQuota,
    historicalEvents: parsed.historicalEvents,
    affectedAreas: parsed.affectedAreas,
    mitigationMeasures: parsed.mitigationMeasures,
    impactOnValue: parsed.impactOnValue ?? '',
    summary: parsed.summary ?? '',
  }
}

export async function analyzeFloodRisk(
  address: string,
  searchResults: SerperResult[]
): Promise<FloodRiskAnalysis | null> {
  const userKnowledge = await getLocationFloodKnowledge(address)

  if (userKnowledge) {
    const trusted =
      userKnowledge.source === 'address' || userKnowledge.reportCount >= 2
    if (!userKnowledge.gotWater && trusted) return null
    if (userKnowledge.gotWater && userKnowledge.source === 'address') {
      return floodAnalysisFromKnowledge(userKnowledge)
    }
  }

  const userKnowledgePrompt = userKnowledge
    ? formatLocationFloodKnowledgeForPrompt(userKnowledge, address)
    : undefined

  if (searchResults.length === 0) {
    if (userKnowledge?.gotWater && userKnowledge.reportCount >= 2) {
      return floodAnalysisFromKnowledge(userKnowledge)
    }
    return null
  }

  const hasAnyFloodTerm = searchResults.some((r) =>
    FLOOD_TERMS.test(`${r.title} ${r.snippet}`)
  )

  if (!hasAnyFloodTerm && !userKnowledge?.gotWater) return null

  let analysis: FloodRiskAnalysis | null = null

  if (config.openaiApiKey) {
    analysis = await analyzeWithOpenAI(address, searchResults, userKnowledgePrompt)
  } else if (hasAnyFloodTerm) {
    analysis = analyzeWithHeuristics(address, searchResults)
  }

  if (userKnowledge?.gotWater && userKnowledge.reportCount >= 2) {
    return floodAnalysisFromKnowledge(userKnowledge)
  }

  return analysis
}
