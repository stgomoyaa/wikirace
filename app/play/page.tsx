'use client'

import { useEffect, useRef, useState } from 'react'
import RaceView from '@/components/RaceView'
import { ArticleAutocomplete } from '@/components/ArticleAutocomplete'
import { RaceMark } from '@/components/SiteHeader'

interface Started {
  id: string
  start: string
  target: string
  lang: string
}

const LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
] as const

const EXAMPLES: Record<string, { start: string; target: string }> = {
  es: { start: 'Perro', target: 'Chile' },
  en: { start: 'Dog', target: 'Philosophy' },
  pt: { start: 'Cão', target: 'Brasil' },
  fr: { start: 'Chien', target: 'Philosophie' },
  de: { start: 'Hund', target: 'Philosophie' },
  it: { start: 'Cane', target: 'Filosofia' },
}

export default function PlayPage() {
  const [lang, setLang] = useState('es')
  const [start, setStart] = useState('')
  const [target, setTarget] = useState('')
  const [race, setRace] = useState<Started | null>(null)
  const [loading, setLoading] = useState(false)
  const [randomLoading, setRandomLoading] = useState<'start' | 'target' | null>(null)
  const [error, setError] = useState('')
  const randomRequest = useRef<{ controller: AbortController; id: number } | null>(null)
  const randomRequestId = useRef(0)

  useEffect(() => () => randomRequest.current?.controller.abort(), [])

  function cancelRandomRequest() {
    randomRequest.current?.controller.abort()
    randomRequest.current = null
    setRandomLoading(null)
  }

  function changeLanguage(nextLang: string) {
    cancelRandomRequest()
    setLang(nextLang)
    setStart('')
    setTarget('')
    setError('')
  }

  async function randomize(field: 'start' | 'target', setter: (value: string) => void) {
    cancelRandomRequest()
    const request = {
      controller: new AbortController(),
      id: ++randomRequestId.current,
    }
    randomRequest.current = request
    setError('')
    setRandomLoading(field)
    try {
      const response = await fetch(`/api/wiki/random/${lang}`, { signal: request.controller.signal })
      if (!response.ok) throw new Error('random_failed')
      const data = await response.json()
      if (request.controller.signal.aborted || randomRequest.current?.id !== request.id) return
      setter(data.title)
    } catch {
      if (!request.controller.signal.aborted) {
        setError('No pudimos elegir un artículo. Intenta nuevamente.')
      }
    } finally {
      if (randomRequest.current?.id === request.id) {
        randomRequest.current = null
        setRandomLoading(null)
      }
    }
  }

  async function begin() {
    cancelRandomRequest()
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
        body: JSON.stringify({ startTitle, targetTitle, lang }),
      })
      if (!response.ok) throw new Error('start_failed')
      const data = await response.json()
      setRace({ id: data.id, start: startTitle, target: targetTitle, lang: data.lang ?? lang })
    } catch {
      setError('No pudimos iniciar la carrera. Revisa los títulos e intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  if (race) return <RaceView raceId={race.id} lang={race.lang} start={race.start} target={race.target} />

  const examples = EXAMPLES[lang] ?? EXAMPLES.es

  return (
    <main className="game-screen">
      <section className="game-intro">
        <RaceMark className="game-intro__mark" />
        <h1>Arma tu propia carrera</h1>
        <p>Elige dos artículos y llega al destino usando solo enlaces internos de Wikipedia.</p>
      </section>

      <section className="race-form" aria-label="Crear carrera de práctica">
        <div className="language-field">
          <label htmlFor="wiki-language">Idioma de Wikipedia</label>
          <select
            id="wiki-language"
            value={lang}
            disabled={loading}
            onChange={(event) => changeLanguage(event.target.value)}
          >
            {LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>{language.label}</option>
            ))}
          </select>
        </div>

        <ArticleAutocomplete
          id="start-title"
          label="Artículo de origen"
          lang={lang}
          value={start}
          onChange={setStart}
          onRandom={() => randomize('start', setStart)}
          randomLoading={randomLoading === 'start'}
          disabled={loading}
          placeholder={`Ejemplo: ${examples.start}`}
        />

        <div className="route-divider" aria-hidden="true"><RaceMark /></div>

        <ArticleAutocomplete
          id="target-title"
          label="Artículo de destino"
          lang={lang}
          value={target}
          onChange={setTarget}
          onRandom={() => randomize('target', setTarget)}
          randomLoading={randomLoading === 'target'}
          disabled={loading}
          placeholder={`Ejemplo: ${examples.target}`}
        />

        <div className="form-message" role="alert">{error}</div>
        <button className="button button--primary button--wide" onClick={begin} disabled={loading || !start || !target}>
          {loading ? 'Preparando carrera…' : 'Empezar carrera'}
        </button>
      </section>

      <p className="screen-note">¿Prefieres una partida con puntaje? <a href="/ranked">Juega ranked</a>.</p>
    </main>
  )
}
