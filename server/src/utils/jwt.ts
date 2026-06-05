import jwt, { type SignOptions } from 'jsonwebtoken'
import { config } from '../config.js'

export type JwtPayload = {
  sub: string
  email: string
  role: string
}

export function signToken(payload: JwtPayload) {
  const options: SignOptions = {
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
  }
  return jwt.sign(payload, config.jwtSecret, options)
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload
}
