export type PlanAudience = 'pf' | 'pj'

export type PlanDefinition = {
  slug: string
  audience: PlanAudience
  credits: number
  priceCents: number
  label: string
  description: string
  highlighted?: boolean
  features: readonly string[]
}

export const LEAD_UNLOCK_CREDIT_COST = 2
/** Custo em créditos por avaliação IA (PF após cotas grátis e PJ sempre). */
export const EVALUATION_CREDIT_COST = 5

/** Pacotes PIX permitidos (créditos) e desconto no maior. */
export const PIX_ALLOWED_PACKS = [5, 10, 20] as const
export const PIX_PACK_20_DISCOUNT_PERCENT = 10

export const PRICING = {
  leadCreditPack: {
    credits: 1,
    priceCents: 1190,
    label: 'Créditos avulsos (PIX)',
  },
  plans: {
    pf_plus: {
      slug: 'pf_plus',
      audience: 'pf' as const,
      credits: 10,
      priceCents: 3990,
      label: 'Proprietário Plus',
      description:
        '10 avaliações IA/mês (créditos válidos somente para avaliações), publicação ilimitada e histórico completo.',
      features: [
        '10 avaliações IA por mês',
        'Créditos exclusivos para avaliações',
        'Publicar imóvel ilimitado',
        'Histórico e PDF completo',
      ],
    },
    starter: {
      slug: 'starter',
      audience: 'pj' as const,
      credits: 12,
      priceCents: 9700,
      label: 'Starter',
      description: '12 créditos/mês para avaliar e desbloquear oportunidades.',
      features: [
        '12 créditos/mês',
        'Avaliações IA',
        'Radar de captação IA',
        'Desbloqueio de leads (2 créditos)',
        'CRM básico',
      ],
    },
    pro: {
      slug: 'pro',
      audience: 'pj' as const,
      credits: 30,
      priceCents: 19700,
      label: 'Pro',
      description: '30 créditos/mês com mapa, FoxAi e scoring — melhor custo por crédito.',
      highlighted: true,
      features: [
        '30 créditos/mês',
        'Radar de captação IA',
        'CRM + Lead Scoring IA',
        'Mapa de mercado',
        'FoxAi',
        'Desbloqueio de leads (2 créditos)',
      ],
    },
    agency: {
      slug: 'agency',
      audience: 'pj' as const,
      credits: 80,
      priceCents: 49700,
      label: 'Imobiliária',
      description: '80 créditos/mês para times e alto volume de captação.',
      features: [
        '80 créditos/mês',
        'Tudo do Pro',
        'Ideal para times (até 5 usuários em breve)',
        'Suporte prioritário',
      ],
    },
  },
  /** Alias do plano âncora (Pro) — compatibilidade com código legado. */
  get evaluationPlan() {
    return {
      trialEvaluations: this.plans.pro.credits,
      priceCents: this.plans.pro.priceCents,
      label: `${this.plans.pro.label} — ${this.plans.pro.credits} créditos`,
      description: this.plans.pro.description,
      slug: this.plans.pro.slug,
    }
  },
} as const

export type PlanSlug = keyof typeof PRICING.plans

export function listPlans(audience?: PlanAudience): PlanDefinition[] {
  return Object.values(PRICING.plans).filter(
    (plan) => !audience || plan.audience === audience
  )
}

export function getPlanBySlug(slug: string | null | undefined): PlanDefinition | null {
  if (!slug) return null
  const plan = PRICING.plans[slug as PlanSlug]
  return plan ?? null
}

export function resolveCheckoutPlanSlug(
  slug: string | undefined,
  audience: PlanAudience
): PlanSlug {
  if (slug && slug in PRICING.plans) {
    const plan = PRICING.plans[slug as PlanSlug]
    if (plan.audience === audience) return slug as PlanSlug
  }
  return audience === 'pf' ? 'pf_plus' : 'pro'
}

/** Calcula valor PIX com desconto de 10% no pack de 20. */
export function calculatePixPackAmount(packs: number) {
  const normalized = PIX_ALLOWED_PACKS.includes(
    packs as (typeof PIX_ALLOWED_PACKS)[number]
  )
    ? packs
    : 5
  const unit = PRICING.leadCreditPack.priceCents
  const credits = PRICING.leadCreditPack.credits * normalized
  let amountCents = unit * normalized
  if (normalized === 20) {
    amountCents = Math.round(amountCents * (1 - PIX_PACK_20_DISCOUNT_PERCENT / 100))
  }
  return { packs: normalized, credits, amountCents }
}

export function formatPriceLabel(priceCents: number) {
  return (priceCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}
