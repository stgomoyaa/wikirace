import { describe, it, expect } from 'vitest'
import { signPid, parsePid } from './identity'

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
