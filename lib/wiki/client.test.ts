import { describe, it, expect, vi } from 'vitest'
import { fetchArticle, REST_BASE } from './client'

const HTML = `<a rel="mw:WikiLink" href="./Dog">dog</a>`

describe('fetchArticle', () => {
  it('pide la URL REST correcta y devuelve título, html y links', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => HTML,
    }) as unknown as typeof fetch

    const article = await fetchArticle('en', 'Cat', fakeFetch)

    expect(fakeFetch).toHaveBeenCalledWith(
      `${REST_BASE('en')}/Cat`,
      expect.any(Object),
    )
    expect(article.title).toBe('Cat')
    expect(article.lang).toBe('en')
    expect(article.links).toEqual(['Dog'])
    expect(article.html).toContain('data-wiki-title="Dog"')
  })

  it('lanza error si la respuesta no es ok', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch
    await expect(fetchArticle('en', 'Nope', fakeFetch)).rejects.toThrow('404')
  })
})
