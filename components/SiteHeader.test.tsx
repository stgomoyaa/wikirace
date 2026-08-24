import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SiteHeader } from './SiteHeader'

describe('SiteHeader', () => {
  it('expone todos los modos desde cualquier página', () => {
    render(<SiteHeader />)

    expect(screen.getByRole('link', { name: 'WikiRace, ir al inicio' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Daily' })).toHaveAttribute('href', '/daily')
    expect(screen.getByRole('link', { name: 'Práctica' })).toHaveAttribute('href', '/play')
    expect(screen.getByRole('link', { name: 'Ranked' })).toHaveAttribute('href', '/ranked')
    expect(screen.getByRole('link', { name: 'Archivo' })).toHaveAttribute('href', '/archive')
  })
})