import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isValidLang } from '@/lib/wiki/lang'

const MAX_TITLE_LEN = 300

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { startTitle, targetTitle, lang } = body as {
    startTitle?: string
    targetTitle?: string
    lang?: string
  }

  if (
    typeof startTitle !== 'string' ||
    startTitle.length === 0 ||
    startTitle.length > MAX_TITLE_LEN ||
    typeof targetTitle !== 'string' ||
    targetTitle.length === 0 ||
    targetTitle.length > MAX_TITLE_LEN
  ) {
    return NextResponse.json({ error: 'missing_titles' }, { status: 400 })
  }
  if (lang !== undefined && !isValidLang(lang)) {
    return NextResponse.json({ error: 'invalid_lang' }, { status: 400 })
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
