import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchArticle } from '@/lib/wiki/client'
import { validatePath, LinksOf } from '@/lib/race/validate'

// Tope de saltos: evita amplificación de requests salientes a Wikipedia (DoS).
const MAX_PATH = 200
const MAX_TITLE_LEN = 300

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { raceId, path } = body as { raceId?: string; path?: string[] }

  if (
    typeof raceId !== 'string' ||
    !Array.isArray(path) ||
    path.length < 2 ||
    path.length > MAX_PATH ||
    !path.every((p) => typeof p === 'string' && p.length > 0 && p.length <= MAX_TITLE_LEN)
  ) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const race = await db.race.findUnique({ where: { id: raceId } })
  if (!race) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (race.status !== 'active') {
    return NextResponse.json({ error: 'already_submitted' }, { status: 409 })
  }

  const linksOf: LinksOf = async (lang, title) =>
    (await fetchArticle(lang, title)).links

  let result
  try {
    result = await validatePath(
      race.lang,
      path,
      race.startTitle,
      race.targetTitle,
      linksOf,
    )
  } catch {
    return NextResponse.json({ error: 'validation_error' }, { status: 400 })
  }

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
