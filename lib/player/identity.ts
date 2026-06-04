import { createHmac, timingSafeEqual } from 'node:crypto'

export const PID_COOKIE = 'wr_pid'

function sig(id: string, secret: string): string {
  return createHmac('sha256', secret).update(id).digest('hex')
}
/** Cookie firmada: `${id}.${hmac}`. */
export function signPid(id: string, secret: string): string {
  return `${id}.${sig(id, secret)}`
}
/** Devuelve el playerId si la firma es válida, si no null. */
export function parsePid(cookie: string, secret: string): string | null {
  const dot = cookie.lastIndexOf('.')
  if (dot <= 0) return null
  const id = cookie.slice(0, dot)
  const mac = cookie.slice(dot + 1)
  const expected = sig(id, secret)
  if (mac.length !== expected.length) return null
  try { return timingSafeEqual(Buffer.from(mac), Buffer.from(expected)) ? id : null } catch { return null }
}
