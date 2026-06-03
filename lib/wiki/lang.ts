// Subdominios de idioma de Wikipedia: letras, dígitos y guiones (en, es, simple,
// pt-br, zh-classical…). Sin puntos / barras / @ para evitar SSRF al construir la URL.
const LANG_RE = /^[a-z][a-z0-9-]{1,11}$/i

export function isValidLang(lang: unknown): lang is string {
  return typeof lang === 'string' && LANG_RE.test(lang)
}
