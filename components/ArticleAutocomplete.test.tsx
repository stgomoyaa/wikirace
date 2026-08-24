import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ArticleAutocomplete } from './ArticleAutocomplete'

function Harness({ lang = 'es' }: { lang?: string }) {
  const [value, setValue] = useState('')
  return (
    <ArticleAutocomplete
      id="start-title"
      label="Artículo de origen"
      lang={lang}
      value={value}
      onChange={setValue}
      onRandom={vi.fn()}
      placeholder="Ejemplo: Perro"
    />
  )
}

function ExternalValueHarness() {
  const [value, setValue] = useState('')
  return (
    <>
      <button type="button" onClick={() => setValue('Artículo aleatorio')}>Set external value</button>
      <ArticleAutocomplete
        id="external-title"
        label="Artículo"
        lang="es"
        value={value}
        onChange={setValue}
        onRandom={vi.fn()}
        placeholder="Ejemplo"
      />
    </>
  )
}

describe('ArticleAutocomplete', () => {
  it('busca en el idioma elegido y permite seleccionar con teclado', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: ['Chil', 'Chile', 'Chilevisión'] }),
    }) as typeof fetch

    render(<Harness lang="es" />)
    const input = screen.getByRole('combobox', { name: 'Artículo de origen' })
    expect(input).toHaveAttribute('aria-haspopup', 'listbox')
    fireEvent.change(input, { target: { value: 'chil' } })

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/wiki/search/es?q=chil',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ))
    expect(await screen.findByRole('option', { name: 'Chile' })).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input).toHaveValue('Chile')
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('no busca hasta que hay dos caracteres', async () => {
    global.fetch = vi.fn() as typeof fetch
    render(<Harness />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'c' } })
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('no abre sugerencias cuando el valor llega desde Aleatorio', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: ['Chile', 'Chilevisión'] }),
    }) as typeof fetch
    render(<ExternalValueHarness />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'chi' } })
    expect(await screen.findByRole('option', { name: 'Chile' })).toBeInTheDocument()
    vi.mocked(global.fetch).mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Set external value' }))
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(input).toHaveValue('Artículo aleatorio')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
