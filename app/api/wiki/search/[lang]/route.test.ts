import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/wiki/search', () => ({
  searchTitles: vi.fn(),
  SEARCH_QUERY_MAX: 120,
}))

import { GET } from './route'
import { searchTitles } from '@/lib/wiki/search'

describe('GET /api/wiki/search/[lang]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('devuelve sugerencias sin cachear la respuesta', async () => {
    vi.mocked(searchTitles).mockResolvedValue(['Chil', 'Chile', 'Chilevisión'])
    const response = await GET(
      new NextRequest('http://localhost/api/wiki/search/es?q=chil'),
      { params: Promise.resolve({ lang: 'es' }) },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({ suggestions: ['Chil', 'Chile', 'Chilevisión'] })
    expect(searchTitles).toHaveBeenCalledWith('es', 'chil')
  })

  it('responde vacío sin consultar con menos de dos caracteres', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/wiki/search/es?q=c'),
      { params: Promise.resolve({ lang: 'es' }) },
    )
    await expect(response.json()).resolves.toEqual({ suggestions: [] })
    expect(searchTitles).not.toHaveBeenCalled()
  })

  it('rechaza idiomas inseguros y queries demasiado largas', async () => {
    const invalidLang = await GET(
      new NextRequest('http://localhost/api/wiki/search/es.evil.com?q=chile'),
      { params: Promise.resolve({ lang: 'es.evil.com' }) },
    )
    const longQuery = await GET(
      new NextRequest(`http://localhost/api/wiki/search/es?q=${'x'.repeat(121)}`),
      { params: Promise.resolve({ lang: 'es' }) },
    )
    expect(invalidLang.status).toBe(400)
    expect(longQuery.status).toBe(400)
  })
})
