# WikiRace — Plan 3B: Daily + funnel + streak + compartir + archivo (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el Daily en una partida ranked especial (RR ×3, 1/día) que usa el pool del Plan 2 y el motor ranked del Plan 3A, con estado personal (streak/historial) en localStorage, tarjeta de compartir, funnel al grind ranked, y archivo básico de días pasados.

**Architecture:** Un modelo `Daily` (PK = fecha UTC) garantiza un puzzle por día (get-or-assign atómico por clave primaria). El Daily crea una `Race` con `isDaily=true`+`isRanked=true`; se envía por la API ranked existente, que aplica el multiplicador ×3 al RR. La lógica pura (número de daily, rotación de dificultad, reducer de streak, tarjeta de compartir) vive aislada y testeable; el estado personal es client-side (localStorage).

**Tech Stack:** Next.js 16 (App Router) · TypeScript · Prisma 6 + Postgres · Vitest. Reutiliza `RaceView` (Plan 1), las APIs ranked y los modelos de rating (Plan 3A).

---

## Estructura de archivos

- `lib/daily/number.ts` — `dailyNumber(date)`, `difficultyForDate(date)`, `utcDateString(date)`. Puro.
- `lib/daily/state.ts` — `recordDaily(state, result)` (reducer de streak/historial). Puro.
- `lib/share/card.ts` — `buildShareCard(input)`. Puro.
- `lib/daily/select.ts` — `getOrAssignDaily(...)` (get-or-assign atómico por fecha). Integración DB.
- `app/api/daily/start/route.ts` — crea/recupera la carrera daily del jugador.
- `app/api/ranked/submit/route.ts` — (modificar) aplicar ×3 al RR cuando `race.isDaily`.
- `app/daily/DailyClient.tsx` — cliente: juega el daily + streak (localStorage) + share + funnel.
- `app/page.tsx` — (modificar) la home carga el daily de hoy.
- `app/daily/[date]/page.tsx` + `app/archive/page.tsx` — archivo básico.
- `prisma/schema.prisma` — modelo `Daily` + `Race.isDaily`.

Tareas 2-4 son lógica pura (TDD ideal para subagentes). 1, 5, 6 integración. 7-8 UI.

---

### Task 1: Modelo `Daily` + `Race.isDaily`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260608130000_daily/migration.sql`

- [ ] **Step 1: Agregar al schema** — append a `prisma/schema.prisma`:
```prisma
model Daily {
  date       String   @id // 'YYYY-MM-DD' (UTC)
  number     Int
  puzzleId   String
  difficulty String
  createdAt  DateTime @default(now())
}
```
Y agrega a `Race` el campo:
```prisma
  isDaily  Boolean @default(false)
```

- [ ] **Step 2: Escribir la migración** — create `prisma/migrations/20260608130000_daily/migration.sql`:
```sql
-- AlterTable
ALTER TABLE "Race" ADD COLUMN "isDaily" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Daily" (
    "date" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Daily_pkey" PRIMARY KEY ("date")
);
```

- [ ] **Step 3: Generar client + build**
```bash
npx prisma generate
npm run build
```
Expected: client generado; build verde.

- [ ] **Step 4: Commit**
```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: Daily model + Race.isDaily"
```

---

### Task 2: Número y dificultad del daily (TDD)

**Files:** Create `lib/daily/number.ts`, Test `lib/daily/number.test.ts`

- [ ] **Step 1: Test que falla** — `lib/daily/number.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { dailyNumber, difficultyForDate, utcDateString, LAUNCH_UTC } from './number'

describe('utcDateString', () => {
  it('formatea la fecha en UTC YYYY-MM-DD', () => {
    expect(utcDateString(new Date('2026-06-08T23:30:00Z'))).toBe('2026-06-08')
  })
})

describe('dailyNumber', () => {
  it('el día de lanzamiento es #1', () => {
    expect(dailyNumber(new Date(LAUNCH_UTC))).toBe(1)
  })
  it('cuenta días desde el lanzamiento (UTC)', () => {
    expect(dailyNumber(new Date('2026-06-03T05:00:00Z'))).toBe(3) // launch 2026-06-01
  })
})

describe('difficultyForDate', () => {
  it('rota por día de la semana (UTC)', () => {
    // 2026-06-08 es lunes -> easy
    expect(difficultyForDate(new Date('2026-06-08T12:00:00Z'))).toBe('easy')
    // 2026-06-10 miércoles -> medium
    expect(difficultyForDate(new Date('2026-06-10T12:00:00Z'))).toBe('medium')
    // 2026-06-13 sábado -> hard
    expect(difficultyForDate(new Date('2026-06-13T12:00:00Z'))).toBe('hard')
  })
})
```

