import { NextRequest, NextResponse } from 'next/server'
import { isValidLang } from '@/lib/wiki/lang'
import { SEARCH_QUERY_MAX, searchTitles } from '@/lib/wiki/search'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params
  if (!isValidLang(lang)) {
    return NextResponse.json({ error: 'invalid_lang' }, { status: 400, headers: NO_STORE })
  }

  const query = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (query.length < 2) {
    return NextResponse.json({ suggestions: [] }, { headers: NO_STORE })
  }
  if (query.length > SEARCH_QUERY_MAX) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400, headers: NO_STORE })
  }

  try {
    const suggestions = await searchTitles(lang, query)
    return NextResponse.json({ suggestions }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: 'search_failed' }, { status: 502, headers: NO_STORE })
  }
}
