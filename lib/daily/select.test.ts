import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getOrAssignDaily } from './select'

const db: any = {
  daily: { findUnique: vi.fn(), create: vi.fn() },
  puzzle: { findFirst: vi.fn(), updateMany: vi.fn() },
}
beforeEach(() => vi.clearAllMocks())

describe('getOrAssignDaily', () => {
  it('devuelve el daily existente si ya está asignado', async () => {
    db.daily.findUnique.mockResolvedValue({ date: '2026-06-08', number: 8, puzzleId: 'p1', difficulty: 'easy' })
    const d = await getOrAssignDaily(db, '2026-06-08', 8, 'easy')
    expect(d.puzzleId).toBe('p1')
    expect(db.puzzle.findFirst).not.toHaveBeenCalled()
  })
  it('asigna un puzzle disponible si no hay daily para la fecha', async () => {
    db.daily.findUnique.mockResolvedValueOnce(null)
    db.puzzle.findFirst.mockResolvedValue({ id: 'p2' })
    db.daily.create.mockResolvedValue({ date: '2026-06-08', number: 8, puzzleId: 'p2', difficulty: 'easy' })
    const d = await getOrAssignDaily(db, '2026-06-08', 8, 'easy')
    expect(d.puzzleId).toBe('p2')
    expect(db.daily.create).toHaveBeenCalled()
  })
  it('si create falla por carrera (unique), devuelve el daily ya creado', async () => {
    db.daily.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ date: '2026-06-08', number: 8, puzzleId: 'pX', difficulty: 'easy' })
    db.puzzle.findFirst.mockResolvedValue({ id: 'p2' })
    db.daily.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }))
    const d = await getOrAssignDaily(db, '2026-06-08', 8, 'easy')
    expect(d.puzzleId).toBe('pX')
  })
  it('lanza si no hay puzzles disponibles', async () => {
    db.daily.findUnique.mockResolvedValue(null)
    db.puzzle.findFirst.mockResolvedValue(null)
    await expect(getOrAssignDaily(db, '2026-06-08', 8, 'easy')).rejects.toThrow('no_puzzles')
  })
})
