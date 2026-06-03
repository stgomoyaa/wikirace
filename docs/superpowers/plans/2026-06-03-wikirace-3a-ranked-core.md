# WikiRace — Plan 3A: Núcleo ranked (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir jugar carreras ranked que mueven un rating server-side (tiers Iron→Grandmaster con divisiones, RR visible + MMR oculto, cambio por velocidad vs par), con identidad de invitado, placements y anti-trampa (token por paso + tiempos imposibles).

**Architecture:** Toda la matemática de rango es lógica **pura** (`lib/rank/*`, `lib/score/*`, `lib/race/token.ts`) representando el rating como **puntos absolutos** (división = 100 pts) más un MMR oculto; `tierFromPoints` deriva tier/división/RR para mostrar. La identidad de invitado vive en una cookie firmada. Las APIs ranked (`start`/`submit`) orquestan: validan el camino (Plan 1) + tokens, calculan el cambio de RR y persisten el rating.

**Tech Stack:** Next.js 16 (App Router) · TypeScript · Prisma 6 + Postgres · Vitest. Sin librerías nuevas (HMAC con `node:crypto`).

---

## Estructura de archivos

- `lib/score/stars.ts` — `starsFor(clicks, optimalLen)`. Puro.
- `lib/rank/tiers.ts` — escalera, `tierFromPoints`, `tierFloor`, `applyDelta`, `rankLabel`. Puro.
- `lib/rank/par.ts` — `parMs(optimalLen)`. Puro.
- `lib/rank/elo.ts` — `computeRrChange(input)`. Puro.
- `lib/rank/progress.ts` — `applyResult(rating, change)` (placements + normal). Puro.
- `lib/race/token.ts` — `signStep`, `verifyStep`, `isImpossibleTime`. Puro (HMAC).
- `lib/player/identity.ts` — `getOrCreatePlayerId(cookies)` (cookie firmada de invitado).
- `app/api/ranked/start/route.ts`, `app/api/ranked/submit/route.ts` — flujo ranked.
- `prisma/schema.prisma` — `Player`, `PlayerRating`, `RatingHistory` + extensión de `Race`.

Tareas 2-7 son lógica pura (TDD ideal para subagentes). Tareas 1, 8, 9 son integración.

---

### Task 1: Modelos de rating + extensión de Race

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260603130000_ranked/migration.sql`

- [ ] **Step 1: Agregar modelos y campos** — append a `prisma/schema.prisma`:
```prisma
model Player {
  id          String   @id @default(cuid())
  displayName String?
  country     String?
  googleId    String?  @unique
  createdAt   DateTime @default(now())
  rating      PlayerRating?
}

model PlayerRating {
  playerId       String   @id
  player         Player   @relation(fields: [playerId], references: [id])
  points         Int      @default(0) // RR absoluto en la escalera (división = 100)
  mmr            Int      @default(0) // MMR oculto, absoluto
  placementsDone Int      @default(0)
  shields        Int      @default(0)
  winStreak      Int      @default(0)
  peakPoints     Int      @default(0)
  seasonId       Int      @default(1)
  updatedAt      DateTime @updatedAt
}

model RatingHistory {
  id          String   @id @default(cuid())
  playerId    String
  raceId      String
  pointsAfter Int
  mmrAfter    Int
  rrDelta     Int
  createdAt   DateTime @default(now())
}
```
Y modifica el modelo `Race` existente agregando estos campos (no quites los actuales):
```prisma
  puzzleId String?
  playerId String?
  isRanked Boolean @default(false)
  stars    Int?
  rrDelta  Int?
```

- [ ] **Step 2: Generar la migración offline** (sin DB):
```bash
mkdir -p prisma/migrations/20260603130000_ranked
npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > /dev/null 2>&1 || true
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "file:./_shadow.db" --script 2>/dev/null > prisma/migrations/20260603130000_ranked/migration.sql || npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20260603130000_ranked/migration.sql
```
Si el comando con `--from-migrations` falla por shadow DB, usa esta alternativa robusta que NO necesita DB (diffea el estado de las migraciones previas contra el schema actual generando solo lo nuevo):
```bash
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20260603130000_ranked/migration.sql
```
Verifica:
```bash
cat prisma/migrations/20260603130000_ranked/migration.sql
```
Expected: contiene `CREATE TABLE "Player"`, `"PlayerRating"`, `"RatingHistory"` y `ALTER TABLE "Race" ADD COLUMN` para puzzleId/playerId/isRanked/stars/rrDelta. NO debe recrear `Race` ni `Puzzle`. Si emite SQL que recrea tablas existentes, STOP y reporta la salida.

- [ ] **Step 3: Generar client + validar + build**
```bash
npx prisma generate
npm run build
```
Expected: client generado; build verde (no conecta a DB).

- [ ] **Step 4: Commit**
```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: ranked data models (Player, PlayerRating, RatingHistory) + Race fields"
```
(Operativo: se aplica a Railway con `prisma migrate deploy` o en el build de Vercel.)

---

### Task 2: `starsFor` (TDD)

**Files:** Create `lib/score/stars.ts`, Test `lib/score/stars.test.ts`

- [ ] **Step 1: Test que falla** — `lib/score/stars.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { starsFor } from './stars'

