import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    race: { findUnique: vi.fn(), update: vi.fn() },
    puzzle: { findUnique: vi.fn() },
    playerRating: { findUnique: vi.fn(), upsert: vi.fn() },
    ratingHistory: { create: vi.fn() },
  },
}))
vi.mock('@/lib/wiki/client', () => ({
  fetchArticle: vi.fn(async (_l: string, title: string) => ({
    title, lang: 'en', html: '', links: { Dog: ['Mammal'], Mammal: ['Cat'] }[title] ?? [],
  })),
}))

import { POST } from './route'
import { db } from '@/lib/db'

const race = {
  id: 'r1', lang: 'en', startTitle: 'Dog', targetTitle: 'Cat', status: 'active',
  startedAt: new Date(Date.now() - 30_000), isRanked: true, puzzleId: 'p1', playerId: 'pl1',
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.race.findUnique as any).mockResolvedValue(race)
  ;(db.puzzle.findUnique as any).mockResolvedValue({ id: 'p1', optimalLen: 2 })
  ;(db.playerRating.findUnique as any).mockResolvedValue({
    playerId: 'pl1', points: 1000, mmr: 1000, placementsDone: 5, shields: 0, winStreak: 0, peakPoints: 1000,
  })
  ;(db.race.update as any).mockImplementation(async ({ data }: any) => ({ ...race, ...data }))
  ;(db.playerRating.upsert as any).mockImplementation(async ({ create, update }: any) => ({ ...create, ...update }))
})

describe('POST /api/ranked/submit', () => {
  it('valida, calcula estrellas y devuelve un cambio de RR', async () => {
    const req = new Request('http://x', { method: 'POST',
      body: JSON.stringify({ raceId: 'r1', path: ['Dog', 'Mammal', 'Cat'] }) })
    const res = await POST(req as any)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.valid).toBe(true)
    expect(json.stars).toBe(3)
    expect(typeof json.rrDelta).toBe('number')
    expect(db.playerRating.upsert).toHaveBeenCalledOnce()
  })

  it('rechaza tiempo imposible', async () => {
    ;(db.race.findUnique as any).mockResolvedValue({ ...race, startedAt: new Date() })
    const req = new Request('http://x', { method: 'POST',
      body: JSON.stringify({ raceId: 'r1', path: ['Dog', 'Mammal', 'Cat'] }) })
    const res = await POST(req as any)
    const json = await res.json()
    expect(json.valid).toBe(false)
    expect(json.reason).toBe('impossible_time')
  })
})
