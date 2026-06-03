import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { race: { create: vi.fn() } },
}))

import { POST } from './route'
import { db } from '@/lib/db'

describe('POST /api/race/start', () => {
  beforeEach(() => vi.clearAllMocks())

  it('crea una carrera y devuelve su id', async () => {
    ;(db.race.create as any).mockResolvedValue({
      id: 'race1',
      startTitle: 'Dog',
      targetTitle: 'Cat',
      lang: 'en',
      startedAt: new Date('2026-06-02T00:00:00Z'),
    })

    const req = new Request('http://x/api/race/start', {
      method: 'POST',
      body: JSON.stringify({ startTitle: 'Dog', targetTitle: 'Cat', lang: 'en' }),
    })
    const res = await POST(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.id).toBe('race1')
    expect(db.race.create).toHaveBeenCalledOnce()
  })

  it('rechaza si faltan títulos', async () => {
    const req = new Request('http://x/api/race/start', {
      method: 'POST',
      body: JSON.stringify({ startTitle: 'Dog' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })
})
