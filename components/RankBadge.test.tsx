import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RankBadge } from './RankBadge'

describe('RankBadge', () => {
  it('muestra el label del rango cuando terminó placements', () => {
    render(<RankBadge label="Gold II · 45 RR" placementsDone={5} />)
    expect(screen.getByText(/Gold II · 45 RR/)).toBeInTheDocument()
  })
  it('muestra el progreso de placements cuando aún no termina', () => {
    render(<RankBadge label="Iron IV · 0 RR" placementsDone={2} />)
    expect(screen.getByText(/Placements 2\/5/)).toBeInTheDocument()
  })
})
