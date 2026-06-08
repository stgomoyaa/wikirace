# WikiRace — Plan 3C-1: Loop ranked jugable + rank display + fixes RR-integrity (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que ranked se pueda jugar de verdad: una página `/ranked` con el loop "una más", mostrando el rango (tier/división/RR) y el cambio tras cada carrera; y cerrar dos huecos de integridad de RR (selección de puzzle variada en ranked, y el doble-start del daily).

**Architecture:** Lógica de selección pura y testeable (`chooseUnplayed`); `ranked/start` elige un puzzle no jugado del tier (ya no siempre el más viejo). Un índice único parcial cierra el doble-start del daily. La UI reutiliza `RaceView` (con `submitUrl`/`onFinish` del 3B); un `RankBadge` muestra el rango leído de `/api/rank/me`. El leaderboard y el juice pesado quedan para 3C-2.

**Tech Stack:** Next.js 16 (App Router, React 19) · TypeScript · Prisma 6 + Postgres · Vitest + testing-library.

---

## Estructura de archivos

- `lib/rank/pick.ts` — `chooseUnplayed(candidateIds, playedIds, rnd?)`. Puro.
- `app/api/ranked/start/route.ts` — (modificar) usar `chooseUnplayed`.
- `app/api/daily/start/route.ts` — (modificar) tolerar conflicto único (doble-start).
- `prisma/migrations/.../migration.sql` — índice único parcial del daily.
- `app/api/rank/me/route.ts` — rango actual del jugador (desde cookie).
- `components/RankBadge.tsx` — muestra tier/división/RR o "Placements x/5".
- `app/ranked/RankedClient.tsx` + `app/ranked/page.tsx` — el loop ranked.
- `app/daily/DailyClient.tsx` — (modificar) funnel apunta a `/ranked`.

Tarea 1 es pura (TDD). 2-3 integración (selección + índice). 4-7 UI/rutas.

---

### Task 1: Selección de puzzle no jugado (TDD)

**Files:** Create `lib/rank/pick.ts`, Test `lib/rank/pick.test.ts`

- [ ] **Step 1: Test que falla** — `lib/rank/pick.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { chooseUnplayed } from './pick'

describe('chooseUnplayed', () => {
  it('elige sólo entre los no jugados', () => {
    const id = chooseUnplayed(['a', 'b', 'c'], ['a', 'b'], () => 0)
    expect(id).toBe('c')
  })
  it('usa rnd para elegir dentro del pool no jugado', () => {
    expect(chooseUnplayed(['a', 'b', 'c'], [], () => 0)).toBe('a')
    expect(chooseUnplayed(['a', 'b', 'c'], [], () => 0.99)).toBe('c')
  })
  it('devuelve null si todos fueron jugados', () => {
    expect(chooseUnplayed(['a', 'b'], ['a', 'b'], () => 0)).toBeNull()
  })
  it('devuelve null si no hay candidatos', () => {
    expect(chooseUnplayed([], [], () => 0)).toBeNull()
  })
})
```

- [ ] **Step 2: Falla** — `npx vitest run lib/rank/pick.test.ts` → FAIL.

- [ ] **Step 3: Implementar** — `lib/rank/pick.ts`:
```ts
/** Elige un id al azar de los candidatos que NO están en `playedIds`. null si no hay. */
export function chooseUnplayed(
  candidateIds: string[],
  playedIds: string[],
  rnd: () => number = Math.random,
): string | null {
  const played = new Set(playedIds)
  const pool = candidateIds.filter((id) => !played.has(id))
  if (pool.length === 0) return null
  const idx = Math.min(pool.length - 1, Math.floor(rnd() * pool.length))
  return pool[idx]
}
```

- [ ] **Step 4: Pasa** — `npx vitest run lib/rank/pick.test.ts` → PASS (4).

- [ ] **Step 5: Commit** — `git add lib/rank/pick.ts lib/rank/pick.test.ts && git commit -m "feat: chooseUnplayed puzzle selection"`

---

### Task 2: `ranked/start` elige puzzle no jugado

**Files:** Modify `app/api/ranked/start/route.ts`

