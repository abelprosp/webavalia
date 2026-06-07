import { z } from 'zod'

export const TRIAL_EVALUATIONS_TOTAL = 3

export const passwordSchema = z
  .string()
  .min(8, 'Senha deve ter ao menos 8 caracteres.')
  .regex(/[a-z]/, 'Senha deve conter ao menos uma letra minúscula.')
  .regex(/[A-Z]/, 'Senha deve conter ao menos uma letra maiúscula.')
  .regex(/[0-9]/, 'Senha deve conter ao menos um número.')

export function validatePassword(password: string) {
  return passwordSchema.safeParse(password)
}
