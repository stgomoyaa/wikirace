import { describe, it, expect } from 'vitest'
import { sanitizeArticleHtml } from './sanitize'

const SAMPLE = `
<section>
  <p>
    <a rel="mw:WikiLink" href="./Physics">physics</a> and
    <a rel="mw:WikiLink" href="./Alan_Turing">Turing</a>.
  </p>
  <a rel="mw:WikiLink" href="./File:Logo.png">a file</a>
  <a rel="mw:ExtLink" href="https://example.com">external</a>
  <span class="mw-editsection">[edit]</span>
  <script>alert(1)</script>
</section>`

describe('sanitizeArticleHtml', () => {
  it('extrae solo enlaces internos de artículo', () => {
    const { links } = sanitizeArticleHtml(SAMPLE)
    expect(links).toEqual(['Physics', 'Alan Turing'])
  })
  it('reescribe enlaces internos con data-wiki-title y clase wiki-link', () => {
    const { html } = sanitizeArticleHtml(SAMPLE)
    expect(html).toContain('data-wiki-title="Physics"')
    expect(html).toContain('class="wiki-link"')
  })
  it('elimina scripts y secciones de edición', () => {
    const { html } = sanitizeArticleHtml(SAMPLE)
    expect(html).not.toContain('<script')
    expect(html).not.toContain('mw-editsection')
  })
  it('neutraliza enlaces externos y de otros namespaces (no clickeables)', () => {
    const { html } = sanitizeArticleHtml(SAMPLE)
    expect(html).not.toContain('https://example.com')
    expect(html).not.toContain('File:Logo.png')
  })
})
