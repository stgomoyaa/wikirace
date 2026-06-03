'use client'

import { useState } from 'react'
import RaceView from '@/components/RaceView'

interface Started {
  id: string
  start: string
  target: string
  lang: string
}

export default function PlayPage() {
  const [start, setStart] = useState('')
  const [target, setTarget] = useState('')
  const [race, setRace] = useState<Started | null>(null)
  const [loading, setLoading] = useState(false)

  async function rng(setter: (v: string) => void) {
    const r = await fetch('/api/wiki/random/en').then((x) => x.json())
    setter(r.title)
  }

  async function begin() {
    if (!start || !target) return
    setLoading(true)
    const res = await fetch('/api/race/start', {
      method: 'POST',
      body: JSON.stringify({ startTitle: start, targetTitle: target, lang: 'en' }),
    }).then((r) => r.json())
    setRace({ id: res.id, start, target, lang: 'en' })
    setLoading(false)
  }

  if (race) {
    return <RaceView raceId={race.id} lang={race.lang} start={race.start} target={race.target} />
  }

  return (
    <main style={{ maxWidth: 560, margin: '40px auto', padding: 16 }}>
      <h1>Práctica</h1>
      <p>Navega de un artículo a otro usando solo enlaces internos.</p>

      <label>Inicio</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={start} onChange={(e) => setStart(e.target.value)} placeholder="Ej: Dog" />
        <button onClick={() => rng(setStart)}>🎲</button>
      </div>

      <label>Destino</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Ej: Philosophy" />
        <button onClick={() => rng(setTarget)}>🎲</button>
      </div>

      <button onClick={begin} disabled={loading || !start || !target} style={{ marginTop: 16 }}>
        {loading ? 'Cargando…' : '▶ Empezar carrera'}
      </button>
    </main>
  )
}
