/** Compra de créditos e assinatura de planos (deve espelhar o frontend). */
export const CREDITS_AND_PLANS_ENABLED =
  process.env.CREDITS_AND_PLANS_ENABLED === 'true'

/**
 * Limite diário absoluto de avaliações IA para contas PF (rede de segurança).
 * O limite comercial principal é o mensal free em pf-credits.ts.
 */
export const PF_DAILY_EVALUATION_CAP = Number(
  process.env.PF_DAILY_EVALUATION_CAP ?? 5
)
