import { describe, it, expect } from 'vitest'
import { sanitizeArticleHtml } from './sanitize'

describe('sanitizeArticleHtml: XSS hardening', () => {
  it('quita manejadores de eventos on*', () => {
    const { html } = sanitizeArticleHtml(
      '<a rel="mw:WikiLink" href="./X" onclick="evil()">x</a>',
    )
    expect(html.toLowerCase()).not.toContain('onclick')
  })
  it('elimina iframe/object/embed', () => {
    const { html } = sanitizeArticleHtml(
      '<p>ok</p><iframe src="//evil"></iframe><object data="x"></object><embed src="y">',
    )
    expect(html).not.toContain('<iframe')
    expect(html).not.toContain('<object')
    expect(html).not.toContain('<embed')
  })
  it('neutraliza URLs javascript: en src', () => {
    const { html } = sanitizeArticleHtml('<img src="javascript:alert(1)">')
    expect(html.toLowerCase()).not.toContain('javascript:')
  })
})