describe('starsFor', () => {
  it('3 estrellas si igualas el óptimo', () => {
    expect(starsFor(4, 4)).toBe(3)
  })
  it('2 estrellas con un clic de más', () => {
    expect(starsFor(5, 4)).toBe(2)
  })
  it('1 estrella si te pasas por 2 o más', () => {
    expect(starsFor(6, 4)).toBe(1)
    expect(starsFor(10, 4)).toBe(1)
  })
})
```

- [ ] **Step 2: Falla** — `npx vitest run lib/score/stars.test.ts` → FAIL (módulo).

- [ ] **Step 3: Implementar** — `lib/score/stars.ts`:
```ts
/** Estrellas según clics vs largo óptimo: 3=óptimo, 2=óptimo+1, 1=resto. */
export function starsFor(clicks: number, optimalLen: number): 1 | 2 | 3 {
  if (clicks <= optimalLen) return 3
  if (clicks === optimalLen + 1) return 2
  return 1
}
```

- [ ] **Step 4: Pasa** — `npx vitest run lib/score/stars.test.ts` → PASS (3).

- [ ] **Step 5: Commit** — `git add lib/score/stars.ts lib/score/stars.test.ts && git commit -m "feat: star scoring"`

---

### Task 3: Escalera de tiers (TDD)

**Files:** Create `lib/rank/tiers.ts`, Test `lib/rank/tiers.test.ts`

Representación: `points` absolutos. División = 100 pts. 7 tiers con división (Iron..Diamond) × 4 = 28 divisiones → 0..2799. Master 2800-3299, Grandmaster 3300+. Dentro de un tier con divisiones, la división IV es la más baja (entras por ahí) y la I la más alta.

- [ ] **Step 1: Test que falla** — `lib/rank/tiers.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { tierFromPoints, tierFloor, applyDelta, rankLabel } from './tiers'

describe('tierFromPoints', () => {
  it('Iron IV en 0', () => {
    expect(tierFromPoints(0)).toMatchObject({ tier: 'Iron', division: 4, rr: 0 })
  })
  it('Iron III en 100', () => {
    expect(tierFromPoints(150)).toMatchObject({ tier: 'Iron', division: 3, rr: 50 })
  })
  it('Bronze IV en 400', () => {
    expect(tierFromPoints(400)).toMatchObject({ tier: 'Bronze', division: 4, rr: 0 })
  })
  it('Diamond I justo antes de Master', () => {
    expect(tierFromPoints(2799)).toMatchObject({ tier: 'Diamond', division: 1, rr: 99 })
  })
  it('Master sin división, RR acumulativo', () => {
    expect(tierFromPoints(2900)).toMatchObject({ tier: 'Master', division: 0, rr: 100 })
  })
  it('Grandmaster arriba de 3300', () => {
    expect(tierFromPoints(3500)).toMatchObject({ tier: 'Grandmaster', division: 0, rr: 200 })
  })
})

describe('tierFloor', () => {
  it('piso del tier actual (división IV) para Gold', () => {
    // Gold es el tier index 3 -> empieza en 3*400 = 1200
    expect(tierFloor(1350)).toBe(1200)
  })
})

describe('applyDelta', () => {
  it('suma puntos normalmente', () => {
    expect(applyDelta(150, 30, 0)).toEqual({ points: 180, shields: 0 })
  })
  it('no baja de 0', () => {
    expect(applyDelta(10, -50, 0)).toEqual({ points: 0, shields: 0 })
  })
  it('un escudo absorbe la caída por debajo del piso del tier y se consume', () => {
    // Gold IV floor = 1200; en 1210 con -30 caería a 1180 (fuera de Gold) -> escudo lo deja en 1200
    expect(applyDelta(1210, -30, 1)).toEqual({ points: 1200, shields: 0 })
  })
  it('sin escudos sí cae de tier', () => {
    expect(applyDelta(1210, -30, 0)).toEqual({ points: 1180, shields: 0 })
  })
})

describe('rankLabel', () => {
  it('formatea tier con división', () => {
    expect(rankLabel(150)).toBe('Iron III · 50 RR')
  })
  it('formatea ápex sin división', () => {
    expect(rankLabel(2900)).toBe('Master · 100 RR')
  })
})
```

- [ ] **Step 2: Falla** — `npx vitest run lib/rank/tiers.test.ts` → FAIL.

- [ ] **Step 3: Implementar** — `lib/rank/tiers.ts`:
```ts
export const DIVISIONED_TIERS = [
  'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond',
] as const
export const DIVISION_SIZE = 100
export const DIVISIONS_PER_TIER = 4
export const TIER_SPAN = DIVISION_SIZE * DIVISIONS_PER_TIER // 400
export const MASTER_FLOOR = DIVISIONED_TIERS.length * TIER_SPAN // 2800
export const GRANDMASTER_FLOOR = MASTER_FLOOR + 500 // 3300

