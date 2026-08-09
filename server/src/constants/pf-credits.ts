/**
 * PF free: sem recompensa por avaliação (evita estoque de créditos sem pagar).
 * Mantido em 0 — funções de grant no-op quando amount === 0.
 */
export const PF_EVALUATION_REWARD = 0

/** Bônus só na primeira publicação de imóvel (oferta de leads). */
export const PF_PUBLISH_REWARD = 2

/** Avaliações grátis por mês no plano free (anti-abuso de custo IA). */
export const PF_FREE_MONTHLY_EVALUATION_CAP = 3

/** Publicações grátis por mês no plano free. */
export const PF_FREE_MONTHLY_PUBLISH_CAP = 1
