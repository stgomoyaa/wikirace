import { describe, it, expect, vi } from 'vitest'
import { randomTitle } from './random'

describe('randomTitle', () => {
  it('devuelve el título que entrega la API de Wikipedia', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ query: { random: [{ title: 'Alan Turing' }] } }),
    }) as unknown as typeof fetch
    const t = await randomTitle('en', fakeFetch)
    expect(t).toBe('Alan Turing')
  })
})