export type TierName =
  | (typeof DIVISIONED_TIERS)[number]
  | 'Master'
  | 'Grandmaster'

export interface RankView {
  tier: TierName
  division: number // 0 para ápex; 1..4 para tiers con división (4 = más bajo)
  rr: number
}

export function tierFromPoints(points: number): RankView {
  const p = Math.max(0, Math.floor(points))
  if (p >= GRANDMASTER_FLOOR) return { tier: 'Grandmaster', division: 0, rr: p - GRANDMASTER_FLOOR }
  if (p >= MASTER_FLOOR) return { tier: 'Master', division: 0, rr: p - MASTER_FLOOR }
  const tierIndex = Math.floor(p / TIER_SPAN) // 0..6
  const withinTier = p - tierIndex * TIER_SPAN // 0..399
  const divIndex = Math.floor(withinTier / DIVISION_SIZE) // 0..3 (0 = más bajo)
  const rr = withinTier % DIVISION_SIZE
  return { tier: DIVISIONED_TIERS[tierIndex], division: DIVISIONS_PER_TIER - divIndex, rr }
}

/** Puntos del piso del tier actual (inicio de su división más baja). */
export function tierFloor(points: number): number {
  const p = Math.max(0, Math.floor(points))
  if (p >= GRANDMASTER_FLOOR) return GRANDMASTER_FLOOR
  if (p >= MASTER_FLOOR) return MASTER_FLOOR
  const tierIndex = Math.floor(p / TIER_SPAN)
  return tierIndex * TIER_SPAN
}

/** Aplica un delta de puntos. Un escudo absorbe una caída por debajo del piso del tier. */
export function applyDelta(
  points: number,
  delta: number,
  shields: number,
): { points: number; shields: number } {
  let next = points + delta
  if (delta < 0) {
    const floor = tierFloor(points)
    if (next < floor && shields > 0) {
      return { points: floor, shields: shields - 1 }
    }
  }
  if (next < 0) next = 0
  return { points: next, shields }
}

export function rankLabel(points: number): string {
  const v = tierFromPoints(points)
  if (v.division === 0) return `${v.tier} · ${v.rr} RR`
  const roman = ['I', 'II', 'III', 'IV'][v.division - 1]
  return `${v.tier} ${roman} · ${v.rr} RR`
}
```

- [ ] **Step 4: Pasa** — `npx vitest run lib/rank/tiers.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add lib/rank/tiers.ts lib/rank/tiers.test.ts && git commit -m "feat: rank tier ladder (points<->tier, shields)"`

---

### Task 4: Par-time (TDD)

**Files:** Create `lib/rank/par.ts`, Test `lib/rank/par.test.ts`

- [ ] **Step 1: Test que falla** — `lib/rank/par.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parMs, BASE_MS_PER_HOP } from './par'

