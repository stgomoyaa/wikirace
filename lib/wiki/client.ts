import { sanitizeArticleHtml } from './sanitize'
import { normalizeTitle } from './title'
import { isValidLang } from './lang'

export interface WikiArticle {
  title: string
  lang: string
  html: string
  links: string[]
}

export const REST_BASE = (lang: string) =>
  `https://${lang}.wikipedia.org/api/rest_v1/page/html`

/** Trae y sanea un artículo. `fetchImpl` es inyectable para tests. */
export async function fetchArticle(
  lang: string,
  title: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WikiArticle> {
  if (!isValidLang(lang)) throw new Error(`invalid lang: ${lang}`)
  const encoded = encodeURIComponent(title.replace(/ /g, '_'))
  const res = await fetchImpl(`${REST_BASE(lang)}/${encoded}`, {
    headers: { 'User-Agent': 'WikiRace/1.0 (contacto@ejemplo.com)' },
    next: { revalidate: 86400 },
  } as RequestInit)

  if (!res.ok) {
    throw new Error(`Wikipedia fetch failed: ${(res as Response).status}`)
  }

  const raw = await res.text()
  const { html, links } = sanitizeArticleHtml(raw)
  return { title: normalizeTitle(title), lang, html, links }
}
