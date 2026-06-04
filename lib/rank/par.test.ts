import { describe, it, expect } from 'vitest'
import { parMs, BASE_MS_PER_HOP } from './par'

describe('parMs', () => {
  it('escala con el largo óptimo', () => {
    expect(parMs(3)).toBe(3 * BASE_MS_PER_HOP); expect(parMs(5)).toBe(5 * BASE_MS_PER_HOP)
  })
  it('nunca devuelve 0 o negativo', () => { expect(parMs(0)).toBeGreaterThan(0) })
})
