import bcrypt from 'bcryptjs'

const BCRYPT_ROUNDS = 12

/** Hash fixo para equalizar tempo de resposta quando o e-mail não existe. */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  'invalid-credential-timing-equalizer',
  BCRYPT_ROUNDS
)

export async function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export async function verifyPasswordConstantTime(
  password: string,
  hash: string | null | undefined
) {
  return bcrypt.compare(password, hash ?? DUMMY_PASSWORD_HASH)
}
