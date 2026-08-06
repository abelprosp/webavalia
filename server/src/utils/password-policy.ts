import { z } from 'zod'

/** Créditos iniciais no cadastro (PJ e PF). +1 bônus PJ vem do feedback. */
export const TRIAL_EVALUATIONS_TOTAL = 2

/** Total possível no funil gratuito PJ: cadastro + bônus por feedback. */
export const TRIAL_EVALUATIONS_MAX = 3

export const passwordSchema = z
  .string()
  .min(8, 'Senha deve ter ao menos 8 caracteres.')
  .max(128, 'Senha muito longa.')
  .regex(/[a-z]/, 'Senha deve conter ao menos uma letra minúscula.')
  .regex(/[A-Z]/, 'Senha deve conter ao menos uma letra maiúscula.')
  .regex(/[0-9]/, 'Senha deve conter ao menos um número.')

export function validatePassword(password: string) {
  return passwordSchema.safeParse(password)
}
