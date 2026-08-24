'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RaceMark } from '@/components/SiteHeader'
import { titlesEqual } from '@/lib/wiki/title'

interface Props {
  raceId: string
  lang: string
  start: string
  target: string
  submitUrl?: string
  onFinish?: (r: { valid: boolean; timeMs: number; clicks: number; stars: number }) => void
}

interface Result {
  valid: boolean
  timeMs: number
  clicks: number
}

export default function RaceView({ raceId, lang, start, target, submitUrl, onFinish }: Props) {
  const [path, setPath] = useState<string[]>([start])
  const [html, setHtml] = useState<string>('')
  const [articleError, setArticleError] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const startRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const current = path[path.length - 1]

  useEffect(() => {
    startRef.current = Date.now()
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/wiki/${lang}/${encodeURIComponent(current)}`)
      .then((response) => {
        if (!response.ok) throw new Error('article_fetch_failed')
        return response.json()
      })
      .then((article) => {
        if (!cancelled) setHtml(article.html ?? '')
      })
      .catch(() => {
        if (!cancelled) setArticleError(true)
      })

    return () => {
      cancelled = true
    }
  }, [current, lang])

  useEffect(() => {
    if (result) return
    const id = window.setInterval(() => {
      if (startRef.current !== null) setElapsed(Date.now() - startRef.current)
    }, 100)
    return () => window.clearInterval(id)
  }, [result])

  const submit = useCallback(
    async (finalPath: string[]) => {
      try {
        const response = await fetch(submitUrl ?? '/api/race/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raceId, path: finalPath }),
        })
        if (!response.ok) throw new Error('submit_failed')
        const json = await response.json()
        setResult(json)
        onFinish?.(json)
      } catch {
        setResult({ valid: false, timeMs: elapsed, clicks: finalPath.length - 1 })
      }
    },
    [elapsed, raceId, submitUrl, onFinish],
  )

  const onClick = useCallback(
    (event: React.MouseEvent) => {
      const link = (event.target as HTMLElement).closest('a.wiki-link') as HTMLElement | null
      if (!link) return
      event.preventDefault()
      const title = link.getAttribute('data-wiki-title')
      if (!title || result) return
      const next = [...path, title]
      setHtml('')
      setArticleError(false)
      setPath(next)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      if (titlesEqual(title, target)) void submit(next)
    },
    [path, target, result, submit],
  )

  const seconds = (elapsed / 1000).toFixed(1)

  return (
    <main className="race">
      <section className="race-hud" aria-label="Estado de la carrera">
        <div className="race-hud__route">
          <div>
            <span className="race-hud__label">Origen</span>
            <strong>{start}</strong>
          </div>
          <RaceMark className="race-hud__mark" />
          <div>
            <span className="race-hud__label">Destino</span>
            <strong>{target}</strong>
          </div>
        </div>
        <div className="race-hud__stats" aria-live="polite">
          <span><b>{seconds}</b> s</span>
          <span><b>{path.length - 1}</b> saltos</span>
          <span className="race-hud__current" title={path.join(' → ')}>Ahora: {current}</span>
        </div>
      </section>

      {result ? (
        <section className="result-panel" aria-live="polite">
          <RaceMark className="result-panel__mark" />
          <h1>{result.valid ? 'Llegaste al destino' : 'No pudimos validar la ruta'}</h1>
          {result.valid ? (
            <p>Completaste la carrera en {(result.timeMs / 1000).toFixed(1)} segundos y {result.clicks} saltos.</p>
          ) : (
            <p>La ruta no fue validada. Vuelve a intentar desde un modo de juego.</p>
          )}
          <a className="button button--primary" href="/play">Jugar otra carrera</a>
        </section>
      ) : articleError ? (
        <section className="status-panel" role="alert">
          <h1>No pudimos cargar el artículo</h1>
          <p>Revisa tu conexión e intenta recargar la página.</p>
          <button className="button button--secondary" onClick={() => window.location.reload()}>Recargar</button>
        </section>
      ) : html ? (
        <article className="wiki-article">
          <header className="wiki-article__masthead">
            <span>Artículo actual</span>
            <h1>{current}</h1>
          </header>
          <div
            ref={containerRef}
            className="wiki-article__content"
            onClick={onClick}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </article>
      ) : (
        <section className="status-panel" aria-live="polite">
          <span className="loader" aria-hidden="true" />
          <p>Cargando {current}…</p>
        </section>
      )}
    </main>
  )
}
