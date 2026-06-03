import { describe, it, expect } from 'vitest'
import { generatePuzzles } from './generate'
import { InMemoryGraph } from '@/lib/graph/testGraph'

// Cadena 1->2->3->4->5->6 : distancias desde 1 son 1..5
function chain(starts: number[]) {
  return new InMemoryGraph(
    { 1: [2], 2: [3], 3: [4], 4: [5], 5: [6], 6: [] },
    { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F' },
    starts,
  )
}

describe('generatePuzzles', () => {
  it('emite un puzzle por tier con el largo óptimo correcto', () => {
    const out = generatePuzzles(chain([1]), {
      lang: 'en',
      minInDegree: 1,
      perTier: { easy: 1, medium: 1, hard: 1 },
      maxStarts: 1,
    })
    const byLen = Object.fromEntries(out.map((p) => [p.optimalLen, p]))
    expect(byLen[3].difficulty).toBe('easy')
    expect(byLen[3]).toMatchObject({ startTitle: 'A', targetTitle: 'D' })
    expect(byLen[4].difficulty).toBe('medium')
    expect(byLen[5].difficulty).toBe('hard')
    expect(byLen[3].shortestPath).toEqual(['A', 'B', 'C', 'D'])
  })

  it('respeta el filtro de in-degree (devuelve vacío si nada lo pasa)', () => {
    const out = generatePuzzles(chain([1]), {
      lang: 'en',
      minInDegree: 2, // en la cadena todos tienen in-degree 1
      perTier: { easy: 1, medium: 1, hard: 1 },
      maxStarts: 1,
    })
    expect(out).toEqual([])
  })

  it('no duplica pares aunque se reintente el mismo start', () => {
    const out = generatePuzzles(chain([1, 1, 1]), {
      lang: 'en',
      minInDegree: 1,
      perTier: { easy: 5, medium: 5, hard: 5 },
      maxStarts: 3,
    })
    const keys = out.map((p) => `${p.startTitle}->${p.targetTitle}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('nunca genera start == target', () => {
    const out = generatePuzzles(chain([1]), {
      lang: 'en',
      minInDegree: 1,
      perTier: { easy: 9, medium: 9, hard: 9 },
      maxStarts: 1,
    })
    expect(out.every((p) => p.startTitle !== p.targetTitle)).toBe(true)
  })
})