- [ ] **Step 2: Falla** — `npx vitest run lib/daily/number.test.ts` → FAIL.

- [ ] **Step 3: Implementar** — `lib/daily/number.ts`:
```ts
/** Época del daily #1: 2026-06-01 UTC. */
export const LAUNCH_UTC = Date.UTC(2026, 5, 1)
const DAY_MS = 86_400_000

/** Fecha en UTC como 'YYYY-MM-DD'. */
export function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Número de daily incremental (#1 el día de lanzamiento). */
export function dailyNumber(date: Date): number {
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return Math.floor((midnight - LAUNCH_UTC) / DAY_MS) + 1
}

/** Dificultad rotada por día de semana UTC: Lun/Mar easy, Mié-Vie medium, Sáb/Dom hard. */
export function difficultyForDate(date: Date): 'easy' | 'medium' | 'hard' {
  const dow = date.getUTCDay() // 0=Dom .. 6=Sáb
  if (dow === 0 || dow === 6) return 'hard'
  if (dow === 1 || dow === 2) return 'easy'
  return 'medium'
}
```

- [ ] **Step 4: Pasa** — `npx vitest run lib/daily/number.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add lib/daily/number.ts lib/daily/number.test.ts && git commit -m "feat: daily number + difficulty rotation"`

---

### Task 3: Reducer de streak (TDD)

**Files:** Create `lib/daily/state.ts`, Test `lib/daily/state.test.ts`

- [ ] **Step 1: Test que falla** — `lib/daily/state.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { recordDaily, emptyDailyState, DailyState } from './state'

describe('recordDaily', () => {
  it('primer día: streak 1', () => {
    const s = recordDaily(emptyDailyState(), { day: 5, stars: 3, timeMs: 1000, clicks: 3 })
    expect(s.streak).toBe(1)
    expect(s.maxStreak).toBe(1)
    expect(s.lastDay).toBe(5)
    expect(s.history).toHaveLength(1)
  })
  it('día consecutivo: streak +1', () => {
    let s = recordDaily(emptyDailyState(), { day: 5, stars: 3, timeMs: 1000, clicks: 3 })
    s = recordDaily(s, { day: 6, stars: 2, timeMs: 2000, clicks: 4 })
    expect(s.streak).toBe(2)
    expect(s.maxStreak).toBe(2)
  })
  it('hueco de días: streak vuelve a 1', () => {
    let s = recordDaily(emptyDailyState(), { day: 5, stars: 3, timeMs: 1000, clicks: 3 })
    s = recordDaily(s, { day: 8, stars: 1, timeMs: 3000, clicks: 6 })
    expect(s.streak).toBe(1)
    expect(s.maxStreak).toBe(1)
  })
  it('mismo día (idempotente): no cambia el streak ni duplica historial', () => {
    let s = recordDaily(emptyDailyState(), { day: 5, stars: 3, timeMs: 1000, clicks: 3 })
    s = recordDaily(s, { day: 5, stars: 1, timeMs: 9999, clicks: 9 })
    expect(s.streak).toBe(1)
    expect(s.history).toHaveLength(1)
    expect(s.history[0].stars).toBe(3) // conserva el primer resultado del día
  })
})
```

- [ ] **Step 2: Falla** — `npx vitest run lib/daily/state.test.ts` → FAIL.

- [ ] **Step 3: Implementar** — `lib/daily/state.ts`:
```ts
export interface DailyResultEntry {
  day: number
  stars: number
  timeMs: number
  clicks: number
}
export interface DailyState {
  lastDay: number | null
  streak: number
  maxStreak: number
  history: DailyResultEntry[]
}

export function emptyDailyState(): DailyState {
  return { lastDay: null, streak: 0, maxStreak: 0, history: [] }
}

/** Registra el resultado del daily del día `result.day`. Idempotente por día. Puro. */
export function recordDaily(state: DailyState, result: DailyResultEntry): DailyState {
  if (state.lastDay === result.day) return state // ya jugado hoy: no cambia

  const streak = state.lastDay !== null && result.day === state.lastDay + 1 ? state.streak + 1 : 1
  const maxStreak = Math.max(state.maxStreak, streak)
  return {
    lastDay: result.day,
    streak,
    maxStreak,
    history: [...state.history, result],
  }
}
```