- [ ] **Step 1: Reemplazar la selección de puzzle** — en `app/api/ranked/start/route.ts`, localiza:
```ts
  const puzzle = await db.puzzle.findFirst({ where: { difficulty, lang: 'en' }, orderBy: { createdAt: 'asc' } })
  if (!puzzle) return NextResponse.json({ error: 'no_puzzles' }, { status: 503 })
```
y reemplázalo por (elige uno no jugado; si ya jugó todos, permite repetir al azar):
```ts
  const candidates = await db.puzzle.findMany({ where: { difficulty, lang: 'en' }, select: { id: true } })
  if (candidates.length === 0) return NextResponse.json({ error: 'no_puzzles' }, { status: 503 })
  const played = await db.race.findMany({
    where: { playerId, isRanked: true, status: 'completed' }, select: { puzzleId: true },
  })
  const candidateIds = candidates.map((c) => c.id)
  const playedIds = played.map((p) => p.puzzleId).filter((x): x is string => !!x)
  const chosenId =
    chooseUnplayed(candidateIds, playedIds) ?? candidateIds[Math.floor(Math.random() * candidateIds.length)]
  const puzzle = await db.puzzle.findUnique({ where: { id: chosenId } })
  if (!puzzle) return NextResponse.json({ error: 'no_puzzles' }, { status: 503 })
```
y agrega el import arriba:
```ts
import { chooseUnplayed } from '@/lib/rank/pick'
```

- [ ] **Step 2: Build verde** — `npm run build` → ok.

- [ ] **Step 3: Commit** — `git add app/api/ranked/start/route.ts && git commit -m "feat: ranked start picks an unplayed puzzle for the tier"`

---

### Task 3: Cerrar el doble-start del daily (índice único parcial)

**Files:**
- Create: `prisma/migrations/20260608140000_daily_unique/migration.sql`
- Modify: `app/api/daily/start/route.ts`

- [ ] **Step 1: Migración del índice único parcial** — create `prisma/migrations/20260608140000_daily_unique/migration.sql`:
```sql
-- Un jugador no puede tener dos carreras daily para el mismo puzzle (cierra el doble-start del daily).
CREATE UNIQUE INDEX "Race_daily_player_puzzle_key"
  ON "Race" ("playerId", "puzzleId")
  WHERE "isDaily" = true;
```
(Es un índice parcial; vive sólo en la migración, no en el schema de Prisma — nuestro flujo usa `migrate deploy`, no `migrate dev`, así que no genera drift.)

- [ ] **Step 2: Tolerar el conflicto en daily/start** — en `app/api/daily/start/route.ts`, localiza el bloque que crea la carrera:
```ts
  let race = await db.race.findFirst({
    where: { playerId, puzzleId: daily.puzzleId, isDaily: true, status: 'active' },
  })
  if (!race) {
    race = await db.race.create({
      data: {
        lang: 'en', startTitle: puzzle.startTitle, targetTitle: puzzle.targetTitle,
        isRanked: true, isDaily: true, puzzleId: puzzle.id, playerId,
      },
    })
  }
```
y reemplázalo por (si dos starts concurrentes chocan en el índice único, recupera la carrera existente):
```ts
  let race = await db.race.findFirst({
    where: { playerId, puzzleId: daily.puzzleId, isDaily: true, status: 'active' },
  })
  if (!race) {
    try {
      race = await db.race.create({
        data: {
          lang: 'en', startTitle: puzzle.startTitle, targetTitle: puzzle.targetTitle,
          isRanked: true, isDaily: true, puzzleId: puzzle.id, playerId,
        },
      })
    } catch {
      // Otro start concurrente ya creó la carrera daily (índice único): recuperarla.
      race = await db.race.findFirst({
        where: { playerId, puzzleId: daily.puzzleId, isDaily: true },
      })
    }
  }
  if (!race) return NextResponse.json({ error: 'conflict' }, { status: 409 })
```

- [ ] **Step 3: Build verde** — `npm run build` → ok.

- [ ] **Step 4: Commit** — `git add prisma/migrations app/api/daily/start/route.ts && git commit -m "fix: unique index closes daily double-start RR farm"`

---

### Task 4: API del rango actual

**Files:** Create `app/api/rank/me/route.ts`

- [ ] **Step 1: Implementar** — `app/api/rank/me/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { PID_COOKIE, parsePid } from '@/lib/player/identity'
import { rankedSecret } from '@/lib/config'
import { tierFromPoints, rankLabel } from '@/lib/rank/tiers'

export async function GET() {
  const jar = await cookies()
  const playerId = parsePid(jar.get(PID_COOKIE)?.value ?? '', rankedSecret())
  if (!playerId) return NextResponse.json({ ranked: false })

  const rating = await db.playerRating.findUnique({ where: { playerId } })
  const points = rating?.points ?? 0
  const view = tierFromPoints(points)
  return NextResponse.json({
    ranked: true,
    points,
    tier: view.tier,
    division: view.division,
    rr: view.rr,
    label: rankLabel(points),
    placementsDone: rating?.placementsDone ?? 0,
  })
}
```

- [ ] **Step 2: Build verde** — `npm run build` → `/api/rank/me` listada.

- [ ] **Step 3: Commit** — `git add app/api/rank/me && git commit -m "feat: /api/rank/me current rank endpoint"`

---

### Task 5: Componente `RankBadge` (TDD)

**Files:** Create `components/RankBadge.tsx`, Test `components/RankBadge.test.tsx`

