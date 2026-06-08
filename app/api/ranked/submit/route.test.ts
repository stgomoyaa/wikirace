import { describe, it, expect, vi, beforeEach } from 'vitest'
import { signPid, PID_COOKIE } from '@/lib/player/identity'

vi.mock('@/lib/db', () => ({
  db: {
    race: { findUnique: vi.fn(), updateMany: vi.fn() },
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

// Cookie firmada válida del dueño (pl1) con el secreto de dev.
const ownerCookie = `${PID_COOKIE}=${signPid('pl1', 'dev-secret')}`

function reqWith(path: string[], cookie: string | null = ownerCookie) {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = cookie
  return new Request('http://x', { method: 'POST', headers, body: JSON.stringify({ raceId: 'r1', path }) })
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.race.findUnique as any).mockResolvedValue(race)
  ;(db.puzzle.findUnique as any).mockResolvedValue({ id: 'p1', optimalLen: 2 })
  ;(db.playerRating.findUnique as any).mockResolvedValue({
    playerId: 'pl1', points: 1000, mmr: 1000, placementsDone: 5, shields: 0, winStreak: 0, peakPoints: 1000,
  })
  ;(db.race.updateMany as any).mockResolvedValue({ count: 1 })
  ;(db.playerRating.upsert as any).mockImplementation(async ({ create, update }: any) => ({ ...create, ...update }))
})

describe('POST /api/ranked/submit', () => {
  it('valida, calcula estrellas y devuelve un cambio de RR', async () => {
    const res = await POST(reqWith(['Dog', 'Mammal', 'Cat']) as any)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.valid).toBe(true)
    expect(json.stars).toBe(3)
    expect(typeof json.rrDelta).toBe('number')
    expect(db.playerRating.upsert).toHaveBeenCalledOnce()
  })

  it('rechaza con 403 si la cookie no es del dueño', async () => {
    const res = await POST(reqWith(['Dog', 'Mammal', 'Cat'], `${PID_COOKIE}=${signPid('otro', 'dev-secret')}`) as any)
    expect(res.status).toBe(403)
    expect(db.race.updateMany).not.toHaveBeenCalled()
  })

  it('rechaza con 403 si no hay cookie', async () => {
    const res = await POST(reqWith(['Dog', 'Mammal', 'Cat'], null) as any)
    expect(res.status).toBe(403)
  })

  it('rechaza tiempo imposible', async () => {
    ;(db.race.findUnique as any).mockResolvedValue({ ...race, startedAt: new Date() })
    const res = await POST(reqWith(['Dog', 'Mammal', 'Cat']) as any)
    const json = await res.json()
    expect(json.valid).toBe(false)
    expect(json.reason).toBe('impossible_time')
  })

  it('devuelve 409 si otro submit ya reclamó la carrera (claim atómico)', async () => {
    ;(db.race.updateMany as any).mockResolvedValue({ count: 0 })
    const res = await POST(reqWith(['Dog', 'Mammal', 'Cat']) as any)
    expect(res.status).toBe(409)
    expect(db.playerRating.upsert).not.toHaveBeenCalled()
  })
})