describe('parMs', () => {
  it('escala con el largo óptimo', () => {
    expect(parMs(3)).toBe(3 * BASE_MS_PER_HOP)
    expect(parMs(5)).toBe(5 * BASE_MS_PER_HOP)
  })
  it('nunca devuelve 0 o negativo', () => {
    expect(parMs(0)).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Falla** — `npx vitest run lib/rank/par.test.ts` → FAIL.

- [ ] **Step 3: Implementar** — `lib/rank/par.ts`:
```ts
/** Tiempo base esperado por salto óptimo (ms). Se calibrará con datos reales. */
export const BASE_MS_PER_HOP = 20_000

/** Par-time esperado para un puzzle de largo óptimo `optimalLen`. */
export function parMs(optimalLen: number): number {
  const hops = Math.max(1, Math.floor(optimalLen))
  return hops * BASE_MS_PER_HOP
}
```
(Nota: el ajuste por MMR queda como calibración futura; la convergencia en `elo.ts` ya trackea la habilidad.)

- [ ] **Step 4: Pasa** — `npx vitest run lib/rank/par.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add lib/rank/par.ts lib/rank/par.test.ts && git commit -m "feat: par-time from optimal length"`

---

### Task 5: Cálculo de cambio de RR (TDD)

**Files:** Create `lib/rank/elo.ts`, Test `lib/rank/elo.test.ts`

- [ ] **Step 1: Test que falla** — `lib/rank/elo.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { computeRrChange } from './elo'

const base = { stars: 1 as 1 | 2 | 3, points: 1000, mmr: 1000, isPlacement: false, winStreak: 0 }

describe('computeRrChange', () => {
  it('gana RR si bate el par', () => {
    const r = computeRrChange({ ...base, timeMs: 30_000, parMs: 60_000 })
    expect(r.won).toBe(true)
    expect(r.rrDelta).toBeGreaterThan(0)
  })
  it('pierde RR si va más lento que el par', () => {
    const r = computeRrChange({ ...base, timeMs: 90_000, parMs: 60_000 })
    expect(r.won).toBe(false)
    expect(r.rrDelta).toBeLessThan(0)
  })
  it('3 estrellas dan más que 1 al ganar', () => {
    const a = computeRrChange({ ...base, stars: 1, timeMs: 30_000, parMs: 60_000 })
    const b = computeRrChange({ ...base, stars: 3, timeMs: 30_000, parMs: 60_000 })
    expect(b.rrDelta).toBeGreaterThan(a.rrDelta)
  })
  it('convergencia: con MMR muy por encima del rank, gana más', () => {
    const low = computeRrChange({ ...base, mmr: 1000, timeMs: 30_000, parMs: 60_000 })
    const high = computeRrChange({ ...base, mmr: 1500, timeMs: 30_000, parMs: 60_000 })
    expect(high.rrDelta).toBeGreaterThan(low.rrDelta)
  })
  it('placements mueven el MMR más rápido (x2)', () => {
    const normal = computeRrChange({ ...base, timeMs: 30_000, parMs: 60_000 })
    const place = computeRrChange({ ...base, isPlacement: true, timeMs: 30_000, parMs: 60_000 })
    expect(Math.abs(place.mmrDelta)).toBeGreaterThan(Math.abs(normal.mmrDelta))
  })
})
```

- [ ] **Step 2: Falla** — `npx vitest run lib/rank/elo.test.ts` → FAIL.

- [ ] **Step 3: Implementar** — `lib/rank/elo.ts`:
```ts
export interface RrChangeInput {
  timeMs: number
  parMs: number
  stars: 1 | 2 | 3
  points: number
  mmr: number
  isPlacement: boolean
  winStreak: number
}

export interface RrChange {
  rrDelta: number
  mmrDelta: number
  won: boolean
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))

/** Cambio de RR/MMR por una carrera ranked, basado en velocidad vs par. Puro. */
export function computeRrChange(input: RrChangeInput): RrChange {
  const { timeMs, parMs, stars, points, mmr, isPlacement, winStreak } = input
  const won = timeMs <= parMs

  // -1..1 : positivo = más rápido que el par
  const speedScore = clamp((parMs - timeMs) / parMs, -1, 1)
  let base = Math.round(speedScore * 25)

  // MMR sigue la habilidad cruda (sin protecciones)
  let mmrDelta = base

  if (base > 0) {
    base += stars === 3 ? 5 : stars === 2 ? 2 : 0
    if (winStreak >= 2) base += Math.min(winStreak, 5)
  }

  // Convergencia: si el MMR está por encima del rank visible, amplifica ganancias / amortigua pérdidas
  const gap = mmr - points
  if (gap > 0) {
    const factor = Math.min(gap, 500) / 500 // 0..1
    if (base > 0) base = Math.round(base * (1 + factor * 0.5))
    else if (base < 0) base = Math.round(base * (1 - factor * 0.5))
  }

  if (isPlacement) {
    base = Math.round(base * 2)
    mmrDelta = Math.round(mmrDelta * 2)
  }

  return { rrDelta: base, mmrDelta, won }
}
```

- [ ] **Step 4: Pasa** — `npx vitest run lib/rank/elo.test.ts` → PASS (5).

- [ ] **Step 5: Commit** — `git add lib/rank/elo.ts lib/rank/elo.test.ts && git commit -m "feat: RR/MMR change from speed vs par (convergence, stars, streak)"`

---

### Task 6: Aplicar resultado al rating (placements + normal) (TDD)

**Files:** Create `lib/rank/progress.ts`, Test `lib/rank/progress.test.ts`

- [ ] **Step 1: Test que falla** — `lib/rank/progress.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { applyResult, RatingState } from './progress'

const fresh: RatingState = {
  points: 0, mmr: 1000, placementsDone: 0, shields: 0, winStreak: 0, peakPoints: 0,
}

describe('applyResult', () => {
  it('durante placements mueve MMR pero no revela puntos hasta la 5ª', () => {
    let s: RatingState = { ...fresh }
    for (let i = 0; i < 4; i++) {
      s = applyResult(s, { rrDelta: 20, mmrDelta: 20, won: true })
      expect(s.points).toBe(0) // aún oculto
    }
    expect(s.placementsDone).toBe(4)
    s = applyResult(s, { rrDelta: 20, mmrDelta: 20, won: true }) // 5ª
    expect(s.placementsDone).toBe(5)
    expect(s.points).toBe(s.mmr) // revelado en el MMR alcanzado
  })

  it('tras placements, aplica rrDelta a los puntos', () => {
    const placed: RatingState = { ...fresh, placementsDone: 5, points: 1000, mmr: 1000 }
    const s = applyResult(placed, { rrDelta: 25, mmrDelta: 25, won: true })
    expect(s.points).toBe(1025)
  })

  it('cuenta racha de victorias y la corta al perder', () => {
    let s: RatingState = { ...fresh, placementsDone: 5, points: 1000 }
    s = applyResult(s, { rrDelta: 20, mmrDelta: 20, won: true })
    expect(s.winStreak).toBe(1)
    s = applyResult(s, { rrDelta: -20, mmrDelta: -20, won: false })
    expect(s.winStreak).toBe(0)
  })

  it('actualiza peakPoints', () => {
    const placed: RatingState = { ...fresh, placementsDone: 5, points: 1000, peakPoints: 1000 }
    const s = applyResult(placed, { rrDelta: 30, mmrDelta: 30, won: true })
    expect(s.peakPoints).toBe(1030)
  })
})
```

- [ ] **Step 2: Falla** — `npx vitest run lib/rank/progress.test.ts` → FAIL.

- [ ] **Step 3: Implementar** — `lib/rank/progress.ts`:
```ts
import { applyDelta } from './tiers'
import { RrChange } from './elo'

export interface RatingState {
  points: number
  mmr: number
  placementsDone: number
  shields: number
  winStreak: number
  peakPoints: number
}

const PLACEMENTS_REQUIRED = 5

/** Aplica el resultado de una carrera ranked al estado de rating. Puro. */
export function applyResult(state: RatingState, change: RrChange): RatingState {
  const mmr = Math.max(0, state.mmr + change.mmrDelta)
  const winStreak = change.won ? state.winStreak + 1 : 0

  // Durante placements: solo se mueve el MMR; los puntos se revelan en la 5ª.
  if (state.placementsDone < PLACEMENTS_REQUIRED) {
    const placementsDone = state.placementsDone + 1
    const revealed = placementsDone >= PLACEMENTS_REQUIRED
    const points = revealed ? mmr : 0
    return {
      ...state,
      mmr,
      placementsDone,
      winStreak,
      points,
      peakPoints: Math.max(state.peakPoints, points),
    }
  }

  const { points, shields } = applyDelta(state.points, change.rrDelta, state.shields)
  return {
    ...state,
    mmr,
    points,
    shields,
    winStreak,
    peakPoints: Math.max(state.peakPoints, points),
  }
}
```

- [ ] **Step 4: Pasa** — `npx vitest run lib/rank/progress.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add lib/rank/progress.ts lib/rank/progress.test.ts && git commit -m "feat: apply ranked result (placements + normal + streak + peak)"`

---

### Task 7: Anti-trampa — token por paso + tiempo imposible (TDD)

**Files:** Create `lib/race/token.ts`, Test `lib/race/token.test.ts`

- [ ] **Step 1: Test que falla** — `lib/race/token.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { signStep, verifyStep, isImpossibleTime } from './token'

const SECRET = 'test-secret'

describe('step tokens', () => {
  it('un token firmado se verifica', () => {
    const t = signStep('race1', 'Dog', SECRET)
    expect(verifyStep('race1', 'Dog', t, SECRET)).toBe(true)
  })
  it('rechaza token de otro artículo o carrera', () => {
    const t = signStep('race1', 'Dog', SECRET)
    expect(verifyStep('race1', 'Cat', t, SECRET)).toBe(false)
    expect(verifyStep('race2', 'Dog', t, SECRET)).toBe(false)
  })
  it('rechaza token manipulado', () => {
    expect(verifyStep('race1', 'Dog', 'garbage', SECRET)).toBe(false)
  })
})

describe('isImpossibleTime', () => {
  it('marca como imposible un tiempo absurdamente bajo para los saltos', () => {
    // 5 saltos en 200ms es imposible
    expect(isImpossibleTime(200, 5)).toBe(true)
  })
  it('acepta un tiempo plausible', () => {
    expect(isImpossibleTime(15_000, 5)).toBe(false)
  })
})
```

- [ ] **Step 2: Falla** — `npx vitest run lib/race/token.test.ts` → FAIL.

- [ ] **Step 3: Implementar** — `lib/race/token.ts`:
```ts
import { createHmac, timingSafeEqual } from 'node:crypto'
import { normalizeTitle } from '@/lib/wiki/title'

/** Tiempo mínimo plausible por salto (ms): leer + clickear. */
export const MIN_MS_PER_HOP = 600

function hmac(raceId: string, title: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`${raceId}:${normalizeTitle(title)}`)
    .digest('hex')
}

/** Firma un token que prueba que `title` fue servido por nuestro proxy para `raceId`. */
export function signStep(raceId: string, title: string, secret: string): string {
  return hmac(raceId, title, secret)
}

/** Verifica el token de un paso (comparación de tiempo constante). */
export function verifyStep(
  raceId: string,
  title: string,
  token: string,
  secret: string,
): boolean {
  const expected = hmac(raceId, title, secret)
  if (token.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  } catch {
    return false
  }
}

/** ¿El tiempo total es físicamente imposible para esa cantidad de saltos? */
export function isImpossibleTime(timeMs: number, hops: number): boolean {
  return timeMs < hops * MIN_MS_PER_HOP
}
```

- [ ] **Step 4: Pasa** — `npx vitest run lib/race/token.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add lib/race/token.ts lib/race/token.test.ts && git commit -m "feat: per-step HMAC tokens + impossible-time check"`

---

### Task 8: Identidad de invitado por cookie firmada

**Files:** Create `lib/player/identity.ts`, Test `lib/player/identity.test.ts`

Usa una cookie firmada `wr_pid` = `playerId.hmac`. Pura para firmar/verificar; el get-or-create de DB se hace en las APIs.

- [ ] **Step 1: Test que falla** — `lib/player/identity.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { signPid, parsePid } from './identity'

const SECRET = 'pid-secret'

describe('player id cookie', () => {
  it('firma y parsea un playerId', () => {
    const cookie = signPid('player123', SECRET)
    expect(parsePid(cookie, SECRET)).toBe('player123')
  })
  it('rechaza cookie manipulada', () => {
    const cookie = signPid('player123', SECRET)
    const tampered = cookie.replace('player123', 'attacker')
    expect(parsePid(tampered, SECRET)).toBeNull()
  })
  it('devuelve null para basura', () => {
    expect(parsePid('nope', SECRET)).toBeNull()
  })
})
```

- [ ] **Step 2: Falla** — `npx vitest run lib/player/identity.test.ts` → FAIL.

- [ ] **Step 3: Implementar** — `lib/player/identity.ts`:
```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

export const PID_COOKIE = 'wr_pid'

function sig(id: string, secret: string): string {
  return createHmac('sha256', secret).update(id).digest('hex')
}

/** Cookie firmada: `${id}.${hmac}`. */
export function signPid(id: string, secret: string): string {
  return `${id}.${sig(id, secret)}`
}

/** Devuelve el playerId si la firma es válida, si no null. */
export function parsePid(cookie: string, secret: string): string | null {
  const dot = cookie.lastIndexOf('.')
  if (dot <= 0) return null
  const id = cookie.slice(0, dot)
  const mac = cookie.slice(dot + 1)
  const expected = sig(id, secret)
  if (mac.length !== expected.length) return null
  try {
    return timingSafeEqual(Buffer.from(mac), Buffer.from(expected)) ? id : null
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Pasa** — `npx vitest run lib/player/identity.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add lib/player/identity.ts lib/player/identity.test.ts && git commit -m "feat: signed guest player-id cookie helpers"`

---

### Task 9: APIs ranked (start + submit)

**Files:**
- Create: `app/api/ranked/start/route.ts`
- Create: `app/api/ranked/submit/route.ts`
- Test: `app/api/ranked/submit/route.test.ts`

Contexto: reutiliza el flujo de Plan 1 pero ranked. `start` elige un puzzle del pool por dificultad del tier del jugador, crea una `Race` (isRanked, puzzleId, playerId), y devuelve los **tokens por paso** firmados para el artículo inicial (el proxy de Plan 1 ya sirve el HTML; aquí se entregan tokens). `submit` valida camino + tokens + tiempo imposible, calcula estrellas, par, RR/MMR, aplica al rating y persiste.

Secreto: usar `process.env.RANKED_SECRET ?? 'dev-secret'`.

- [ ] **Step 1: Test que falla (submit, con DB y deps mockeadas)** — `app/api/ranked/submit/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    race: { findUnique: vi.fn(), update: vi.fn() },
    puzzle: { findUnique: vi.fn() },
    playerRating: { findUnique: vi.fn(), upsert: vi.fn() },
    ratingHistory: { create: vi.fn() },
  },
}))
vi.mock('@/lib/wiki/client', () => ({
  fetchArticle: vi.fn(async (_l: string, title: string) => ({
    title, lang: 'en', html: '', links: { Dog: ['Mammal'], Mammal: ['Cat'] }[title] ?? [],
  })),
}))

