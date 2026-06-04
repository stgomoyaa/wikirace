import { describe, it, expect } from 'vitest'
import { bfs, shortestPath } from './bfs'
import { InMemoryGraph } from './testGraph'

// 1 -> 2 -> 3 -> 4 ; 1 -> 5 ; 5 -> 4
const g = new InMemoryGraph(
  { 1: [2, 5], 2: [3], 3: [4], 4: [], 5: [4] },
  { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' },
)

describe('bfs', () => {
  it('calcula la distancia más corta a cada nodo', () => {
    const { dist } = bfs(g, 1, 10)
    expect(dist.get(1)).toBe(0)
    expect(dist.get(2)).toBe(1)
    expect(dist.get(5)).toBe(1)
    expect(dist.get(4)).toBe(2) // vía 5, más corto que vía 2->3->4
  })
  it('respeta el tope de profundidad', () => {
    const { dist } = bfs(g, 1, 1)
    expect(dist.get(2)).toBe(1)
    expect(dist.has(3)).toBe(false) // a distancia 2, fuera del tope
  })
  it('no incluye nodos inalcanzables', () => {
    const g2 = new InMemoryGraph({ 1: [2], 2: [], 9: [1] }, { 1: 'A', 2: 'B', 9: 'I' })
    const { dist } = bfs(g2, 1, 10)
    expect(dist.has(9)).toBe(false)
  })
  it('respeta el tope de nodos (maxNodes) y deja de explorar', () => {
    const hub = new InMemoryGraph(
      { 1: [2, 3, 4, 5], 2: [], 3: [], 4: [], 5: [] },
      { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' },
    )
    const { dist } = bfs(hub, 1, 10, 3)
    expect(dist.size).toBe(3) // source + 2 vecinos, luego corta
  })
})

describe('shortestPath', () => {
  it('reconstruye el camino más corto inicio->destino', () => {
    const { prev } = bfs(g, 1, 10)
    expect(shortestPath(prev, 1, 4)).toEqual([1, 5, 4])
  })
  it('devuelve [] si no hay camino', () => {
    const { prev } = bfs(g, 1, 10)
    expect(shortestPath(prev, 1, 999)).toEqual([])
  })
})
