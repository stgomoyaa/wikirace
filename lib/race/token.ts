import { createHmac, timingSafeEqual } from 'node:crypto'
import { normalizeTitle } from '@/lib/wiki/title'

/** Tiempo mínimo plausible por salto (ms). */
export const MIN_MS_PER_HOP = 600

function hmac(raceId: string, title: string, secret: string): string {
  return createHmac('sha256', secret).update(`${raceId}:${normalizeTitle(title)}`).digest('hex')
}
/** Firma un token que prueba que `title` fue servido por nuestro proxy para `raceId`. */
export function signStep(raceId: string, title: string, secret: string): string {
  return hmac(raceId, title, secret)
}
/** Verifica el token de un paso (comparación de tiempo constante). */
export function verifyStep(raceId: string, title: string, token: string, secret: string): boolean {
  const expected = hmac(raceId, title, secret)
  if (token.length !== expected.length) return false
  try { return timingSafeEqual(Buffer.from(token), Buffer.from(expected)) } catch { return false }
}
/** ¿El tiempo total es físicamente imposible para esa cantidad de saltos? */
export function isImpossibleTime(timeMs: number, hops: number): boolean {
  return timeMs < hops * MIN_MS_PER_HOP
}
