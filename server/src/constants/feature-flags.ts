/** Compra de créditos e assinatura de planos (deve espelhar o frontend). */
export const CREDITS_AND_PLANS_ENABLED =
  process.env.CREDITS_AND_PLANS_ENABLED === 'true'

/** Limite diário de avaliações IA para contas PF (anti-abuso de custo). */
export const PF_DAILY_EVALUATION_CAP = Number(
  process.env.PF_DAILY_EVALUATION_CAP ?? 10
)
