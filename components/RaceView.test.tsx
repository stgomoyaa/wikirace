import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RaceView from './RaceView'

beforeEach(() => {
  global.fetch = vi.fn(async (url: any) => {
    const u = String(url)
    if (u.includes('/api/wiki/')) {
      const title = decodeURIComponent(u.split('/').pop()!)
      const html =
        title === 'Dog'
          ? '<a class="wiki-link" data-wiki-title="Cat">go to cat</a>'
          : '<p>Cat article</p>'
      return { ok: true, json: async () => ({ title, lang: 'en', html, links: [] }) } as any
    }
    if (u.includes('/api/race/submit')) {
      return { ok: true, json: async () => ({ valid: true, timeMs: 1234, clicks: 1 }) } as any
    }
    return { ok: false } as any
  }) as any
})

describe('RaceView', () => {
  it('renderiza el artículo inicial y el destino', async () => {
    render(<RaceView raceId="r1" lang="en" start="Dog" target="Cat" />)
    await waitFor(() => expect(screen.getByText('go to cat')).toBeInTheDocument())
    expect(screen.getByText(/Cat/)).toBeInTheDocument()
  })

  it('al clickear un enlace interno avanza y al llegar al destino muestra el resultado', async () => {
    render(<RaceView raceId="r1" lang="en" start="Dog" target="Cat" />)
    const link = await screen.findByText('go to cat')
    fireEvent.click(link)
    await waitFor(() => expect(screen.getByText(/Llegaste al destino/)).toBeInTheDocument())
  })
})
