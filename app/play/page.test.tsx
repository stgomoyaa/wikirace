import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import PlayPage from './page'

beforeEach(() => {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/race/start') {
      return { ok: true, json: async () => ({ id: 'race-1' }) } as Response
    }
    if (url.includes('/api/wiki/')) {
      return { ok: true, json: async () => ({ html: '<p>Artículo cargado</p>' }) } as Response
    }
    return { ok: false, json: async () => ({}) } as Response
  }) as typeof fetch
})

describe('PlayPage', () => {
  it('activa la carrera solo después de completar origen y destino', async () => {
    render(<PlayPage />)
    const startButton = screen.getByRole('button', { name: 'Empezar carrera' })
    expect(startButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Artículo de origen'), { target: { value: 'Dog' } })
    fireEvent.change(screen.getByLabelText('Artículo de destino'), { target: { value: 'Cat' } })
    expect(startButton).toBeEnabled()

    fireEvent.click(startButton)
    await waitFor(() => expect(screen.getByLabelText('Estado de la carrera')).toBeInTheDocument())
    expect(screen.getByText('Dog')).toBeInTheDocument()
    expect(screen.getByText('Cat')).toBeInTheDocument()
  })

  it('rechaza una carrera con el mismo origen y destino', () => {
    render(<PlayPage />)
    fireEvent.change(screen.getByLabelText('Artículo de origen'), { target: { value: 'Dog' } })
    fireEvent.change(screen.getByLabelText('Artículo de destino'), { target: { value: 'Dog' } })
    fireEvent.click(screen.getByRole('button', { name: 'Empezar carrera' }))

    expect(screen.getByRole('alert')).toHaveTextContent('El origen y el destino deben ser distintos.')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('rechaza títulos que contienen solo espacios', () => {
    render(<PlayPage />)
    fireEvent.change(screen.getByLabelText('Artículo de origen'), { target: { value: '   ' } })
    fireEvent.change(screen.getByLabelText('Artículo de destino'), { target: { value: 'Cat' } })
    fireEvent.click(screen.getByRole('button', { name: 'Empezar carrera' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Completa ambos artículos para empezar.')
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
