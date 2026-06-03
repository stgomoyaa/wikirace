'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { titlesEqual } from '@/lib/wiki/title'

interface Props {
  raceId: string
  lang: string
  start: string
  target: string
}

interface Result {
  valid: boolean
  timeMs: number
  clicks: number
}

export default function RaceView({ raceId, lang, start, target }: Props) {
  const [path, setPath] = useState<string[]>([start])
  const [html, setHtml] = useState<string>('')
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const startRef = useRef<number>(Date.now())
  const containerRef = useRef<HTMLDivElement>(null)

  const current = path[path.length - 1]

  // cargar el artículo actual
  useEffect(() => {
    let cancelled = false
    fetch(`/api/wiki/${lang}/${encodeURIComponent(current)}`)
      .then((r) => r.json())
      .then((a) => {
        if (!cancelled) setHtml(a.html ?? '')
      })
    return () => {
      cancelled = true
    }
  }, [current, lang])

  // timer
  useEffect(() => {
    if (result) return
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 100)
    return () => clearInterval(id)
  }, [result])

  const submit = useCallback(
    async (finalPath: string[]) => {
      const res = await fetch('/api/race/submit', {
        method: 'POST',
        body: JSON.stringify({ raceId, path: finalPath }),
      })
      setResult(await res.json())
    },
    [raceId],
  )

  // interceptar clics en enlaces internos
  const onClick = useCallback(
    (e: React.MouseEvent) => {
      const el = (e.target as HTMLElement).closest('a.wiki-link') as HTMLElement | null
      if (!el) return
      e.preventDefault()
      const title = el.getAttribute('data-wiki-title')
      if (!title || result) return
      const next = [...path, title]
      setPath(next)
      if (titlesEqual(title, target)) void submit(next)
    },
    [path, target, result, submit],
  )

  const seconds = (elapsed / 1000).toFixed(1)

  return (
    <div>
      <div style={{ position: 'sticky', top: 0, background: '#1a1a2e', color: '#fff', padding: 12 }}>
        <strong>{start}</strong> → <strong>{target}</strong>
        {' · '}⏱️ {seconds}s · clics: {path.length - 1}
      </div>

      {result ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          {result.valid ? (
            <h2>¡Llegaste! ⏱️ {(result.timeMs / 1000).toFixed(1)}s · {result.clicks} clics</h2>
          ) : (
            <h2>Camino inválido 😕</h2>
          )}
        </div>
      ) : (
        <div
          ref={containerRef}
          onClick={onClick}
          style={{ padding: 16, maxWidth: 800, margin: '0 auto' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  )
}
