import { describe, it, expect } from 'vitest'
import { isValidLang } from './lang'

describe('isValidLang', () => {
  it('acepta códigos de idioma válidos', () => {
    expect(isValidLang('en')).toBe(true)
    expect(isValidLang('es')).toBe(true)
    expect(isValidLang('simple')).toBe(true)
    expect(isValidLang('pt-br')).toBe(true)
  })
  it('rechaza intentos de SSRF / hostnames', () => {
    expect(isValidLang('en.evil.com')).toBe(false)
    expect(isValidLang('en/x')).toBe(false)
    expect(isValidLang('../secret')).toBe(false)
    expect(isValidLang('a@b')).toBe(false)
  })
  it('rechaza vacío, demasiado corto o demasiado largo', () => {
    expect(isValidLang('')).toBe(false)
    expect(isValidLang('a')).toBe(false)
    expect(isValidLang('x'.repeat(20))).toBe(false)
  })
  it('rechaza no-strings', () => {
    expect(isValidLang(undefined)).toBe(false)
    expect(isValidLang(123)).toBe(false)
  })
})
