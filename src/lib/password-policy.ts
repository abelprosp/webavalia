export const TRIAL_EVALUATIONS_TOTAL = 3

export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'Senha deve ter ao menos 8 caracteres.'
  }
  if (!/[a-z]/.test(password)) {
    return 'Senha deve conter ao menos uma letra minúscula.'
  }
  if (!/[A-Z]/.test(password)) {
    return 'Senha deve conter ao menos uma letra maiúscula.'
  }
  if (!/[0-9]/.test(password)) {
    return 'Senha deve conter ao menos um número.'
  }
  return null
}
