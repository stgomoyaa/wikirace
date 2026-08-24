import { db } from '@/lib/db'
import RaceView from '@/components/RaceView'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ArchiveDaily({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const daily = await db.daily.findUnique({ where: { date } })
  if (!daily) notFound()
  const puzzle = await db.puzzle.findUnique({ where: { id: daily.puzzleId } })
  if (!puzzle) notFound()

  const race = await db.race.create({
    data: { lang: 'en', startTitle: puzzle.startTitle, targetTitle: puzzle.targetTitle, puzzleId: puzzle.id },
  })

  return (
    <div>
      <div className="mode-strip">
        <strong>Daily #{daily.number}</strong>
        <span className="mode-strip__separator">/</span>
        <span>{date}</span>
        <span className="mode-strip__separator">/</span>
        <span>Práctica de archivo</span>
      </div>
      <RaceView raceId={race.id} lang="en" start={puzzle.startTitle} target={puzzle.targetTitle} />
    </div>
  )
}
