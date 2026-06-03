import { NextRequest, NextResponse } from 'next/server'
import { fetchArticle } from '@/lib/wiki/client'
import { isValidLang } from '@/lib/wiki/lang'

export const revalidate = 86400

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ lang: string; title: string }> },
) {
  const { lang, title } = await params
  if (!isValidLang(lang)) {
    return NextResponse.json({ error: 'invalid_lang' }, { status: 400 })
  }
  try {
    const article = await fetchArticle(lang, decodeURIComponent(title))
    return NextResponse.json(article, {
      headers: { 'Cache-Control': 'public, s-maxage=86400' },
    })
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
}
