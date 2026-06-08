'use client'

import { useEffect, useState } from 'react'
import RaceView from '@/components/RaceView'
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
    // Valida la forma: un blob viejo/corrupto no debe romper la pantalla.
    if (
      !parsed || typeof parsed !== 'object' ||
      !Array.isArray(parsed.history) ||
      typeof parsed.streak !== 'number' ||
      typeof parsed.maxStreak !== 'number' ||
      !(parsed.lastDay === null || typeof parsed.lastDay === 'number')
    ) {
      return emptyDailyState()
    }
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

  useEffect(() => {
    setState(loadState())
    fetch('/api/daily/start', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => setInfo(d))
  }, [])

  function onFinish(r: { valid: boolean; stars: number; timeMs: number; clicks: number }) {
    if (!r.valid || !info) return
    setResult(r)
    setState((prev) => {
      const next = recordDaily(prev, { day: info.number, stars: r.stars, timeMs: r.timeMs, clicks: r.clicks })
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  async function share() {
    if (!info || !result) return
    const card = buildShareCard({
      number: info.number, stars: result.stars, timeMs: result.timeMs,
      clicks: result.clicks, optimalLen: info.optimalLen, url: 'https://wikirace-three.vercel.app',
    })
    try { await navigator.clipboard.writeText(card) } catch {}
    setShared(true)
  }

  if (!info) return <main style={{ padding: 24 }}>Cargando el daily…</main>

  const alreadyDone = info.alreadyPlayed || result
  if (alreadyDone) {
    const stars = result?.stars ?? state.history.find((h) => h.day === info.number)?.stars ?? 0
    return (
      <main style={{ maxWidth: 560, margin: '40px auto', padding: 16, textAlign: 'center' }}>
        <h1>WikiRace #{info.number}</h1>
        <p style={{ fontSize: 28 }}>{'⭐'.repeat(stars)}</p>
        {result && <p>⏱️ {(result.timeMs / 1000).toFixed(1)}s · {result.clicks} saltos (óptimo {info.optimalLen})</p>}
        <p>🔥 Racha: {state.streak} (máx {state.maxStreak})</p>
        <button onClick={share} style={{ margin: 8 }}>{shared ? '¡Copiado!' : 'Compartir'}</button>
        <p style={{ marginTop: 24 }}>
          <a href="/ranked">▶ Seguir jugando ranked</a>
        </p>
      </main>
    )
  }

  return (
    <main>
      <div style={{ textAlign: 'center', padding: 12 }}>
        <strong>Daily #{info.number}</strong> · 🔥 {state.streak}
      </div>
      <RaceView
        raceId={info.raceId!}
        lang="en"
        start={info.start}
        target={info.target}
        submitUrl="/api/ranked/submit"
        onFinish={onFinish}
      />
    </main>
  )
}
