import { describe, it, expect } from 'vitest'
import { starsFor } from './stars'

describe('starsFor', () => {
  it('3 estrellas si igualas el óptimo', () => { expect(starsFor(4, 4)).toBe(3) })
  it('2 estrellas con un clic de más', () => { expect(starsFor(5, 4)).toBe(2) })
  it('1 estrella si te pasas por 2 o más', () => {
    expect(starsFor(6, 4)).toBe(1); expect(starsFor(10, 4)).toBe(1)
  })
})
