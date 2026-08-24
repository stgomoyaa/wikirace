import { parse } from 'node-html-parser'
import { normalizeTitle } from './title'

export interface SanitizeResult {
  html: string
  links: string[]
}

const KILL_SELECTORS = [
  'script',
  'style',
  '.mw-editsection',
  'link',
  'meta',
  'iframe',
  'object',
  'embed',
  '.navbox',
  '.vertical-navbox',
  '.navbox-styles',
  '.mw-references-wrap',
  'ol.references',
  '.reference',
  '.reflist',
  '.authority-control',
  '.portal-bar',
  '.metadata',
  '.sistersitebox',
  '.side-box',
  '.collapsible-list',
  '.taxobox-edit-taxonomy',
  '.mw-empty-elt',
  '.noprint',
]

/** Sanea el HTML de un artículo de Wikipedia y extrae sus enlaces internos. */
export function sanitizeArticleHtml(raw: string): SanitizeResult {
  const root = parse(raw, { comment: false })

  for (const sel of KILL_SELECTORS) {
    root.querySelectorAll(sel).forEach((el) => el.remove())
  }

  for (const infobox of root.querySelectorAll('.infobox')) {
    for (const row of infobox.querySelectorAll('tr')) {
      if (!row.text.trim() && !row.querySelector('img')) row.remove()
    }
    const remainingRows = infobox.querySelectorAll('tr')
    const lastRow = remainingRows[remainingRows.length - 1]
    if (lastRow?.querySelector('th[colspan]') && !lastRow.querySelector('td')) lastRow.remove()
  }

  // Defensa XSS: quita manejadores de eventos (on*) y URLs javascript: de todos
  // los elementos antes de procesar los enlaces.
  for (const el of root.querySelectorAll('*')) {
    for (const name of Object.keys(el.attributes)) {
      const lower = name.toLowerCase()
      if (lower === 'style' || lower.startsWith('on')) {
        el.removeAttribute(name)
      } else if (
        (lower === 'href' || lower === 'src' || lower === 'xlink:href') &&
        /javascript:/i.test(el.getAttribute(name) ?? '')
      ) {
        el.removeAttribute(name)
      }
    }
  }

  const links: string[] = []
  const seen = new Set<string>()

  for (const a of root.querySelectorAll('a')) {
    const href = a.getAttribute('href') ?? ''
    const isInternal = href.startsWith('./') && !href.slice(2).includes(':')
    if (isInternal) {
      const title = normalizeTitle(href)
      a.setAttribute('data-wiki-title', title)
      const existingClass = a.getAttribute('class')?.trim()
      a.setAttribute('class', existingClass ? `${existingClass} wiki-link` : 'wiki-link')
      a.removeAttribute('href')
      a.removeAttribute('rel')
      if (!seen.has(title)) {
        seen.add(title)
        links.push(title)
      }
    } else {
      // externo o de otro namespace: neutralizar
      a.removeAttribute('href')
      a.removeAttribute('rel')
      a.setAttribute('data-disabled', 'true')
    }
  }

  const body = root.querySelector('body')
  return { html: body ? body.innerHTML : root.toString(), links }
}
