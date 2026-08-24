import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import PlayPage from './page'

beforeEach(() => {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/api/wiki/search/')) {
      return { ok: true, json: async () => ({ suggestions: ['Chile', 'Chilevisión'] }) } as Response
    }
    if (url.includes('/api/wiki/random/')) {
      return { ok: true, json: async () => ({ title: 'Artículo aleatorio' }) } as Response
    }
    if (url === '/api/race/start') {
      const body = JSON.parse(String(init?.body))
      return { ok: true, json: async () => ({ id: 'race-1', lang: body.lang }) } as Response
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
    expect(screen.getByLabelText('Idioma de Wikipedia')).toHaveValue('es')
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

  it('envía el idioma elegido al crear la carrera', async () => {
    render(<PlayPage />)
    fireEvent.change(screen.getByLabelText('Idioma de Wikipedia'), { target: { value: 'en' } })
    fireEvent.change(screen.getByLabelText('Artículo de origen'), { target: { value: 'Dog' } })
    fireEvent.change(screen.getByLabelText('Artículo de destino'), { target: { value: 'Cat' } })
    fireEvent.click(screen.getByRole('button', { name: 'Empezar carrera' }))

    await waitFor(() => expect(screen.getByLabelText('Estado de la carrera')).toBeInTheDocument())
    const startCall = vi.mocked(global.fetch).mock.calls.find(([url]) => String(url) === '/api/race/start')
    expect(startCall).toBeDefined()
    expect(JSON.parse(String(startCall?.[1]?.body))).toMatchObject({ lang: 'en' })
    expect(global.fetch).toHaveBeenCalledWith('/api/wiki/en/Dog')
  })

  it('usa el idioma elegido al pedir un artículo aleatorio', async () => {
    render(<PlayPage />)
    fireEvent.change(screen.getByLabelText('Idioma de Wikipedia'), { target: { value: 'pt' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Aleatorio' })[0])

    await waitFor(() => expect(screen.getByLabelText('Artículo de origen')).toHaveValue('Artículo aleatorio'))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wiki/random/pt',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('ignora un artículo aleatorio pendiente cuando cambia el idioma', async () => {
    let resolveRandom!: (value: Response) => void
    global.fetch = vi.fn(() => new Promise<Response>((resolve) => { resolveRandom = resolve })) as typeof fetch
    render(<PlayPage />)
    fireEvent.change(screen.getByLabelText('Idioma de Wikipedia'), { target: { value: 'pt' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Aleatorio' })[0])
    const signal = vi.mocked(global.fetch).mock.calls[0][1]?.signal as AbortSignal

    fireEvent.change(screen.getByLabelText('Idioma de Wikipedia'), { target: { value: 'en' } })
    expect(signal.aborted).toBe(true)
    await act(async () => resolveRandom({ ok: true, json: async () => ({ title: 'Brasil' }) } as Response))
    expect(screen.getByLabelText('Artículo de origen')).toHaveValue('')
  })

  it('solo aplica la solicitud aleatoria más reciente', async () => {
    const resolvers: Array<(value: Response) => void> = []
    global.fetch = vi.fn(() => new Promise<Response>((resolve) => { resolvers.push(resolve) })) as typeof fetch
    render(<PlayPage />)
    const randomButtons = screen.getAllByRole('button', { name: 'Aleatorio' })
    fireEvent.click(randomButtons[0])
    const firstSignal = vi.mocked(global.fetch).mock.calls[0][1]?.signal as AbortSignal
    fireEvent.click(randomButtons[1])
    expect(firstSignal.aborted).toBe(true)

    await act(async () => resolvers[0]({ ok: true, json: async () => ({ title: 'Viejo' }) } as Response))
    expect(screen.getByLabelText('Artículo de origen')).toHaveValue('')
    await act(async () => resolvers[1]({ ok: true, json: async () => ({ title: 'Nuevo' }) } as Response))
    await waitFor(() => expect(screen.getByLabelText('Artículo de destino')).toHaveValue('Nuevo'))
  })

  it('bloquea idioma y campos mientras inicia la carrera', async () => {
    let resolveStart!: (value: Response) => void
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === '/api/race/start') {
        return new Promise<Response>((resolve) => { resolveStart = resolve })
      }
      return Promise.resolve({ ok: true, json: async () => ({ suggestions: [] }) } as Response)
    }) as typeof fetch
    render(<PlayPage />)
    fireEvent.change(screen.getByLabelText('Artículo de origen'), { target: { value: 'Perro' } })
    fireEvent.change(screen.getByLabelText('Artículo de destino'), { target: { value: 'Chile' } })
    fireEvent.click(screen.getByRole('button', { name: 'Empezar carrera' }))

    expect(screen.getByLabelText('Idioma de Wikipedia')).toBeDisabled()
    expect(screen.getByLabelText('Artículo de origen')).toBeDisabled()
    expect(screen.getByLabelText('Artículo de destino')).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Aleatorio' }).every((button) => button.hasAttribute('disabled'))).toBe(true)

    await act(async () => resolveStart({ ok: true, json: async () => ({ id: 'race-1', lang: 'es' }) } as Response))
    await waitFor(() => expect(screen.getByLabelText('Estado de la carrera')).toBeInTheDocument())
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
