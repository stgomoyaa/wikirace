import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { PID_COOKIE, signPid, parsePid } from '@/lib/player/identity'
import { tierFromPoints } from '@/lib/rank/tiers'
import { rankedSecret } from '@/lib/config'

function difficultyForTier(tier: string): string {
  if (['Iron', 'Bronze', 'Silver'].includes(tier)) return 'easy'
  if (['Gold', 'Platinum'].includes(tier)) return 'medium'
  return 'hard'
}

export async function POST() {
  const secret = rankedSecret()
  const jar = await cookies()
  let playerId = parsePid(jar.get(PID_COOKIE)?.value ?? '', secret)
  if (!playerId) {
    const player = await db.player.create({ data: {} })
    playerId = player.id
    jar.set(PID_COOKIE, signPid(playerId, secret), { httpOnly: true, sameSite: 'lax', path: '/' })
  }

  const rating = await db.playerRating.findUnique({ where: { playerId } })
  const view = tierFromPoints(rating?.points ?? 0)
  const difficulty = difficultyForTier(view.tier)

  const puzzle = await db.puzzle.findFirst({ where: { difficulty, lang: 'en' }, orderBy: { createdAt: 'asc' } })
  if (!puzzle) return NextResponse.json({ error: 'no_puzzles' }, { status: 503 })

  const race = await db.race.create({
    data: { lang: 'en', startTitle: puzzle.startTitle, targetTitle: puzzle.targetTitle, isRanked: true, puzzleId: puzzle.id, playerId },
  })

  return NextResponse.json({
    raceId: race.id, lang: 'en', start: puzzle.startTitle, target: puzzle.targetTitle,
    difficulty, optimalLen: puzzle.optimalLen,
  })
}
