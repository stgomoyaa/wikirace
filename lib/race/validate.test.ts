import { describe, it, expect } from 'vitest'
import { validatePath } from './validate'

// grafo de prueba: title -> enlaces salientes
const GRAPH: Record<string, string[]> = {
  Dog: ['Mammal', 'Wolf'],
  Mammal: ['Animal', 'Cat'],
  Cat: ['Animal'],
}
const linksOf = async (_lang: string, title: string) => GRAPH[title] ?? []

describe('validatePath', () => {
  it('acepta un camino válido inicio→destino', async () => {
    const r = await validatePath('en', ['Dog', 'Mammal', 'Cat'], 'Dog', 'Cat', linksOf)
    expect(r.valid).toBe(true)
  })
  it('rechaza si el primer nodo no es el inicio', async () => {
    const r = await validatePath('en', ['Wolf', 'Cat'], 'Dog', 'Cat', linksOf)
    expect(r).toMatchObject({ valid: false, reason: 'bad_start' })
  })
  it('rechaza si el último nodo no es el destino', async () => {
    const r = await validatePath('en', ['Dog', 'Mammal'], 'Dog', 'Cat', linksOf)
    expect(r).toMatchObject({ valid: false, reason: 'bad_target' })
  })
  it('rechaza si un salto no existe como enlace', async () => {
    const r = await validatePath('en', ['Dog', 'Cat'], 'Dog', 'Cat', linksOf)
    expect(r).toMatchObject({ valid: false, reason: 'broken_link' })
  })
  it('rechaza un camino demasiado corto', async () => {
    const r = await validatePath('en', ['Dog'], 'Dog', 'Dog', linksOf)
    expect(r).toMatchObject({ valid: false, reason: 'too_short' })
  })
})
