/**
 * PF free: sem recompensa por avaliação (evita estoque de créditos sem pagar).
 * Mantido em 0 — funções de grant no-op quando amount === 0.
 */
export const PF_EVALUATION_REWARD = 0

/** Bônus só na primeira publicação de imóvel (oferta de leads). */
export const PF_PUBLISH_REWARD = 2

/**
 * Avaliações IA grátis (lifetime) no plano free.
 * A partir da 4ª, cobra EVALUATION_CREDIT_COST créditos.
 */
export const PF_FREE_EVALUATIONS = 3

/** @deprecated Use PF_FREE_EVALUATIONS (lifetime, não mensal). */
export const PF_FREE_MONTHLY_EVALUATION_CAP = PF_FREE_EVALUATIONS

/**
 * Publicações ilimitadas no plano free (PF).
 * Mantido em Infinity para compatibilidade; assertPfCanPublish é no-op.
 */
export const PF_FREE_MONTHLY_PUBLISH_CAP = Number.POSITIVE_INFINITY
