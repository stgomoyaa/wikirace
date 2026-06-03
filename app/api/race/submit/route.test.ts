import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { race: { findUnique: vi.fn(), update: vi.fn() } },
}))
vi.mock('@/lib/wiki/client', () => ({
  fetchArticle: vi.fn(async (_l: string, title: string) => ({
    title,
    lang: 'en',
    html: '',
    links: { Dog: ['Mammal'], Mammal: ['Cat'] }[title] ?? [],
  })),
}))

import { POST } from './route'
import { db } from '@/lib/db'

const baseRace = {
  id: 'r1',
  lang: 'en',
  startTitle: 'Dog',
  targetTitle: 'Cat',
  status: 'active',
  startedAt: new Date(Date.now() - 5000),
}

describe('POST /api/race/submit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('valida el camino, marca completado y devuelve tiempo y clics', async () => {
    ;(db.race.findUnique as any).mockResolvedValue(baseRace)
    ;(db.race.update as any).mockImplementation(async ({ data }: any) => ({ ...baseRace, ...data }))

    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ raceId: 'r1', path: ['Dog', 'Mammal', 'Cat'] }),
    })
    const res = await POST(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.valid).toBe(true)
    expect(json.clicks).toBe(2)
    expect(json.timeMs).toBeGreaterThan(0)
  })

  it('marca invalid si el camino está roto', async () => {
    ;(db.race.findUnique as any).mockResolvedValue(baseRace)
    ;(db.race.update as any).mockImplementation(async ({ data }: any) => ({ ...baseRace, ...data }))

    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ raceId: 'r1', path: ['Dog', 'Cat'] }),
    })
    const res = await POST(req as any)
    const json = await res.json()
    expect(json.valid).toBe(false)
    expect(json.reason).toBe('broken_link')
  })

  it('404 si la carrera no existe', async () => {
    ;(db.race.findUnique as any).mockResolvedValue(null)
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ raceId: 'x', path: ['Dog', 'Cat'] }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(404)
  })
})
