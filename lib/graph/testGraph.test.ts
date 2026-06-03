import { describe, it, expect } from 'vitest'
import { InMemoryGraph } from './testGraph'

const g = new InMemoryGraph(
  { 1: [2, 3], 2: [3], 3: [] },
  { 1: 'A', 2: 'B', 3: 'C' },
  [1, 2],
)

describe('InMemoryGraph', () => {
  it('devuelve enlaces salientes', () => {
    expect(g.outLinks(1)).toEqual([2, 3])
    expect(g.outLinks(3)).toEqual([])
  })
  it('calcula in-degree desde la adyacencia', () => {
    expect(g.inDegree(3)).toBe(2) // 1->3 y 2->3
    expect(g.inDegree(1)).toBe(0)
  })
  it('mapea id<->título', () => {
    expect(g.titleOf(2)).toBe('B')
    expect(g.idOf('C')).toBe(3)
    expect(g.idOf('Nope')).toBeNull()
  })
  it('randomArticle recorre la secuencia provista y cicla', () => {
    const g2 = new InMemoryGraph({ 1: [], 2: [] }, { 1: 'A', 2: 'B' }, [1, 2])
    expect([g2.randomArticle(), g2.randomArticle(), g2.randomArticle()]).toEqual([1, 2, 1])
  })
})
