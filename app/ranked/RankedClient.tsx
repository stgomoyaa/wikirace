'use client'

import { useCallback, useEffect, useState } from 'react'
import RaceView from '@/components/RaceView'
import { RankBadge } from '@/components/RankBadge'

interface StartInfo { raceId: string; start: string; target: string; optimalLen: number; difficulty: string }
interface Rank { label: string; placementsDone: number }
interface RaceResult { valid: boolean; stars: number; timeMs: number; clicks: number; rrDelta: number; placementsDone: number; [key: string]: unknown }

export default function RankedClient() {
  const [info, setInfo] = useState<StartInfo | null>(null)
  const [rank, setRank] = useState<Rank>({ label: 'Iron IV · 0 RR', placementsDone: 0 })
  const [result, setResult] = useState<RaceResult | null>(null)
  const [loading, setLoading] = useState(false)

  const loadRank = useCallback(async () => {
    const r = await fetch('/api/rank/me').then((x) => x.json())
    if (r.ranked) setRank({ label: r.label, placementsDone: r.placementsDone })
  }, [])

  const startRace = useCallback(async () => {
    setLoading(true)
    setResult(null)
    const r = await fetch('/api/ranked/start', { method: 'POST' })
    if (!r.ok) { setInfo(null); setLoading(false); return }
    setInfo(await r.json())
    setLoading(false)
  }, [])

  useEffect(() => { loadRank(); startRace() }, [loadRank, startRace])

  function onFinish(r: RaceResult) {
    setResult(r)
    void loadRank()
  }

  if (loading || !info) {
    return <main style={{ padding: 24, textAlign: 'center' }}>{loading ? 'Buscando partida…' : 'No hay puzzles disponibles aún.'}</main>
  }

  if (result) {
    const inPlacements = result.placementsDone < 5
    return (
      <main style={{ maxWidth: 560, margin: '40px auto', padding: 16, textAlign: 'center' }}>
        <h1>{result.valid ? '¡Llegaste!' : 'Carrera inválida'}</h1>
        {result.valid && (
          <>
            <p style={{ fontSize: 28 }}>{'⭐'.repeat(result.stars)}</p>
            <p>⏱️ {(result.timeMs / 1000).toFixed(1)}s · {result.clicks} saltos (óptimo {info.optimalLen})</p>
            {inPlacements
              ? <p>Placement {result.placementsDone}/5</p>
              : <p style={{ fontWeight: 700, color: result.rrDelta >= 0 ? '#2ecc71' : '#e74c3c' }}>
                  {result.rrDelta >= 0 ? '+' : ''}{result.rrDelta} RR
                </p>}
          </>
        )}
        <p style={{ margin: '12px 0' }}><RankBadge label={rank.label} placementsDone={rank.placementsDone} /></p>
        <button onClick={startRace} style={{ padding: '10px 20px', fontSize: 16, fontWeight: 700 }}>▶ Una más</button>
      </main>
    )
  }

  return (
    <main>
      <div style={{ textAlign: 'center', padding: 12 }}>
        <RankBadge label={rank.label} placementsDone={rank.placementsDone} /> · {info.difficulty}
      </div>
      <RaceView raceId={info.raceId} lang="en" start={info.start} target={info.target}
        submitUrl="/api/ranked/submit" onFinish={onFinish as (r: { valid: boolean; timeMs: number; clicks: number; stars: number }) => void} />
    </main>
  )
}
