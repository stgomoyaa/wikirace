'use client'

import { useEffect, useState } from 'react'
import RaceView from '@/components/RaceView'
import { RaceMark } from '@/components/SiteHeader'
import { DailyState, emptyDailyState, recordDaily } from '@/lib/daily/state'
import { buildShareCard } from '@/lib/share/card'

const STORAGE_KEY = 'wikirace.daily.v1'

interface DailyInfo {
  raceId?: string
  number: number
  date: string
  start: string
  target: string
  optimalLen: number
  alreadyPlayed?: boolean
}

function loadState(): DailyState {
  if (typeof window === 'undefined') return emptyDailyState()
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as Partial<DailyState>
    if (
      !parsed || typeof parsed !== 'object' ||
      !Array.isArray(parsed.history) ||
      typeof parsed.streak !== 'number' ||
      typeof parsed.maxStreak !== 'number' ||
      !(parsed.lastDay === null || typeof parsed.lastDay === 'number')
    ) return emptyDailyState()
    return parsed as DailyState
  } catch {
    return emptyDailyState()
  }
}

export default function DailyClient() {
  const [info, setInfo] = useState<DailyInfo | null>(null)
  const [state, setState] = useState<DailyState>(emptyDailyState())
  const [result, setResult] = useState<{ stars: number; timeMs: number; clicks: number } | null>(null)
  const [shared, setShared] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setState(loadState()), 0)
    fetch('/api/daily/start', { method: 'POST' })
      .then((response) => {
        if (!response.ok) throw new Error('daily_fetch_failed')
        return response.json()
      })
      .then((data) => setInfo(data))
      .catch(() => setError(true))
    return () => window.clearTimeout(timer)
  }, [])

  function onFinish(raceResult: { valid: boolean; stars: number; timeMs: number; clicks: number }) {
    if (!raceResult.valid || !info) return
    setResult(raceResult)
    setState((previous) => {
      const next = recordDaily(previous, {
        day: info.number,
        stars: raceResult.stars,
        timeMs: raceResult.timeMs,
        clicks: raceResult.clicks,
      })
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  async function share() {
    if (!info || !result) return
    const card = buildShareCard({
      number: info.number,
      stars: result.stars,
      timeMs: result.timeMs,
      clicks: result.clicks,
      optimalLen: info.optimalLen,
      url: window.location.origin,
    })
    try {
      await navigator.clipboard.writeText(card)
      setShared(true)
    } catch {
      setShared(false)
    }
  }

  if (error) {
    return (
      <main className="status-panel" role="alert">
        <h1>No hay daily disponible</h1>
        <p>No pudimos preparar el desafío de hoy. Puedes seguir jugando en modo práctica.</p>
        <a className="button button--primary" href="/play">Ir a práctica</a>
      </main>
    )
  }

  if (!info) {
    return (
      <main className="status-panel" aria-live="polite">
        <span className="loader" aria-hidden="true" />
        <p>Preparando el desafío de hoy…</p>
      </main>
    )
  }

  const alreadyDone = info.alreadyPlayed || result
  if (alreadyDone) {
    const stars = result?.stars ?? state.history.find((entry) => entry.day === info.number)?.stars ?? 0
    return (
      <main className="result-panel">
        <RaceMark className="result-panel__mark" />
        <h1>Daily #{info.number} completado</h1>
        {stars > 0 && <p className="result-stars" aria-label={`${stars} estrellas`}>{'★'.repeat(stars)}</p>}
        {result && (
          <p className="result-meta">
            {(result.timeMs / 1000).toFixed(1)} segundos, {result.clicks} saltos. La ruta óptima tiene {info.optimalLen}.
          </p>
        )}
        <p className="result-meta">Racha actual: {state.streak}. Mejor racha: {state.maxStreak}.</p>
        {result && <button className="button button--secondary" onClick={share}>{shared ? 'Resultado copiado' : 'Copiar resultado'}</button>}
        <a className="button button--primary" href="/ranked">Seguir jugando ranked</a>
      </main>
    )
  }

  return (
    <div>
      <div className="mode-strip">
        <strong>Daily #{info.number}</strong>
        <span className="mode-strip__separator">/</span>
        <span>Racha {state.streak}</span>
      </div>
      <RaceView
        raceId={info.raceId!}
        lang="en"
        start={info.start}
        target={info.target}
        submitUrl="/api/ranked/submit"
        onFinish={onFinish}
      />
    </div>
  )
}
