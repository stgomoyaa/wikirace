'use client'

import { useState } from 'react'
import RaceView from '@/components/RaceView'
import { RaceMark } from '@/components/SiteHeader'

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
  const [error, setError] = useState('')

  async function randomize(setter: (value: string) => void) {
    setError('')
    try {
      const response = await fetch('/api/wiki/random/en')
      if (!response.ok) throw new Error('random_failed')
      const data = await response.json()
      setter(data.title)
    } catch {
      setError('No pudimos elegir un artículo. Intenta nuevamente.')
    }
  }

  async function begin() {
    const startTitle = start.trim()
    const targetTitle = target.trim()
    if (!startTitle || !targetTitle || startTitle === targetTitle) {
      setError(startTitle && startTitle === targetTitle ? 'El origen y el destino deben ser distintos.' : 'Completa ambos artículos para empezar.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/race/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTitle, targetTitle, lang: 'en' }),
      })
      if (!response.ok) throw new Error('start_failed')
      const data = await response.json()
      setRace({ id: data.id, start: startTitle, target: targetTitle, lang: 'en' })
    } catch {
      setError('No pudimos iniciar la carrera. Revisa los títulos e intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  if (race) return <RaceView raceId={race.id} lang={race.lang} start={race.start} target={race.target} />

  return (
    <main className="game-screen">
      <section className="game-intro">
        <RaceMark className="game-intro__mark" />
        <h1>Arma tu propia carrera</h1>
        <p>Elige dos artículos y llega al destino usando solo enlaces internos de Wikipedia.</p>
      </section>

      <section className="race-form" aria-label="Crear carrera de práctica">
        <div className="field">
          <label htmlFor="start-title">Artículo de origen</label>
          <div className="field__row">
            <input
              id="start-title"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              placeholder="Ejemplo: Dog"
              autoComplete="off"
            />
            <button className="button button--secondary button--compact" type="button" onClick={() => randomize(setStart)}>
              Aleatorio
            </button>
          </div>
        </div>

        <div className="route-divider" aria-hidden="true"><RaceMark /></div>

        <div className="field">
          <label htmlFor="target-title">Artículo de destino</label>
          <div className="field__row">
            <input
              id="target-title"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="Ejemplo: Philosophy"
              autoComplete="off"
            />
            <button className="button button--secondary button--compact" type="button" onClick={() => randomize(setTarget)}>
              Aleatorio
            </button>
          </div>
        </div>

        <div className="form-message" role="alert">{error}</div>
        <button className="button button--primary button--wide" onClick={begin} disabled={loading || !start || !target}>
          {loading ? 'Preparando carrera…' : 'Empezar carrera'}
        </button>
      </section>

      <p className="screen-note">¿Prefieres una partida con puntaje? <a href="/ranked">Juega ranked</a>.</p>
    </main>
  )
}
