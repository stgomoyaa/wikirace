import { describe, it, expect } from 'vitest'
import { signPid, parsePid, pidFromCookieHeader, PID_COOKIE } from './identity'

const SECRET = 'pid-secret'

describe('player id cookie', () => {
  it('firma y parsea un playerId', () => {
    const cookie = signPid('player123', SECRET)
    expect(parsePid(cookie, SECRET)).toBe('player123')
  })
  it('rechaza cookie manipulada', () => {
    const cookie = signPid('player123', SECRET)
    const tampered = cookie.replace('player123', 'attacker')
    expect(parsePid(tampered, SECRET)).toBeNull()
  })
  it('devuelve null para basura', () => {
    expect(parsePid('nope', SECRET)).toBeNull()
  })
})

describe('pidFromCookieHeader', () => {
  it('extrae el pid de un header con varias cookies', () => {
    const cookie = signPid('player123', SECRET)
    const header = `foo=bar; ${PID_COOKIE}=${cookie}; baz=qux`
    expect(pidFromCookieHeader(header, SECRET)).toBe('player123')
  })
  it('devuelve null si no está la cookie o el header es null', () => {
    expect(pidFromCookieHeader('foo=bar', SECRET)).toBeNull()
    expect(pidFromCookieHeader(null, SECRET)).toBeNull()
  })
  it('devuelve null si la firma no es válida', () => {
    const header = `${PID_COOKIE}=player123.deadbeef`
    expect(pidFromCookieHeader(header, SECRET)).toBeNull()
  })
})
