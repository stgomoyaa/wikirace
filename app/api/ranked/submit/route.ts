import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchArticle } from '@/lib/wiki/client'
import { validatePath, LinksOf } from '@/lib/race/validate'
import { isImpossibleTime } from '@/lib/race/token'
import { starsFor } from '@/lib/score/stars'
import { parMs } from '@/lib/rank/par'
import { computeRrChange } from '@/lib/rank/elo'
import { applyResult, RatingState } from '@/lib/rank/progress'
import { pidFromCookieHeader } from '@/lib/player/identity'
import { rankedSecret } from '@/lib/config'

const MAX_PATH = 50

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { raceId, path } = body as { raceId?: string; path?: string[] }
  if (
    typeof raceId !== 'string' || !Array.isArray(path) ||
    path.length < 2 || path.length > MAX_PATH ||
    !path.every((p) => typeof p === 'string' && p.length > 0 && p.length <= 300)
  ) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const race = await db.race.findUnique({ where: { id: raceId } })
  if (!race || !race.isRanked) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Autorización: sólo el dueño de la carrera puede enviarla (antes de cualquier cambio de estado).
  const caller = pidFromCookieHeader(req.headers.get('cookie'), rankedSecret())
  if (!caller || caller !== race.playerId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  if (race.status !== 'active') return NextResponse.json({ error: 'already_submitted' }, { status: 409 })

  const timeMs = Date.now() - new Date(race.startedAt).getTime()
  const clicks = path.length - 1

  /** Reclama atómicamente la carrera (sólo si sigue 'active'). Devuelve true si ganó la carrera. */
  async function claim(data: Record<string, unknown>): Promise<boolean> {
    const r = await db.race.updateMany({ where: { id: raceId, status: 'active' }, data })
    return r.count === 1
  }

  if (isImpossibleTime(timeMs, clicks)) {
    if (!(await claim({ status: 'invalid', valid: false }))) {
      return NextResponse.json({ error: 'already_submitted' }, { status: 409 })
    }
    return NextResponse.json({ valid: false, reason: 'impossible_time' })
  }

  const linksOf: LinksOf = async (lang, title) => (await fetchArticle(lang, title)).links
  let result
  try {
    result = await validatePath(race.lang, path, race.startTitle, race.targetTitle, linksOf)
  } catch {
    return NextResponse.json({ error: 'validation_error' }, { status: 400 })
  }

  if (!result.valid) {
    if (!(await claim({ status: 'invalid', valid: false, timeMs, clicks, path: JSON.stringify(path) }))) {
      return NextResponse.json({ error: 'already_submitted' }, { status: 409 })
    }
    return NextResponse.json({ valid: false, reason: result.reason })
  }

  const puzzle = race.puzzleId ? await db.puzzle.findUnique({ where: { id: race.puzzleId } }) : null
  const optimalLen = puzzle?.optimalLen ?? clicks
  const stars = starsFor(clicks, optimalLen)

  const rating = (await db.playerRating.findUnique({ where: { playerId: race.playerId! } })) ?? {
    playerId: race.playerId!, points: 0, mmr: 1000, placementsDone: 0, shields: 0, winStreak: 0, peakPoints: 0,
  }

  const change = computeRrChange({
    timeMs, parMs: parMs(optimalLen), stars, points: rating.points, mmr: rating.mmr,
    isPlacement: rating.placementsDone < 5, winStreak: rating.winStreak,
  })

  const state: RatingState = {
    points: rating.points, mmr: rating.mmr, placementsDone: rating.placementsDone,
    shields: rating.shields, winStreak: rating.winStreak, peakPoints: rating.peakPoints,
  }
  const next = applyResult(state, change)

  // Reclamo atómico: si otro submit ya completó la carrera, no se aplica RR de nuevo.
  if (!(await claim({
    status: 'completed', valid: true, completedAt: new Date(),
    timeMs, clicks, stars, rrDelta: change.rrDelta, path: JSON.stringify(path),
  }))) {
    return NextResponse.json({ error: 'already_submitted' }, { status: 409 })
  }

  await db.playerRating.upsert({
    where: { playerId: race.playerId! },
    create: { playerId: race.playerId!, ...next },
    update: { ...next },
  })
  await db.ratingHistory.create({ data: { playerId: race.playerId!, raceId, pointsAfter: next.points, mmrAfter: next.mmr, rrDelta: change.rrDelta } })

  return NextResponse.json({
    valid: true, stars, timeMs, clicks, rrDelta: change.rrDelta,
    points: next.points, placementsDone: next.placementsDone,
  })
}
