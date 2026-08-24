import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { race: { findUnique: vi.fn(), update: vi.fn() } },
}))
vi.mock('@/lib/wiki/client', () => ({
  fetchArticle: vi.fn(),
}))

import { POST } from './route'
import { db } from '@/lib/db'
import { fetchArticle } from '@/lib/wiki/client'

describe('POST /api/race/submit: DoS hardening', () => {
  it('rechaza un path sobredimensionado con 400 sin tocar DB ni red', async () => {
    const huge = Array.from({ length: 5000 }, (_, i) => `A${i}`)
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ raceId: 'r1', path: huge }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
    expect(db.race.findUnique).not.toHaveBeenCalled()
    expect(fetchArticle).not.toHaveBeenCalled()
  })

  it('rechaza elementos no-string en el path con 400', async () => {
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ raceId: 'r1', path: ['Dog', 123, 'Cat'] }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })
})