- [ ] **Step 4: Pasa** — `npx vitest run lib/daily/state.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add lib/daily/state.ts lib/daily/state.test.ts && git commit -m "feat: daily streak reducer"`

---

### Task 4: Tarjeta de compartir (TDD)

**Files:** Create `lib/share/card.ts`, Test `lib/share/card.test.ts`

- [ ] **Step 1: Test que falla** — `lib/share/card.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildShareCard, formatTime } from './card'

describe('formatTime', () => {
  it('formatea ms a M:SS', () => {
    expect(formatTime(51_000)).toBe('0:51')
    expect(formatTime(125_000)).toBe('2:05')
  })
})

describe('buildShareCard', () => {
  it('incluye número, estrellas, tiempo y cuadros (óptimos verdes + extra amarillos)', () => {
    const card = buildShareCard({
      number: 123, stars: 2, timeMs: 51_000, clicks: 5, optimalLen: 4, url: 'https://wikirace.app',
    })
    expect(card).toContain('WikiRace #123')
    expect(card).toContain('⭐⭐')
    expect(card).toContain('0:51')
    expect(card).toContain('5 saltos (óptimo 4)')
    expect(card).toContain('🟩🟩🟩🟩🟨') // 4 verdes + 1 amarillo
    expect(card).toContain('https://wikirace.app')
  })
})
```

- [ ] **Step 2: Falla** — `npx vitest run lib/share/card.test.ts` → FAIL.

- [ ] **Step 3: Implementar** — `lib/share/card.ts`:
```ts
export function formatTime(ms: number): string {
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export interface ShareInput {
  number: number
  stars: number
  timeMs: number
  clicks: number
  optimalLen: number
  url: string
}

/** Tarjeta de texto estilo Wordle, sin spoilers de artículos. */
export function buildShareCard(input: ShareInput): string {
  const { number, stars, timeMs, clicks, optimalLen, url } = input
  const starStr = '⭐'.repeat(stars)
  const green = '🟩'.repeat(Math.min(clicks, optimalLen))
  const extra = '🟨'.repeat(Math.max(0, clicks - optimalLen))
  return (
    `WikiRace #${number} ${starStr}\n` +
    `⏱️ ${formatTime(timeMs)} · ${clicks} saltos (óptimo ${optimalLen})\n` +
    `${green}${extra}\n` +
    url
  )
}
```

- [ ] **Step 4: Pasa** — `npx vitest run lib/share/card.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add lib/share/card.ts lib/share/card.test.ts && git commit -m "feat: Wordle-style share card"`

---

### Task 5: get-or-assign del daily (TDD con db mockeada)

**Files:** Create `lib/daily/select.ts`, Test `lib/daily/select.test.ts`

- [ ] **Step 1: Test que falla** — `lib/daily/select.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getOrAssignDaily } from './select'

const db: any = {
  daily: { findUnique: vi.fn(), create: vi.fn() },
  puzzle: { findFirst: vi.fn(), updateMany: vi.fn() },
}

beforeEach(() => vi.clearAllMocks())

describe('getOrAssignDaily', () => {
  it('devuelve el daily existente si ya está asignado', async () => {
    db.daily.findUnique.mockResolvedValue({ date: '2026-06-08', number: 8, puzzleId: 'p1', difficulty: 'easy' })
    const d = await getOrAssignDaily(db, '2026-06-08', 8, 'easy')
    expect(d.puzzleId).toBe('p1')
    expect(db.puzzle.findFirst).not.toHaveBeenCalled()
  })

  it('asigna un puzzle disponible si no hay daily para la fecha', async () => {
    db.daily.findUnique.mockResolvedValueOnce(null)
    db.puzzle.findFirst.mockResolvedValue({ id: 'p2' })
    db.daily.create.mockResolvedValue({ date: '2026-06-08', number: 8, puzzleId: 'p2', difficulty: 'easy' })
    const d = await getOrAssignDaily(db, '2026-06-08', 8, 'easy')
    expect(d.puzzleId).toBe('p2')
    expect(db.daily.create).toHaveBeenCalled()
  })

  it('si create falla por carrera (unique), devuelve el daily ya creado por el otro', async () => {
    db.daily.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ date: '2026-06-08', number: 8, puzzleId: 'pX', difficulty: 'easy' })
    db.puzzle.findFirst.mockResolvedValue({ id: 'p2' })
    db.daily.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }))
    const d = await getOrAssignDaily(db, '2026-06-08', 8, 'easy')
    expect(d.puzzleId).toBe('pX')
  })

  it('lanza si no hay puzzles disponibles', async () => {
    db.daily.findUnique.mockResolvedValue(null)
    db.puzzle.findFirst.mockResolvedValue(null)
    await expect(getOrAssignDaily(db, '2026-06-08', 8, 'easy')).rejects.toThrow('no_puzzles')
  })
})
```

- [ ] **Step 2: Falla** — `npx vitest run lib/daily/select.test.ts` → FAIL.

- [ ] **Step 3: Implementar** — `lib/daily/select.ts`:
```ts
export interface DailyRow {
  date: string
  number: number
  puzzleId: string
  difficulty: string
}

