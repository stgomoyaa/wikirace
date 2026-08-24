import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')

describe('lector editorial de Wikipedia', () => {
  it('cubre las estructuras reales que entrega Wikipedia', () => {
    for (const selector of [
      '.wiki-article .infobox',
      '.wiki-article figure',
      '.wiki-article figcaption',
      '.wiki-article .hatnote',
      '.wiki-article .clade',
      '.wiki-article [data-disabled="true"]',
    ]) {
      expect(css, `falta el selector ${selector}`).toContain(selector)
    }
  })

  it('abandona la paleta copiada lima e índigo', () => {
    expect(css).not.toContain('oklch(0.965 0.125 112)')
    expect(css).not.toContain('oklch(0.37 0.19 272)')
  })

  it('adapta infoboxes y tablas al viewport móvil', () => {
    expect(css).toMatch(/@media[^}]+max-width:[^{]+\{[\s\S]+?\.wiki-article \.infobox[\s\S]+?width:\s*100%/)
    expect(css).toContain('overflow-x: auto')
  })
})
