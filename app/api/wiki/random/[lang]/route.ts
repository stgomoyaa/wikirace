import { NextResponse } from 'next/server'
import { randomTitle } from '@/lib/wiki/random'
import { isValidLang } from '@/lib/wiki/lang'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params
  if (!isValidLang(lang)) {
    return NextResponse.json({ error: 'invalid_lang' }, { status: 400 })
  }
  try {
    const title = await randomTitle(lang)
    return NextResponse.json({ title })
  } catch {
    return NextResponse.json({ error: 'random_failed' }, { status: 502 })
  }
}
