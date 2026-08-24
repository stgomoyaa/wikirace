import { describe, expect, it, vi } from 'vitest'
import { searchTitles } from './search'

describe('searchTitles', () => {
  it('consulta artículos del idioma elegido y devuelve títulos únicos', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        'chil',
        ['Chil', 'Chile', 'Chile', 'Chilevisión'],
        [],
        [],
      ],
    })

    const suggestions = await searchTitles('es', '  chil  ', fakeFetch as unknown as typeof fetch)

    expect(suggestions).toEqual(['Chil', 'Chile', 'Chilevisión'])
    const url = String(fakeFetch.mock.calls[0][0])
    expect(url).toContain('https://es.wikipedia.org/w/api.php?')
    expect(url).toContain('action=opensearch')
    expect(url).toContain('namespace=0')
    expect(url).toContain('limit=6')
    expect(url).toContain('search=chil')
  })

  it('no consulta Wikipedia con menos de dos caracteres', async () => {
    const fakeFetch = vi.fn()
    await expect(searchTitles('es', 'c', fakeFetch as unknown as typeof fetch)).resolves.toEqual([])
    expect(fakeFetch).not.toHaveBeenCalled()
  })

  it('rechaza idiomas inseguros y consultas demasiado largas', async () => {
    await expect(searchTitles('es.evil.com', 'chile')).rejects.toThrow('invalid lang')
    await expect(searchTitles('es', 'x'.repeat(121))).rejects.toThrow('query too long')
  })
})
