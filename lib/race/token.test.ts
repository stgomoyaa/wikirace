import { describe, it, expect } from 'vitest'
import { signStep, verifyStep, isImpossibleTime } from './token'

const SECRET = 'test-secret'

describe('step tokens', () => {
  it('un token firmado se verifica', () => {
    const t = signStep('race1', 'Dog', SECRET)
    expect(verifyStep('race1', 'Dog', t, SECRET)).toBe(true)
  })
  it('rechaza token de otro artículo o carrera', () => {
    const t = signStep('race1', 'Dog', SECRET)
    expect(verifyStep('race1', 'Cat', t, SECRET)).toBe(false)
    expect(verifyStep('race2', 'Dog', t, SECRET)).toBe(false)
  })
  it('rechaza token manipulado', () => {
    expect(verifyStep('race1', 'Dog', 'garbage', SECRET)).toBe(false)
  })
})
describe('isImpossibleTime', () => {
  it('marca imposible un tiempo absurdo para los saltos', () => {
    expect(isImpossibleTime(200, 5)).toBe(true)
  })
  it('acepta un tiempo plausible', () => {
    expect(isImpossibleTime(15_000, 5)).toBe(false)
  })
})
