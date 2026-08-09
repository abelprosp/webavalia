import { api } from './api'

export type CaptureOpportunity = {
  id: string
  searchKey: string
  title: string
  propertyType: string | null
  priceCents: number | null
  area: number | null
  location: string | null
  sourceUrl: string
  sourcePortal: string | null
  ownerSignal: boolean
  marketValueCents: number | null
  discountPercent: number | null
  opportunityScore: number | null
  status: 'nova' | 'abordada' | 'descartada' | 'no_crm'
  approachMessage: string | null
  rawSnippet: string | null
  createdAt: string
  expiresAt: string
}

export type RadarScanInput = {
  city: string
  state: string
  neighborhood?: string
  propertyType: string
  listingIntent: 'vender' | 'alugar'
}

export type RadarScanResult = {
  searchKey: string
  regionValuePerSqm: number | null
  found: number
  creditsRemaining: number
  opportunities: CaptureOpportunity[]
}

export async function runRadarScan(
  input: RadarScanInput
): Promise<RadarScanResult> {
  const { data } = await api.post<RadarScanResult>('/radar/scan', input)
  return data
}

export async function fetchRadarOpportunities(filters?: {
  status?: string
  search?: string
}): Promise<CaptureOpportunity[]> {
  const { data } = await api.get<{ opportunities: CaptureOpportunity[] }>(
    '/radar/opportunities',
    { params: filters }
  )
  return data.opportunities
}

export async function generateRadarApproach(
  id: string
): Promise<CaptureOpportunity> {
  const { data } = await api.post<{ opportunity: CaptureOpportunity }>(
    `/radar/opportunities/${id}/approach`
  )
  return data.opportunity
}

export async function sendRadarOpportunityToCrm(
  id: string
): Promise<{ dealId: string; opportunity: CaptureOpportunity }> {
  const { data } = await api.post<{
    deal: { id: string }
    opportunity: CaptureOpportunity
  }>(`/radar/opportunities/${id}/to-crm`)
  return { dealId: data.deal.id, opportunity: data.opportunity }
}

export async function updateRadarOpportunityStatus(
  id: string,
  status: 'nova' | 'abordada' | 'descartada'
): Promise<CaptureOpportunity> {
  const { data } = await api.patch<{ opportunity: CaptureOpportunity }>(
    `/radar/opportunities/${id}/status`,
    { status }
  )
  return data.opportunity
}