import { POST } from './route'
import { db } from '@/lib/db'

const race = {
  id: 'r1', lang: 'en', startTitle: 'Dog', targetTitle: 'Cat', status: 'active',
  startedAt: new Date(Date.now() - 30_000), isRanked: true, puzzleId: 'p1', playerId: 'pl1',
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.race.findUnique as any).mockResolvedValue(race)
  ;(db.puzzle.findUnique as any).mockResolvedValue({ id: 'p1', optimalLen: 2 })
  ;(db.playerRating.findUnique as any).mockResolvedValue({
    playerId: 'pl1', points: 1000, mmr: 1000, placementsDone: 5, shields: 0, winStreak: 0, peakPoints: 1000,
  })
  ;(db.race.update as any).mockImplementation(async ({ data }: any) => ({ ...race, ...data }))
  ;(db.playerRating.upsert as any).mockImplementation(async ({ create, update }: any) => ({ ...create, ...update }))
})

describe('POST /api/ranked/submit', () => {
  it('valida, calcula estrellas y devuelve un cambio de RR', async () => {
    const req = new Request('http://x', { method: 'POST',
      body: JSON.stringify({ raceId: 'r1', path: ['Dog', 'Mammal', 'Cat'] }) })
    const res = await POST(req as any)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.valid).toBe(true)
    expect(json.stars).toBe(3) // clicks=2 == optimalLen=2
    expect(typeof json.rrDelta).toBe('number')
    expect(db.playerRating.upsert).toHaveBeenCalledOnce()
  })

  it('rechaza tiempo imposible', async () => {
    ;(db.race.findUnique as any).mockResolvedValue({ ...race, startedAt: new Date() }) // ~0ms
    const req = new Request('http://x', { method: 'POST',
      body: JSON.stringify({ raceId: 'r1', path: ['Dog', 'Mammal', 'Cat'] }) })
    const res = await POST(req as any)
    const json = await res.json()
    expect(json.valid).toBe(false)
    expect(json.reason).toBe('impossible_time')
  })
})
```

- [ ] **Step 2: Falla** — `npx vitest run app/api/ranked/submit/route.test.ts` → FAIL (módulo).

- [ ] **Step 3: Implementar `submit`** — `app/api/ranked/submit/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchArticle } from '@/lib/wiki/client'
import { validatePath, LinksOf } from '@/lib/race/validate'
import { isImpossibleTime } from '@/lib/race/token'
import { starsFor } from '@/lib/score/stars'
import { parMs } from '@/lib/rank/par'
import { computeRrChange } from '@/lib/rank/elo'
import { applyResult, RatingState } from '@/lib/rank/progress'

