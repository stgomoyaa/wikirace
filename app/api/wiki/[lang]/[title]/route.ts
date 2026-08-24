import { NextRequest, NextResponse } from 'next/server'
import { fetchArticle } from '@/lib/wiki/client'
import { isValidLang } from '@/lib/wiki/lang'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ lang: string; title: string }> },
) {
  const { lang, title } = await params
  if (!isValidLang(lang)) {
    return NextResponse.json({ error: 'invalid_lang' }, { status: 400 })
  }
  try {
    // Next.js ya decodifica los params; fetchArticle vuelve a codificar.
    const article = await fetchArticle(lang, title)
    return NextResponse.json(article, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
}