// Tipo mínimo de las operaciones de DB que usamos (para testear con un mock).
interface DailyDb {
  daily: {
    findUnique(args: { where: { date: string } }): Promise<DailyRow | null>
    create(args: { data: DailyRow }): Promise<DailyRow>
  }
  puzzle: {
    findFirst(args: unknown): Promise<{ id: string } | null>
    updateMany(args: unknown): Promise<{ count: number }>
  }
}

/** Devuelve el daily de `date` o asigna atómicamente uno disponible del pool. */
export async function getOrAssignDaily(
  db: DailyDb,
  date: string,
  number: number,
  difficulty: string,
): Promise<DailyRow> {
  const existing = await db.daily.findUnique({ where: { date } })
  if (existing) return existing

  const puzzle = await db.puzzle.findFirst({
    where: { status: 'available', difficulty, lang: 'en' },
    orderBy: { createdAt: 'asc' },
  })
  if (!puzzle) throw new Error('no_puzzles')

  try {
    const created = await db.daily.create({ data: { date, number, puzzleId: puzzle.id, difficulty } })
    await db.puzzle.updateMany({ where: { id: puzzle.id }, data: { status: 'assigned', type: 'daily' } })
    return created
  } catch (e) {
    // Otro request creó el daily primero (PK 'date' duplicada): devolver el suyo.
    const winner = await db.daily.findUnique({ where: { date } })
    if (winner) return winner
    throw e
  }
}
```

- [ ] **Step 4: Pasa** — `npx vitest run lib/daily/select.test.ts` → PASS (4).

- [ ] **Step 5: Commit** — `git add lib/daily/select.ts lib/daily/select.test.ts && git commit -m "feat: get-or-assign daily puzzle (atomic by date PK)"`

---

### Task 6: API daily/start + multiplicador ×3 en submit

**Files:**
- Create: `app/api/daily/start/route.ts`
- Modify: `app/api/ranked/submit/route.ts`

- [ ] **Step 1: Aplicar el multiplicador del daily en submit** — en `app/api/ranked/submit/route.ts`, localiza el bloque que calcula `change` y `next`:
```ts
  const change = computeRrChange({
    timeMs, parMs: parMs(optimalLen), stars, points: rating.points, mmr: rating.mmr,
    isPlacement: rating.placementsDone < 5, winStreak: rating.winStreak,
  })

  const state: RatingState = {
```
y reemplázalo por (aplica ×3 al RR visible del daily, sin distorsionar el MMR oculto):
```ts
  const DAILY_RR_MULTIPLIER = 3
  const rawChange = computeRrChange({
    timeMs, parMs: parMs(optimalLen), stars, points: rating.points, mmr: rating.mmr,
    isPlacement: rating.placementsDone < 5, winStreak: rating.winStreak,
  })
  const change = race.isDaily
    ? { ...rawChange, rrDelta: rawChange.rrDelta * DAILY_RR_MULTIPLIER }
    : rawChange

  const state: RatingState = {
```
(El resto del archivo usa `change.rrDelta`/`change.mmrDelta`/`change.won` sin cambios.)

- [ ] **Step 2: Verificar que los tests de submit siguen verdes**
Run: `npx vitest run app/api/ranked/submit/route.test.ts`
Expected: PASS (los tests existentes usan `isDaily` ausente/false → sin multiplicador).

- [ ] **Step 3: Implementar la API daily/start** — `app/api/daily/start/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { PID_COOKIE, signPid, parsePid } from '@/lib/player/identity'
import { rankedSecret } from '@/lib/config'
import { dailyNumber, difficultyForDate, utcDateString } from '@/lib/daily/number'
import { getOrAssignDaily } from '@/lib/daily/select'

export async function POST() {
  const secret = rankedSecret()
  const jar = await cookies()
  let playerId = parsePid(jar.get(PID_COOKIE)?.value ?? '', secret)
  if (!playerId) {
    const player = await db.player.create({ data: {} })
    playerId = player.id
    jar.set(PID_COOKIE, signPid(playerId, secret), { httpOnly: true, sameSite: 'lax', path: '/' })
  }

  const now = new Date()
  const date = utcDateString(now)
  const number = dailyNumber(now)
  const difficulty = difficultyForDate(now)

  let daily
  try {
    daily = await getOrAssignDaily(db, date, number, difficulty)
  } catch {
    return NextResponse.json({ error: 'no_puzzles' }, { status: 503 })
  }

  const puzzle = await db.puzzle.findUnique({ where: { id: daily.puzzleId } })
  if (!puzzle) return NextResponse.json({ error: 'no_puzzles' }, { status: 503 })

  // ¿El jugador ya completó el daily de hoy? (una sola vez cuenta para RR)
  const done = await db.race.findFirst({
    where: { playerId, puzzleId: daily.puzzleId, isDaily: true, status: 'completed' },
  })
  if (done) {
    return NextResponse.json({
      alreadyPlayed: true, number, date,
      start: puzzle.startTitle, target: puzzle.targetTitle, optimalLen: puzzle.optimalLen,
    })
  }

  // Reusar una carrera daily activa si existe; si no, crear una.
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

  return NextResponse.json({
    raceId: race.id, number, date, difficulty,
    start: puzzle.startTitle, target: puzzle.targetTitle, optimalLen: puzzle.optimalLen,
  })
}
```

- [ ] **Step 4: Build verde** — `npm run build` → rutas `/api/daily/start` listada; build ok.

- [ ] **Step 5: Commit**
```bash
git add app/api/daily app/api/ranked/submit/route.ts
git commit -m "feat: daily start API + 3x RR multiplier for daily races"
```

---

### Task 7: Pantalla del Daily (home) + streak + compartir + funnel

**Files:**
- Create: `app/daily/DailyClient.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Componente cliente del daily** — `app/daily/DailyClient.tsx`:
```tsx
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
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as DailyState
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
          <a href="/play">▶ Seguir jugando ranked</a>
        </p>
      </main>
    )
  }

  return (
    <main>
      <div style={{ textAlign: 'center', padding: 12 }}>
        <strong>Daily #{info.number}</strong> · 🔥 {state.streak}
      </div>
      <RaceView raceId={info.raceId!} lang="en" start={info.start} target={info.target} onFinish={onFinish} />
    </main>
  )
}
```

- [ ] **Step 2: `RaceView` debe aceptar `onFinish` y enviar al endpoint ranked** — `components/RaceView.tsx` actualmente postea a `/api/race/submit`. Para el daily/ranked debe postear a `/api/ranked/submit` y notificar el resultado. Modifica `components/RaceView.tsx`: agrega a `Props` el campo opcional `onFinish?: (r: Result & { valid: boolean }) => void` y un `submitUrl` opcional (default `/api/race/submit`):
```tsx
interface Props {
  raceId: string
  lang: string
  start: string
  target: string
  submitUrl?: string
  onFinish?: (r: { valid: boolean; timeMs: number; clicks: number; stars: number }) => void
}
```
En el componente, donde se hace `fetch('/api/race/submit', ...)`, usa `submitUrl ?? '/api/race/submit'`, y tras `setResult(await res.json())` invoca `onFinish?.(...)` con el json. Y en `DailyClient` pásale `submitUrl="/api/ranked/submit"`:
```tsx
<RaceView raceId={info.raceId!} lang="en" start={info.start} target={info.target}
  submitUrl="/api/ranked/submit" onFinish={onFinish} />
```
(Ajusta la llamada del Step 1 para incluir `submitUrl="/api/ranked/submit"`.)

- [ ] **Step 3: La home carga el daily** — reemplaza `app/page.tsx` por:
```tsx
import DailyClient from './daily/DailyClient'

export default function Home() {
  return <DailyClient />
}
```

- [ ] **Step 4: Verificar build** — `npm run build` → verde; `/` y `/api/daily/start` presentes.

- [ ] **Step 5: Commit**
```bash
git add app/page.tsx app/daily/DailyClient.tsx components/RaceView.tsx
git commit -m "feat: daily home screen with streak, share and ranked funnel"
```

---

### Task 8: Archivo básico

**Files:**
- Create: `app/archive/page.tsx`
- Create: `app/daily/[date]/page.tsx`

- [ ] **Step 1: Lista de archivo** — `app/archive/page.tsx` (server component, lee de la DB):
```tsx
import Link from 'next/link'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function ArchivePage() {
  const dailies = await db.daily.findMany({ orderBy: { number: 'desc' }, take: 60 })
  return (
    <main style={{ maxWidth: 560, margin: '40px auto', padding: 16 }}>
      <h1>Archivo de dailies</h1>
      <ul>
        {dailies.map((d) => (
          <li key={d.date}>
            <Link href={`/daily/${d.date}`}>#{d.number} · {d.date} · {d.difficulty}</Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 2: Jugar un daily pasado** — `app/daily/[date]/page.tsx` (server: arma una carrera de práctica sobre el puzzle de esa fecha; no afecta streak ni RR):
```tsx
import { db } from '@/lib/db'
import RaceView from '@/components/RaceView'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ArchiveDaily({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const daily = await db.daily.findUnique({ where: { date } })
  if (!daily) notFound()
  const puzzle = await db.puzzle.findUnique({ where: { id: daily.puzzleId } })
  if (!puzzle) notFound()

  const race = await db.race.create({
    data: { lang: 'en', startTitle: puzzle.startTitle, targetTitle: puzzle.targetTitle, puzzleId: puzzle.id },
  })

  return (
    <main>
      <div style={{ textAlign: 'center', padding: 12 }}>
        <strong>Daily #{daily.number}</strong> · {date} · (práctica de archivo)
      </div>
      <RaceView raceId={race.id} lang="en" start={puzzle.startTitle} target={puzzle.targetTitle} />
    </main>
  )
}
```
(Usa la API no-ranked por defecto de `RaceView` → no toca el rango.)

- [ ] **Step 3: Build verde** — `npm run build` → rutas `/archive` y `/daily/[date]` presentes.

- [ ] **Step 4: Commit**
```bash
git add app/archive app/daily/[date]
git commit -m "feat: basic daily archive (list + replay past dailies)"
```

---

### Task 9: Suite completa + nota operativa

- [ ] **Step 1: Suite verde** — `npx vitest run` → todos los archivos pasan (incluye number, state, card, select, submit).
- [ ] **Step 2: Build** — `npm run build` → verde.
- [ ] **Step 3: Commit (si hubo ajustes)** — `git add -A && git commit -m "test: full suite green for daily" || echo "nada que commitear"`

**Operativo:** la migración del modelo `Daily` se aplica a Railway en el deploy. El daily necesita puzzles en el pool (Plan 2). El multiplicador del daily se siente sólo cuando hay rating (post-placements).

---

## Self-Review (cobertura del spec 3B)

- **Daily = ranked especial ×3** → Task 6 (multiplicador en submit) + Task 1 (`Race.isDaily`). ✅
- **Lazy get-or-assign (sin cron)** → Task 5 (atómico por PK de fecha). ✅
- **Número de daily + rotación de dificultad (UTC)** → Task 2. ✅
- **Estrellas** → ya en 3A (`starsFor`), usadas vía submit. ✅
- **Streak/historial/"ya jugaste" en localStorage** → Task 3 (reducer) + Task 7 (wiring). ✅
- **Una sola vez cuenta para RR** → Task 6 (chequeo `done` en daily/start). ✅
- **Tarjeta de compartir (estrellas+tiempo+cuadros)** → Task 4 + Task 7. ✅
- **Funnel al ranked** → Task 7 (CTA "Seguir jugando ranked"). ✅
- **Archivo básico** → Task 8. ✅
- **Fuera de 3B:** UI pulida/juice + leaderboard (3C); temporadas (después). Correcto.

Tipos consistentes: `DailyState`/`DailyResultEntry`/`recordDaily`/`emptyDailyState`, `dailyNumber`/`difficultyForDate`/`utcDateString`, `buildShareCard`/`formatTime`/`ShareInput`, `getOrAssignDaily`/`DailyRow`, `Race.isDaily` — definidos una vez y reutilizados. Sin placeholders.

Nota: Task 7 modifica `RaceView` para aceptar `submitUrl`/`onFinish` sin romper su uso existente en `/play` (defaults preservan el comportamiento de Plan 1).