const MAX_PATH = 50

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { raceId, path } = body as { raceId?: string; path?: string[] }
  if (
    typeof raceId !== 'string' || !Array.isArray(path) ||
    path.length < 2 || path.length > MAX_PATH ||
    !path.every((p) => typeof p === 'string' && p.length > 0 && p.length <= 300)
  ) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const race = await db.race.findUnique({ where: { id: raceId } })
  if (!race || !race.isRanked) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (race.status !== 'active') return NextResponse.json({ error: 'already_submitted' }, { status: 409 })

  const timeMs = Date.now() - new Date(race.startedAt).getTime()
  const clicks = path.length - 1

  if (isImpossibleTime(timeMs, clicks)) {
    await db.race.update({ where: { id: raceId }, data: { status: 'invalid', valid: false } })
    return NextResponse.json({ valid: false, reason: 'impossible_time' })
  }

  const linksOf: LinksOf = async (lang, title) => (await fetchArticle(lang, title)).links
  let result
  try {
    result = await validatePath(race.lang, path, race.startTitle, race.targetTitle, linksOf)
  } catch {
    return NextResponse.json({ error: 'validation_error' }, { status: 400 })
  }

  if (!result.valid) {
    await db.race.update({ where: { id: raceId }, data: { status: 'invalid', valid: false, timeMs, clicks, path: JSON.stringify(path) } })
    return NextResponse.json({ valid: false, reason: result.reason })
  }

  const puzzle = race.puzzleId ? await db.puzzle.findUnique({ where: { id: race.puzzleId } }) : null
  const optimalLen = puzzle?.optimalLen ?? clicks
  const stars = starsFor(clicks, optimalLen)

  const rating = (await db.playerRating.findUnique({ where: { playerId: race.playerId! } })) ?? {
    playerId: race.playerId!, points: 0, mmr: 1000, placementsDone: 0, shields: 0, winStreak: 0, peakPoints: 0,
  }

  const change = computeRrChange({
    timeMs, parMs: parMs(optimalLen), stars, points: rating.points, mmr: rating.mmr,
    isPlacement: rating.placementsDone < 5, winStreak: rating.winStreak,
  })

  const state: RatingState = {
    points: rating.points, mmr: rating.mmr, placementsDone: rating.placementsDone,
    shields: rating.shields, winStreak: rating.winStreak, peakPoints: rating.peakPoints,
  }
  const next = applyResult(state, change)

  await db.race.update({ where: { id: raceId }, data: { status: 'completed', valid: true, timeMs, clicks, stars, rrDelta: change.rrDelta, path: JSON.stringify(path) } })
  await db.playerRating.upsert({
    where: { playerId: race.playerId! },
    create: { playerId: race.playerId!, ...next },
    update: { ...next },
  })
  await db.ratingHistory.create({ data: { playerId: race.playerId!, raceId, pointsAfter: next.points, mmrAfter: next.mmr, rrDelta: change.rrDelta } })

  return NextResponse.json({
    valid: true, stars, timeMs, clicks, rrDelta: change.rrDelta,
    points: next.points, placementsDone: next.placementsDone,
  })
}
```

- [ ] **Step 4: Pasa (submit)** — `npx vitest run app/api/ranked/submit/route.test.ts` → PASS (2).

- [ ] **Step 5: Implementar `start`** — `app/api/ranked/start/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { PID_COOKIE, signPid, parsePid } from '@/lib/player/identity'
import { tierFromPoints } from '@/lib/rank/tiers'

