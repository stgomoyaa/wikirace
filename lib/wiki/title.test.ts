import { describe, it, expect } from 'vitest'
import { normalizeTitle, titlesEqual } from './title'

describe('normalizeTitle', () => {
  it('convierte guiones bajos a espacios y recorta', () => {
    expect(normalizeTitle('Albert_Einstein ')).toBe('Albert Einstein')
  })
  it('decodifica porcentajes', () => {
    expect(normalizeTitle('Caf%C3%A9')).toBe('Café')
  })
  it('quita el prefijo ./ de enlaces REST', () => {
    expect(normalizeTitle('./Alan_Turing')).toBe('Alan Turing')
  })
})

describe('titlesEqual', () => {
  it('compara ignorando mayúscula inicial y separadores', () => {
    expect(titlesEqual('alan_Turing', 'Alan Turing')).toBe(true)
  })
  it('distingue títulos diferentes', () => {
    expect(titlesEqual('Dog', 'Cat')).toBe(false)
  })
})