- [ ] **Step 1: Test que falla** — `components/RankBadge.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RankBadge } from './RankBadge'

describe('RankBadge', () => {
  it('muestra el label del rango cuando terminó placements', () => {
    render(<RankBadge label="Gold II · 45 RR" placementsDone={5} />)
    expect(screen.getByText(/Gold II · 45 RR/)).toBeInTheDocument()
  })
  it('muestra el progreso de placements cuando aún no termina', () => {
    render(<RankBadge label="Iron IV · 0 RR" placementsDone={2} />)
    expect(screen.getByText(/Placements 2\/5/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Falla** — `npx vitest run components/RankBadge.test.tsx` → FAIL.

- [ ] **Step 3: Implementar** — `components/RankBadge.tsx`:
```tsx
interface Props {
  label: string
  placementsDone: number
}

/** Muestra el rango del jugador, o el progreso de placements si aún no termina. */
export function RankBadge({ label, placementsDone }: Props) {
  const text = placementsDone < 5 ? `Placements ${placementsDone}/5` : label
  return (
    <span
      style={{
        display: 'inline-block', padding: '4px 12px', borderRadius: 999,
        background: '#1a1a2e', color: '#ffd166', fontWeight: 700, fontSize: 14,
      }}
    >
      {text}
    </span>
  )
}
```

- [ ] **Step 4: Pasa** — `npx vitest run components/RankBadge.test.tsx` → PASS (2).

- [ ] **Step 5: Commit** — `git add components/RankBadge.tsx components/RankBadge.test.tsx && git commit -m "feat: RankBadge component"`

---

### Task 6: Página `/ranked` con el loop "una más"

**Files:** Create `app/ranked/RankedClient.tsx`, Create `app/ranked/page.tsx`

- [ ] **Step 1: Cliente ranked** — `app/ranked/RankedClient.tsx`:
```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import RaceView from '@/components/RaceView'
import { RankBadge } from '@/components/RankBadge'

interface StartInfo { raceId: string; start: string; target: string; optimalLen: number; difficulty: string }
interface Rank { label: string; placementsDone: number }
interface RaceResult { valid: boolean; stars: number; timeMs: number; clicks: number; rrDelta: number; placementsDone: number }

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
        submitUrl="/api/ranked/submit" onFinish={onFinish} />
    </main>
  )
}
```

- [ ] **Step 2: Página** — `app/ranked/page.tsx`:
```tsx
import RankedClient from './RankedClient'

export default function RankedPage() {
  return <RankedClient />
}
```

- [ ] **Step 3: Build verde** — `npm run build` → `/ranked` listada.

- [ ] **Step 4: Commit** — `git add app/ranked && git commit -m "feat: ranked play page with one-more loop and rank display"`

---

### Task 7: Funnel del daily apunta a `/ranked` + suite

**Files:** Modify `app/daily/DailyClient.tsx`

- [ ] **Step 1: Cambiar el enlace del funnel** — en `app/daily/DailyClient.tsx`, localiza:
```tsx
          <a href="/play">▶ Seguir jugando ranked</a>
```
y reemplázalo por:
```tsx
          <a href="/ranked">▶ Seguir jugando ranked</a>
```

- [ ] **Step 2: Suite completa + build**
Run: `npx vitest run` → todos pasan (incluye `pick`, `RankBadge`).
Run: `npm run build` → verde; rutas `/ranked`, `/api/rank/me` presentes.

- [ ] **Step 3: Commit**
```bash
git add app/daily/DailyClient.tsx
git commit -m "feat: daily funnel points to /ranked"
```

**Operativo:** las migraciones se aplican en el deploy. El loop ranked necesita puzzles en el pool (Plan 2) y `RANKED_SECRET` en Vercel.

---

## Self-Review (cobertura)

- **Loop ranked jugable (start→play→result→una más)** → Task 6. ✅
- **Rank display (tier/división/RR, placements)** → Task 4 (`/api/rank/me`) + Task 5 (`RankBadge`) + Task 6. ✅
- **Fix RR-integrity #1 (selección de puzzle variada)** → Tasks 1-2. ✅
- **Fix RR-integrity #2 (doble-start del daily)** → Task 3. ✅
- **Funnel daily→ranked real** → Task 7. ✅
- **Fuera de 3C-1 (va en 3C-2):** leaderboard global/país, captura de país por IP, juice/animaciones pesadas (barra RR animada, celebración de promoción, sonidos). Correcto.

Tipos consistentes: `chooseUnplayed`, `RankBadge` props (`label`, `placementsDone`), `/api/rank/me` devuelve `{label, placementsDone, ...}` que consumen RankedClient/RankBadge. Sin placeholders.

Nota: el "una más" vuelve a `/api/ranked/start`, que tras Task 2 entrega un puzzle no jugado del tier — el grind no repite puzzles hasta agotar el pool del tier.
