import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/wiki/client', () => ({
  fetchArticle: vi.fn(),
}))

import { GET } from './route'
import { fetchArticle } from '@/lib/wiki/client'

describe('GET /api/wiki/[lang]/[title]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('no cachea la respuesta saneada para aplicar cambios del sanitizador inmediatamente', async () => {
    vi.mocked(fetchArticle).mockResolvedValue({
      title: 'Dog',
      lang: 'en',
      html: '<section><p>Dog</p></section>',
      links: ['Animal'],
    })

    const response = await GET(
      new NextRequest('http://localhost/api/wiki/en/Dog'),
      { params: Promise.resolve({ lang: 'en', title: 'Dog' }) },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(fetchArticle).toHaveBeenCalledWith('en', 'Dog')
  })
})
