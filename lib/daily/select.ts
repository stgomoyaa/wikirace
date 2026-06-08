export interface DailyRow { date: string; number: number; puzzleId: string; difficulty: string }

interface DailyDb {
  daily: {
    findUnique(args: { where: { date: string } }): Promise<DailyRow | null>
    create(args: { data: DailyRow }): Promise<DailyRow>
  }
  puzzle: {
    findFirst(args: unknown): Promise<{ id: string } | null>
    updateMany(args: unknown): Promise<{ count: number }>
  }
}

export async function getOrAssignDaily(
  db: DailyDb, date: string, number: number, difficulty: string,
): Promise<DailyRow> {
  const existing = await db.daily.findUnique({ where: { date } })
  if (existing) return existing
  const puzzle = await db.puzzle.findFirst({
    where: { status: 'available', difficulty, lang: 'en' }, orderBy: { createdAt: 'asc' },
  })
  if (!puzzle) throw new Error('no_puzzles')
  try {
    const created = await db.daily.create({ data: { date, number, puzzleId: puzzle.id, difficulty } })
    await db.puzzle.updateMany({ where: { id: puzzle.id }, data: { status: 'assigned', type: 'daily' } })
    return created
  } catch (e) {
    const winner = await db.daily.findUnique({ where: { date } })
    if (winner) return winner
    throw e
  }
}
