import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { PID_COOKIE, parsePid } from '@/lib/player/identity'
import { rankedSecret } from '@/lib/config'
import { tierFromPoints, rankLabel } from '@/lib/rank/tiers'

export async function GET() {
  const jar = await cookies()
  const playerId = parsePid(jar.get(PID_COOKIE)?.value ?? '', rankedSecret())
  if (!playerId) return NextResponse.json({ ranked: false })

  const rating = await db.playerRating.findUnique({ where: { playerId } })
  const points = rating?.points ?? 0
  const view = tierFromPoints(points)
  return NextResponse.json({
    ranked: true,
    points,
    tier: view.tier,
    division: view.division,
    rr: view.rr,
    label: rankLabel(points),
    placementsDone: rating?.placementsDone ?? 0,
  })
}