const SECRET = process.env.RANKED_SECRET ?? 'dev-secret'

function difficultyForTier(tier: string): string {
  if (['Iron', 'Bronze', 'Silver'].includes(tier)) return 'easy'
  if (['Gold', 'Platinum'].includes(tier)) return 'medium'
  return 'hard'
}

export async function POST() {
  const jar = await cookies()
  let playerId = parsePid(jar.get(PID_COOKIE)?.value ?? '', SECRET)
  if (!playerId) {
    const player = await db.player.create({ data: {} })
    playerId = player.id
    jar.set(PID_COOKIE, signPid(playerId, SECRET), { httpOnly: true, sameSite: 'lax', path: '/' })
  }

  const rating = await db.playerRating.findUnique({ where: { playerId } })
  const view = tierFromPoints(rating?.points ?? 0)
  const difficulty = difficultyForTier(view.tier)

  const puzzle = await db.puzzle.findFirst({ where: { difficulty, lang: 'en' }, orderBy: { createdAt: 'asc' } })
  if (!puzzle) return NextResponse.json({ error: 'no_puzzles' }, { status: 503 })

  const race = await db.race.create({
    data: { lang: 'en', startTitle: puzzle.startTitle, targetTitle: puzzle.targetTitle, isRanked: true, puzzleId: puzzle.id, playerId },
  })

  return NextResponse.json({
    raceId: race.id, lang: 'en', start: puzzle.startTitle, target: puzzle.targetTitle,
    difficulty, optimalLen: puzzle.optimalLen,
  })
}
```

- [ ] **Step 6: Build verde** — `npm run build` → succeeds; rutas `/api/ranked/start` y `/api/ranked/submit` listadas.

- [ ] **Step 7: Commit**
```bash
git add app/api/ranked
git commit -m "feat: ranked start/submit APIs (rating update, anti-cheat)"
```

---

### Task 10: Suite completa + nota operativa

- [ ] **Step 1: Suite verde** — `npx vitest run` → todos los archivos pasan (incluye stars, tiers, par, elo, progress, token, identity, submit).
- [ ] **Step 2: Build** — `npm run build` → verde.
- [ ] **Step 3: Commit (si hubo ajustes)** — `git add -A && git commit -m "test: full suite green for ranked core" || echo "nada que commitear"`

**Operativo (controlador/usuario):** aplicar la migración a Railway (`prisma migrate deploy` o deploy a Vercel) y setear `RANKED_SECRET` en Vercel. El flujo ranked necesita puzzles en el pool (Plan 2).

---

## Self-Review (cobertura del spec 3A)

- **Identidad invitado (cookie firmada)** → Task 8 + Task 9 (`start`). ✅
- **Modelos Player/PlayerRating/RatingHistory + Race** → Task 1. ✅
- **Tiers (Iron→Grandmaster, divisiones, RR, shields)** → Task 3. ✅ (Polymath = corte de leaderboard, va en 3C.)
- **Par-time** → Task 4 (MMR-calibración diferida, notado). ✅
- **Cambio de RR por velocidad + convergencia + estrellas + racha** → Task 5. ✅
- **Placements (5 + reveal)** → Task 6. ✅
- **Protección indulgente (shields, piso)** → Task 3 (`applyDelta`) + Task 6. ✅
- **Anti-trampa (token por paso + tiempo imposible)** → Task 7 + Task 9 (`submit` usa isImpossibleTime; el cableado de verificación de tokens por paso se integra cuando el proxy emita tokens — ver nota). ✅(parcial)
- **Flujo carrera ranked (start→submit→update rating)** → Task 9. ✅
- **Estrellas** → Task 2. ✅
- **Fuera de 3A:** Daily/funnel/streak/share/archivo (3B); UI/juice/leaderboard/Polymath (3C); temporadas (después). Correcto.

Nota de integración pendiente para 3C: el proxy de artículos (`/api/wiki`) debe **emitir** los tokens `signStep(raceId, title)` y `submit` **verificarlos** por cada paso. En 3A se entrega la primitiva (`signStep`/`verifyStep`) y el chequeo de tiempo imposible; el cableado token-por-token con el proxy se completa junto a la UI ranked en 3C (requiere pasar `raceId` al proxy). Esto se marca explícito para no asumir cobertura total de tokens en 3A.

Tipos consistentes: `RankView`, `RrChangeInput`/`RrChange`, `RatingState`, `starsFor`, `parMs`, `computeRrChange`, `applyResult`, `signStep`/`verifyStep`/`isImpossibleTime`, `signPid`/`parsePid` definidos una vez y reutilizados. Sin placeholders.
