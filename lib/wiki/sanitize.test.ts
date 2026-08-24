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
  it('reescribe enlaces internos con data-wiki-title y conserva sus clases visuales', () => {
    const { html } = sanitizeArticleHtml(
      '<a class="mw-file-description" rel="mw:WikiLink" href="./Physics">physics</a>',
    )
    expect(html).toContain('data-wiki-title="Physics"')
    expect(html).toContain('class="mw-file-description wiki-link"')
  })
  it('elimina navegación, referencias y metadata que alargan el artículo sin aportar a la carrera', () => {
    const { html } = sanitizeArticleHtml(`
      <section><p>Contenido útil</p></section>
      <table class="infobox"><tr><td>Ficha útil</td></tr>
        <tr><th colspan="2">Synonyms</th></tr>
        <tr><td colspan="2"><div class="collapsible-list"><ul><li>Detalle colapsado sin JavaScript</li></ul></div></td></tr>
      </table>
      <sup class="mw-ref reference">[1]</sup>
      <ol class="references"><li>Fuente extensa</li></ol>
      <table class="navbox"><tr><td>Navegación masiva</td></tr></table>
      <div class="authority-control">Identificadores</div>
      <div class="collapsible-list"><ul><li>Detalle colapsado sin JavaScript</li></ul></div>
      <span class="taxobox-edit-taxonomy">Edit this classification</span>
    `)
    expect(html).toContain('Contenido útil')
    expect(html).toContain('Ficha útil')
    expect(html).not.toContain('Synonyms')
    expect(html).not.toContain('Fuente extensa')
    expect(html).not.toContain('Navegación masiva')
    expect(html).not.toContain('Identificadores')
    expect(html).not.toContain('Detalle colapsado sin JavaScript')
    expect(html).not.toContain('Edit this classification')
  })
  it('elimina estilos inline de Wikipedia para que el lector controle la presentación', () => {
    const { html } = sanitizeArticleHtml(
      '<table class="infobox" style="background:#eee;width:300px"><tr><td style="text-align:center">Ficha</td></tr></table>',
    )
    expect(html).toContain('class="infobox"')
    expect(html).not.toContain('style=')
  })
  it('extrae solo el contenido del body cuando Wikipedia entrega un documento completo', () => {
    const { html } = sanitizeArticleHtml(`<!DOCTYPE html>
      <html><head><base href="//en.wikipedia.org/wiki/"><title>Dog</title></head>
      <body class="mw-parser-output"><section><p>Contenido del artículo</p></section></body></html>`)
    expect(html).toContain('<section><p>Contenido del artículo</p></section>')
    expect(html).not.toContain('<!DOCTYPE')
    expect(html).not.toContain('<html')
    expect(html).not.toContain('<head')
    expect(html).not.toContain('<body')
    expect(html).not.toContain('<base')
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
