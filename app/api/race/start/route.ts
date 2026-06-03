import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { startTitle, targetTitle, lang } = body as {
    startTitle?: string
    targetTitle?: string
    lang?: string
  }

  if (!startTitle || !targetTitle) {
    return NextResponse.json({ error: 'missing_titles' }, { status: 400 })
  }

  const race = await db.race.create({
    data: { startTitle, targetTitle, lang: lang ?? 'en' },
  })

  return NextResponse.json({
    id: race.id,
    startTitle: race.startTitle,
    targetTitle: race.targetTitle,
    lang: race.lang,
    startedAt: race.startedAt,
  })
}
