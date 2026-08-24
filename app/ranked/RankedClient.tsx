'use client'

import { useCallback, useEffect, useState } from 'react'
import RaceView from '@/components/RaceView'
import { RaceMark } from '@/components/SiteHeader'
import { RankBadge } from '@/components/RankBadge'

interface StartInfo { raceId: string; start: string; target: string; optimalLen: number; difficulty: string }
interface Rank { label: string; placementsDone: number }
interface RaceResult { valid: boolean; stars: number; timeMs: number; clicks: number; rrDelta: number; placementsDone: number; [key: string]: unknown }

export default function RankedClient() {
  const [info, setInfo] = useState<StartInfo | null>(null)
  const [rank, setRank] = useState<Rank>({ label: 'Iron IV · 0 RR', placementsDone: 0 })
  const [result, setResult] = useState<RaceResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  const loadRank = useCallback(async () => {
    try {
      const response = await fetch('/api/rank/me')
      if (!response.ok) return
      const data = await response.json()
      if (data.ranked) setRank({ label: data.label, placementsDone: data.placementsDone })
    } catch {}
  }, [])

  const startRace = useCallback(async () => {
    setLoading(true)
    setUnavailable(false)
    setResult(null)
    try {
      const response = await fetch('/api/ranked/start', { method: 'POST' })
      if (!response.ok) throw new Error('ranked_unavailable')
      setInfo(await response.json())
    } catch {
      setInfo(null)
      setUnavailable(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRank()
      void startRace()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadRank, startRace])

  function onFinish(raceResult: RaceResult) {
    setResult(raceResult)
    void loadRank()
  }

  if (loading) {
    return (
      <main className="status-panel" aria-live="polite">
        <span className="loader" aria-hidden="true" />
        <p>Buscando una carrera para tu rango…</p>
      </main>
    )
  }

  if (unavailable || !info) {
    return (
      <main className="status-panel" role="alert">
        <h1>Ranked no está disponible</h1>
        <p>No encontramos puzzles para tu rango en este momento.</p>
        <button className="button button--secondary" onClick={startRace}>Intentar nuevamente</button>
        <a className="button button--primary" href="/play">Jugar práctica</a>
      </main>
    )
  }

  if (result) {
    const inPlacements = result.placementsDone < 5
    return (
      <main className="result-panel">
        <RaceMark className="result-panel__mark" />
        <h1>{result.valid ? 'Carrera completada' : 'Carrera inválida'}</h1>
        {result.valid && (
          <>
            <p className="result-stars" aria-label={`${result.stars} estrellas`}>{'★'.repeat(result.stars)}</p>
            <p className="result-meta">
              {(result.timeMs / 1000).toFixed(1)} segundos, {result.clicks} saltos. La ruta óptima tiene {info.optimalLen}.
            </p>
            {inPlacements ? (
              <p className="result-meta">Posicionamiento {result.placementsDone}/5</p>
            ) : (
              <p className={result.rrDelta >= 0 ? 'rr-positive' : 'rr-negative'}>
                {result.rrDelta >= 0 ? '+' : ''}{result.rrDelta} RR
              </p>
            )}
          </>
        )}
        <p className="result-meta"><RankBadge label={rank.label} placementsDone={rank.placementsDone} /></p>
        <button className="button button--primary" onClick={startRace}>Jugar otra ranked</button>
      </main>
    )
  }

  return (
    <div>
      <div className="mode-strip">
        <RankBadge label={rank.label} placementsDone={rank.placementsDone} />
        <span className="mode-strip__separator">/</span>
        <span>Dificultad {info.difficulty}</span>
      </div>
      <RaceView
        raceId={info.raceId}
        lang="en"
        start={info.start}
        target={info.target}
        submitUrl="/api/ranked/submit"
        onFinish={onFinish as (r: { valid: boolean; timeMs: number; clicks: number; stars: number }) => void}
      />
    </div>
  )
}
