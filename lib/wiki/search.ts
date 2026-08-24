import { isValidLang } from './lang'

export const SEARCH_LIMIT = 6
export const SEARCH_QUERY_MAX = 120

export async function searchTitles(
  lang: string,
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  if (!isValidLang(lang)) throw new Error(`invalid lang: ${lang}`)

  const normalizedQuery = query.trim()
  if (normalizedQuery.length < 2) return []
  if (normalizedQuery.length > SEARCH_QUERY_MAX) throw new Error('query too long')

  const params = new URLSearchParams({
    action: 'opensearch',
    search: normalizedQuery,
    limit: String(SEARCH_LIMIT),
    namespace: '0',
    format: 'json',
  })
  const response = await fetchImpl(`https://${lang}.wikipedia.org/w/api.php?${params}`, {
    cache: 'no-store',
    headers: { 'User-Agent': 'WikiRace/1.0' },
  })
  if (!response.ok) throw new Error('search failed')

  const payload = await response.json() as unknown
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) return []

  const titles = payload[1].filter((title): title is string => typeof title === 'string' && title.trim().length > 0)
  return [...new Set(titles)].slice(0, SEARCH_LIMIT)
}
