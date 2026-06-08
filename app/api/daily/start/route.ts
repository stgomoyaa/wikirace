import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { PID_COOKIE, signPid, parsePid } from '@/lib/player/identity'
import { rankedSecret } from '@/lib/config'
import { dailyNumber, difficultyForDate, utcDateString } from '@/lib/daily/number'
import { getOrAssignDaily } from '@/lib/daily/select'

export async function POST() {
  const secret = rankedSecret()
  const jar = await cookies()
  let playerId = parsePid(jar.get(PID_COOKIE)?.value ?? '', secret)
  if (!playerId) {
    const player = await db.player.create({ data: {} })
    playerId = player.id
    jar.set(PID_COOKIE, signPid(playerId, secret), { httpOnly: true, sameSite: 'lax', path: '/' })
  }

  const now = new Date()
  const date = utcDateString(now)
  const number = dailyNumber(now)
  const difficulty = difficultyForDate(now)

  let daily
  try {
    daily = await getOrAssignDaily(db, date, number, difficulty)
  } catch {
    return NextResponse.json({ error: 'no_puzzles' }, { status: 503 })
  }

  const puzzle = await db.puzzle.findUnique({ where: { id: daily.puzzleId } })
  if (!puzzle) return NextResponse.json({ error: 'no_puzzles' }, { status: 503 })

  const done = await db.race.findFirst({
    where: { playerId, puzzleId: daily.puzzleId, isDaily: true, status: 'completed' },
  })
  if (done) {
    return NextResponse.json({
      alreadyPlayed: true, number, date,
      start: puzzle.startTitle, target: puzzle.targetTitle, optimalLen: puzzle.optimalLen,
    })
  }

  let race = await db.race.findFirst({
    where: { playerId, puzzleId: daily.puzzleId, isDaily: true, status: 'active' },
  })
  if (!race) {
    try {
      race = await db.race.create({
        data: {
          lang: 'en', startTitle: puzzle.startTitle, targetTitle: puzzle.targetTitle,
          isRanked: true, isDaily: true, puzzleId: puzzle.id, playerId,
        },
      })
    } catch {
      race = await db.race.findFirst({
        where: { playerId, puzzleId: daily.puzzleId, isDaily: true },
      })
    }
  }
  if (!race) return NextResponse.json({ error: 'conflict' }, { status: 409 })

  return NextResponse.json({
    raceId: race.id, number, date, difficulty,
    start: puzzle.startTitle, target: puzzle.targetTitle, optimalLen: puzzle.optimalLen,
  })
}
