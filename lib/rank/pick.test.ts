import { describe, it, expect } from 'vitest'
import { chooseUnplayed } from './pick'

describe('chooseUnplayed', () => {
  it('elige sólo entre los no jugados', () => {
    expect(chooseUnplayed(['a', 'b', 'c'], ['a', 'b'], () => 0)).toBe('c')
  })
  it('usa rnd para elegir dentro del pool no jugado', () => {
    expect(chooseUnplayed(['a', 'b', 'c'], [], () => 0)).toBe('a')
    expect(chooseUnplayed(['a', 'b', 'c'], [], () => 0.99)).toBe('c')
  })
  it('devuelve null si todos fueron jugados', () => {
    expect(chooseUnplayed(['a', 'b'], ['a', 'b'], () => 0)).toBeNull()
  })
  it('devuelve null si no hay candidatos', () => {
    expect(chooseUnplayed([], [], () => 0)).toBeNull()
  })
})
