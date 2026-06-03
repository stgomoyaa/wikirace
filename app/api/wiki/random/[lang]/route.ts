import { NextResponse } from 'next/server'
import { randomTitle } from '@/lib/wiki/random'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params
  const title = await randomTitle(lang)
  return NextResponse.json({ title })
}
