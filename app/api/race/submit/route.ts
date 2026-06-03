import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchArticle } from '@/lib/wiki/client'
import { validatePath, LinksOf } from '@/lib/race/validate'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { raceId, path } = body as { raceId?: string; path?: string[] }

  if (!raceId || !Array.isArray(path)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const race = await db.race.findUnique({ where: { id: raceId } })
  if (!race) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (race.status !== 'active') {
    return NextResponse.json({ error: 'already_submitted' }, { status: 409 })
  }

  const linksOf: LinksOf = async (lang, title) =>
    (await fetchArticle(lang, title)).links

  const result = await validatePath(
    race.lang,
    path,
    race.startTitle,
    race.targetTitle,
    linksOf,
  )

  const timeMs = Date.now() - new Date(race.startedAt).getTime()
  const clicks = path.length - 1

  const updated = await db.race.update({
    where: { id: raceId },
    data: {
      status: result.valid ? 'completed' : 'invalid',
      valid: result.valid,
      completedAt: new Date(),
      timeMs,
      clicks,
      path: JSON.stringify(path),
    },
  })

  return NextResponse.json({
    valid: updated.valid,
    reason: result.reason,
    timeMs: updated.timeMs,
    clicks: updated.clicks,
  })
}
