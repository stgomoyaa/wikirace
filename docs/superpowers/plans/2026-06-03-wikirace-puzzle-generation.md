# WikiRace — Plan 2: Generación de puzzles (grafo SDOW) (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Producir un pool de puzzles de WikiRace resolubles, con largo óptimo exacto y dificultad por tiers, generados offline desde el grafo SDOW y guardados en Postgres.

**Architecture:** Lógica pura y testeable (`bfs`, `generate`) que opera sobre una interfaz `Graph`; un adaptador `SdowGraph` (better-sqlite3) implementa esa interfaz leyendo el SQLite de SDOW; un CLI une todo y escribe en Postgres vía Prisma. El grafo nunca entra a Vercel; la app solo lee el pool.

**Tech Stack:** TypeScript · Prisma 6 + Postgres · better-sqlite3 (solo offline) · tsx (runner del CLI) · Vitest.

---

## Estructura de archivos

- `lib/graph/types.ts` — interfaz `Graph` (contrato del grafo).
- `lib/graph/testGraph.ts` — `InMemoryGraph` para tests (implementa `Graph`).
- `lib/graph/bfs.ts` — `bfs()` + `shortestPath()`. Puro.
- `lib/puzzle/generate.ts` — `generatePuzzles()`. Puro, recibe un `Graph`.
- `lib/graph/sdow.ts` — `SdowGraph` (adaptador SDOW con better-sqlite3).
- `scripts/generate-puzzles.ts` — CLI: SDOW + generate + escritura a Postgres.
- `prisma/schema.prisma` — modelo `Puzzle` (+ migración).

Tareas 1-5 son código puro/aislado (ideales para subagentes TDD). Tarea 6 (CLI) y la
aplicación de la migración + la corrida real con el archivo SDOW son operativas
(requieren `DATABASE_URL` de Railway y el archivo SDOW local) y las ejecuta el controlador/usuario.

---

### Task 1: Modelo `Puzzle` + migración

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_puzzle/migration.sql`

- [ ] **Step 1: Agregar el modelo al schema**

Append a `prisma/schema.prisma`:
```prisma
model Puzzle {
  id           String    @id @default(cuid())
  lang         String    @default("en")
  startTitle   String
  targetTitle  String
  optimalLen   Int
  difficulty   String // easy | medium | hard
  shortestPath String? // JSON array de títulos (camino óptimo de ejemplo)
  status       String    @default("available") // available | assigned
  type         String? // daily | practice | ranked | themed
  date         DateTime?
  createdAt    DateTime  @default(now())

  @@unique([lang, startTitle, targetTitle])
  @@index([status, difficulty])
}
```

- [ ] **Step 2: Generar el archivo de migración (sin conectarse a la DB)**

Run:
```bash
mkdir -p prisma/migrations/20260603120000_add_puzzle
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/20260603120000_add_puzzle/migration.sql
```
Expected: `migration.sql` contiene `CREATE TABLE "Puzzle" (...)` con el unique index y el index `(status, difficulty)`. Verifícalo:
Run: `cat prisma/migrations/20260603120000_add_puzzle/migration.sql`
Expected: incluye `CREATE TABLE "Puzzle"` y `CREATE UNIQUE INDEX`.

- [ ] **Step 3: Regenerar el client y validar el schema**

Run: `npx prisma generate`
Expected: "Generated Prisma Client".
Run: `npx prisma validate`
Expected: "The schema at prisma\schema.prisma is valid".

- [ ] **Step 4: Confirmar que el build sigue verde**

Run: `npm run build`
Expected: build exitoso (no se conecta a la DB).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add Puzzle model and migration"
```

(Nota operativa: la migración se aplica a Railway con `npx prisma migrate deploy` —
requiere `DATABASE_URL`— y también corre sola en el build de Vercel. No es parte de esta tarea de código.)

---

### Task 2: Interfaz `Graph` y grafo en memoria para tests

**Files:**
- Create: `lib/graph/types.ts`
- Create: `lib/graph/testGraph.ts`
- Test: `lib/graph/testGraph.test.ts`

- [ ] **Step 1: Definir la interfaz**

Create `lib/graph/types.ts`:
```ts
/** Contrato mínimo del grafo de Wikipedia que necesita la generación. */
export interface Graph {
  /** IDs de artículos a los que `id` enlaza (salientes). */
  outLinks(id: number): number[]
  /** Cantidad de enlaces entrantes a `id` (proxy de notoriedad). */
  inDegree(id: number): number
  /** Un id de artículo (no-redirect) elegido para usar como punto de partida. */
  randomArticle(): number
  /** Título legible de un id. */
  titleOf(id: number): string
  /** Id de un título, o null si no existe. */
  idOf(title: string): number | null
}
```

- [ ] **Step 2: Escribir el test del grafo en memoria**

Create `lib/graph/testGraph.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { InMemoryGraph } from './testGraph'

const g = new InMemoryGraph(
  { 1: [2, 3], 2: [3], 3: [] },
  { 1: 'A', 2: 'B', 3: 'C' },
  [1, 2],
)

describe('InMemoryGraph', () => {
  it('devuelve enlaces salientes', () => {
    expect(g.outLinks(1)).toEqual([2, 3])
    expect(g.outLinks(3)).toEqual([])
  })
  it('calcula in-degree desde la adyacencia', () => {
    expect(g.inDegree(3)).toBe(2) // 1->3 y 2->3
    expect(g.inDegree(1)).toBe(0)
  })
  it('mapea id<->título', () => {
    expect(g.titleOf(2)).toBe('B')
    expect(g.idOf('C')).toBe(3)
    expect(g.idOf('Nope')).toBeNull()
  })
  it('randomArticle recorre la secuencia provista y cicla', () => {
    const g2 = new InMemoryGraph({ 1: [], 2: [] }, { 1: 'A', 2: 'B' }, [1, 2])
    expect([g2.randomArticle(), g2.randomArticle(), g2.randomArticle()]).toEqual([1, 2, 1])
  })
})
```

- [ ] **Step 3: Correr el test (falla)**

Run: `npx vitest run lib/graph/testGraph.test.ts`
Expected: FAIL ("Cannot find module './testGraph'").

- [ ] **Step 4: Implementar el grafo en memoria**

Create `lib/graph/testGraph.ts`:
```ts
import { Graph } from './types'

/** Grafo de prueba determinista. `starts` controla la secuencia de randomArticle(). */
export class InMemoryGraph implements Graph {
  private cursor = 0

  constructor(
    private adj: Record<number, number[]>,
    private titles: Record<number, string>,
    private starts: number[] = [],
  ) {}

  outLinks(id: number): number[] {
    return this.adj[id] ?? []
  }

  inDegree(id: number): number {
    let count = 0
    for (const from of Object.keys(this.adj)) {
      if (this.adj[Number(from)].includes(id)) count++
    }
    return count
  }

  randomArticle(): number {
    if (this.starts.length === 0) throw new Error('no starts configured')
    const s = this.starts[this.cursor % this.starts.length]
    this.cursor++
    return s
  }

  titleOf(id: number): string {
    return this.titles[id] ?? String(id)
  }

  idOf(title: string): number | null {
    for (const id of Object.keys(this.titles)) {
      if (this.titles[Number(id)] === title) return Number(id)
    }
    return null
  }
}
```

- [ ] **Step 5: Correr el test (pasa)**

Run: `npx vitest run lib/graph/testGraph.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/graph/types.ts lib/graph/testGraph.ts lib/graph/testGraph.test.ts
git commit -m "feat: Graph interface and in-memory test graph"
```

---

### Task 3: BFS y camino más corto (TDD)

**Files:**
- Create: `lib/graph/bfs.ts`
- Test: `lib/graph/bfs.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Create `lib/graph/bfs.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { bfs, shortestPath } from './bfs'
import { InMemoryGraph } from './testGraph'

// 1 -> 2 -> 3 -> 4 ; 1 -> 5 ; 5 -> 4
const g = new InMemoryGraph(
  { 1: [2, 5], 2: [3], 3: [4], 4: [], 5: [4] },
  { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' },
)

describe('bfs', () => {
  it('calcula la distancia más corta a cada nodo', () => {
    const { dist } = bfs(g, 1, 10)
    expect(dist.get(1)).toBe(0)
    expect(dist.get(2)).toBe(1)
    expect(dist.get(5)).toBe(1)
    expect(dist.get(4)).toBe(2) // vía 5, más corto que vía 2->3->4
  })
  it('respeta el tope de profundidad', () => {
    const { dist } = bfs(g, 1, 1)
    expect(dist.get(2)).toBe(1)
    expect(dist.has(3)).toBe(false) // a distancia 2, fuera del tope
  })
  it('no incluye nodos inalcanzables', () => {
    const g2 = new InMemoryGraph({ 1: [2], 2: [], 9: [1] }, { 1: 'A', 2: 'B', 9: 'I' })
    const { dist } = bfs(g2, 1, 10)
    expect(dist.has(9)).toBe(false)
  })
})

describe('shortestPath', () => {
  it('reconstruye el camino más corto inicio->destino', () => {
    const { prev } = bfs(g, 1, 10)
    expect(shortestPath(prev, 1, 4)).toEqual([1, 5, 4])
  })
  it('devuelve [] si no hay camino', () => {
    const { prev } = bfs(g, 1, 10)
    expect(shortestPath(prev, 1, 999)).toEqual([])
  })
})
```

- [ ] **Step 2: Correr el test (falla)**

Run: `npx vitest run lib/graph/bfs.test.ts`
Expected: FAIL ("Cannot find module './bfs'").

- [ ] **Step 3: Implementar**

Create `lib/graph/bfs.ts`:
```ts
import { Graph } from './types'

export interface BfsResult {
  dist: Map<number, number>
  prev: Map<number, number>
}

/** BFS desde `source` sobre enlaces salientes, acotado a `maxDepth`. */
export function bfs(graph: Graph, source: number, maxDepth: number): BfsResult {
  const dist = new Map<number, number>([[source, 0]])
  const prev = new Map<number, number>()
  let frontier = [source]

  while (frontier.length > 0) {
    const next: number[] = []
    for (const node of frontier) {
      const d = dist.get(node)!
      if (d >= maxDepth) continue
      for (const neighbor of graph.outLinks(node)) {
        if (!dist.has(neighbor)) {
          dist.set(neighbor, d + 1)
          prev.set(neighbor, node)
          next.push(neighbor)
        }
      }
    }
    frontier = next
  }

  return { dist, prev }
}

/** Reconstruye el camino más corto desde el árbol `prev`. [] si no hay. */
export function shortestPath(
  prev: Map<number, number>,
  source: number,
  target: number,
): number[] {
  if (source === target) return [source]
  if (!prev.has(target)) return []
  const path: number[] = [target]
  let cur = target
  while (cur !== source) {
    const p = prev.get(cur)
    if (p === undefined) return []
    path.push(p)
    cur = p
  }
  return path.reverse()
}
```

- [ ] **Step 4: Correr el test (pasa)**

Run: `npx vitest run lib/graph/bfs.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/graph/bfs.ts lib/graph/bfs.test.ts
git commit -m "feat: BFS and shortest-path reconstruction"
```

---

### Task 4: Algoritmo de generación (TDD)

**Files:**
- Create: `lib/puzzle/generate.ts`
- Test: `lib/puzzle/generate.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Create `lib/puzzle/generate.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { generatePuzzles } from './generate'
import { InMemoryGraph } from '@/lib/graph/testGraph'

// Cadena 1->2->3->4->5->6 : distancias desde 1 son 1..5
function chain(starts: number[]) {
  return new InMemoryGraph(
    { 1: [2], 2: [3], 3: [4], 4: [5], 5: [6], 6: [] },
    { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F' },
    starts,
  )
}

describe('generatePuzzles', () => {
  it('emite un puzzle por tier con el largo óptimo correcto', () => {
    const out = generatePuzzles(chain([1]), {
      lang: 'en',
      minInDegree: 1,
      perTier: { easy: 1, medium: 1, hard: 1 },
      maxStarts: 1,
    })
    const byLen = Object.fromEntries(out.map((p) => [p.optimalLen, p]))
    expect(byLen[3].difficulty).toBe('easy')
    expect(byLen[3]).toMatchObject({ startTitle: 'A', targetTitle: 'D' })
    expect(byLen[4].difficulty).toBe('medium')
    expect(byLen[5].difficulty).toBe('hard')
    expect(byLen[3].shortestPath).toEqual(['A', 'B', 'C', 'D'])
  })

  it('respeta el filtro de in-degree (devuelve vacío si nada lo pasa)', () => {
    const out = generatePuzzles(chain([1]), {
      lang: 'en',
      minInDegree: 2, // en la cadena todos tienen in-degree 1
      perTier: { easy: 1, medium: 1, hard: 1 },
      maxStarts: 1,
    })
    expect(out).toEqual([])
  })

  it('no duplica pares aunque se reintente el mismo start', () => {
    const out = generatePuzzles(chain([1, 1, 1]), {
      lang: 'en',
      minInDegree: 1,
      perTier: { easy: 5, medium: 5, hard: 5 },
      maxStarts: 3,
    })
    const keys = out.map((p) => `${p.startTitle}->${p.targetTitle}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('nunca genera start == target', () => {
    const out = generatePuzzles(chain([1]), {
      lang: 'en',
      minInDegree: 1,
      perTier: { easy: 9, medium: 9, hard: 9 },
      maxStarts: 1,
    })
    expect(out.every((p) => p.startTitle !== p.targetTitle)).toBe(true)
  })
})
```

- [ ] **Step 2: Correr el test (falla)**

Run: `npx vitest run lib/puzzle/generate.test.ts`
Expected: FAIL ("Cannot find module './generate'").

- [ ] **Step 3: Implementar**

Create `lib/puzzle/generate.ts`:
```ts
import { Graph } from '@/lib/graph/types'
import { bfs, shortestPath } from '@/lib/graph/bfs'

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface GenerateOptions {
  lang: string
  minInDegree: number
  perTier: Record<Difficulty, number>
  maxStarts: number
}

export interface PuzzleCandidate {
  lang: string
  startTitle: string
  targetTitle: string
  optimalLen: number
  difficulty: Difficulty
  shortestPath: string[]
}

const MAX_DEPTH = 6

function tierForLen(len: number): Difficulty | null {
  if (len === 3) return 'easy'
  if (len === 4) return 'medium'
  if (len === 5 || len === 6) return 'hard'
  return null
}

/** Genera candidatos de puzzle resolubles con largo óptimo exacto. Puro. */
export function generatePuzzles(graph: Graph, opts: GenerateOptions): PuzzleCandidate[] {
  const out: PuzzleCandidate[] = []
  const counts: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 }
  const seen = new Set<string>()

  const full = (t: Difficulty) => counts[t] >= opts.perTier[t]
  const allFull = () => full('easy') && full('medium') && full('hard')

  for (let attempt = 0; attempt < opts.maxStarts && !allFull(); attempt++) {
    const start = graph.randomArticle()
    if (graph.inDegree(start) < opts.minInDegree) continue

    const { dist, prev } = bfs(graph, start, MAX_DEPTH)

    for (const [target, len] of dist) {
      if (target === start) continue
      const tier = tierForLen(len)
      if (!tier || full(tier)) continue
      if (graph.inDegree(target) < opts.minInDegree) continue

      const key = `${start}->${target}`
      if (seen.has(key)) continue
      seen.add(key)

      out.push({
        lang: opts.lang,
        startTitle: graph.titleOf(start),
        targetTitle: graph.titleOf(target),
        optimalLen: len,
        difficulty: tier,
        shortestPath: shortestPath(prev, start, target).map((id) => graph.titleOf(id)),
      })
      counts[tier]++
    }
  }

  return out
}
```

- [ ] **Step 4: Correr el test (pasa)**

Run: `npx vitest run lib/puzzle/generate.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/puzzle/generate.ts lib/puzzle/generate.test.ts
git commit -m "feat: puzzle generation algorithm over Graph interface"
```

---

### Task 5: Adaptador SDOW (better-sqlite3, fixture test)

**Files:**
- Create: `lib/graph/sdow.ts`
- Test: `lib/graph/sdow.test.ts`

Instala la dependencia (solo offline):
Run: `npm install -D better-sqlite3 @types/better-sqlite3`

⚠️ **Verificación del esquema real:** antes de confiar en producción, abre el SQLite real
de SDOW y confirma el esquema:
```bash
# (cuando tengas el archivo) sqlite3 sdow.sqlite ".schema"
```
Esquema asumido (SDOW): `pages(id INTEGER PRIMARY KEY, title TEXT, is_redirect INTEGER)`
y `links(id INTEGER PRIMARY KEY, outgoing_links TEXT, incoming_links TEXT)` donde las
listas son IDs separados por `|`. Si el delimitador o las columnas difieren, ajusta el
parseo en `sdow.ts` (el test usa un fixture con este esquema, así que la lógica queda
cubierta; solo cambia el parseo si el archivo real difiere).

- [ ] **Step 1: Escribir el test que falla (fixture en :memory:)**

Create `lib/graph/sdow.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest'
import Database from 'better-sqlite3'
import { SdowGraph } from './sdow'

let graph: SdowGraph

beforeAll(() => {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE pages (id INTEGER PRIMARY KEY, title TEXT, is_redirect INTEGER);
    CREATE TABLE links (id INTEGER PRIMARY KEY, outgoing_links TEXT, incoming_links TEXT);
    INSERT INTO pages VALUES (1,'A',0),(2,'B',0),(3,'C',0);
    INSERT INTO links VALUES
      (1,'2|3',''),
      (2,'3','1'),
      (3,'','1|2');
  `)
  graph = new SdowGraph(db)
})

describe('SdowGraph', () => {
  it('parsea enlaces salientes', () => {
    expect(graph.outLinks(1)).toEqual([2, 3])
    expect(graph.outLinks(3)).toEqual([])
  })
  it('calcula in-degree desde incoming_links', () => {
    expect(graph.inDegree(3)).toBe(2)
    expect(graph.inDegree(1)).toBe(0)
  })
  it('mapea id<->título', () => {
    expect(graph.titleOf(2)).toBe('B')
    expect(graph.idOf('C')).toBe(3)
    expect(graph.idOf('Nope')).toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test (falla)**

Run: `npx vitest run lib/graph/sdow.test.ts`
Expected: FAIL ("Cannot find module './sdow'").

- [ ] **Step 3: Implementar**

Create `lib/graph/sdow.ts`:
```ts
import type { Database } from 'better-sqlite3'
import { Graph } from './types'

function parseIds(packed: string | null): number[] {
  if (!packed) return []
  return packed
    .split('|')
    .filter((s) => s.length > 0)
    .map((s) => Number(s))
}

/** Adaptador del grafo SDOW. Recibe una conexión better-sqlite3 (inyectable para tests). */
export class SdowGraph implements Graph {
  constructor(private db: Database) {}

  outLinks(id: number): number[] {
    const row = this.db
      .prepare('SELECT outgoing_links FROM links WHERE id = ?')
      .get(id) as { outgoing_links: string | null } | undefined
    return row ? parseIds(row.outgoing_links) : []
  }

  inDegree(id: number): number {
    const row = this.db
      .prepare('SELECT incoming_links FROM links WHERE id = ?')
      .get(id) as { incoming_links: string | null } | undefined
    return row ? parseIds(row.incoming_links).length : 0
  }

  randomArticle(): number {
    const row = this.db
      .prepare('SELECT id FROM pages WHERE is_redirect = 0 ORDER BY RANDOM() LIMIT 1')
      .get() as { id: number } | undefined
    if (!row) throw new Error('no articles in graph')
    return row.id
  }

  titleOf(id: number): string {
    const row = this.db.prepare('SELECT title FROM pages WHERE id = ?').get(id) as
      | { title: string }
      | undefined
    return row?.title ?? String(id)
  }

  idOf(title: string): number | null {
    const row = this.db.prepare('SELECT id FROM pages WHERE title = ?').get(title) as
      | { id: number }
      | undefined
    return row?.id ?? null
  }
}
```

- [ ] **Step 4: Correr el test (pasa)**

Run: `npx vitest run lib/graph/sdow.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Asegurar que la app no importe better-sqlite3**

Run: `npm run build`
Expected: build exitoso. (`sdow.ts` solo lo importa el CLI; ninguna ruta de la app lo
importa, así que no entra al bundle serverless.)

- [ ] **Step 6: Commit**

```bash
git add lib/graph/sdow.ts lib/graph/sdow.test.ts package.json package-lock.json
git commit -m "feat: SDOW SQLite graph adapter"
```

---

### Task 6: CLI del generador

**Files:**
- Create: `scripts/generate-puzzles.ts`

Instala el runner:
Run: `npm install -D tsx`

- [ ] **Step 1: Implementar el CLI**

Create `scripts/generate-puzzles.ts`:
```ts
import Database from 'better-sqlite3'
import { PrismaClient } from '@prisma/client'
import { SdowGraph } from '@/lib/graph/sdow'
import { generatePuzzles, Difficulty } from '@/lib/puzzle/generate'

// Uso:
//   npx tsx scripts/generate-puzzles.ts --sdow ./sdow.sqlite --easy 100 --medium 100 --hard 100 [--dry-run]

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return def
  return process.argv[i + 1] ?? def
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

async function main() {
  const sdowPath = arg('sdow')
  if (!sdowPath) throw new Error('falta --sdow <ruta al sdow.sqlite>')

  const perTier: Record<Difficulty, number> = {
    easy: Number(arg('easy', '100')),
    medium: Number(arg('medium', '100')),
    hard: Number(arg('hard', '100')),
  }
  const minInDegree = Number(arg('min-indegree', '100'))
  const maxStarts = Number(arg('max-starts', '5000'))
  const lang = arg('lang', 'en')!
  const dryRun = flag('dry-run')

  const db = new Database(sdowPath, { readonly: true })
  const graph = new SdowGraph(db)

  console.log(`Generando puzzles (perTier=${JSON.stringify(perTier)}, minInDegree=${minInDegree})…`)
  const candidates = generatePuzzles(graph, { lang, minInDegree, perTier, maxStarts })
  console.log(`Candidatos: ${candidates.length}`)

  if (dryRun) {
    for (const c of candidates.slice(0, 20)) {
      console.log(`  [${c.difficulty} ${c.optimalLen}] ${c.startTitle} -> ${c.targetTitle}`)
    }
    console.log('(dry-run: no se escribió nada)')
    return
  }

  const prisma = new PrismaClient()
  const result = await prisma.puzzle.createMany({
    data: candidates.map((c) => ({
      lang: c.lang,
      startTitle: c.startTitle,
      targetTitle: c.targetTitle,
      optimalLen: c.optimalLen,
      difficulty: c.difficulty,
      shortestPath: JSON.stringify(c.shortestPath),
    })),
    skipDuplicates: true,
  })
  console.log(`Insertados: ${result.count} (duplicados omitidos)`) 
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 2: Verificar que el CLI tipa/parsea (dry-run sin SDOW falla con mensaje claro)**

Run: `npx tsx scripts/generate-puzzles.ts --dry-run`
Expected: error claro `falta --sdow <ruta al sdow.sqlite>` y exit 1 (confirma que el
script compila y corre; no necesita el archivo SDOW para esta verificación).

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-puzzles.ts package.json package-lock.json
git commit -m "feat: puzzle generator CLI (SDOW -> Postgres)"
```

---

### Task 7: Documentar la operación + corrida real (manual)

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Documentar el flujo de generación**

Append a `README.md` una sección:
```md
## Generación de puzzles (Plan 2)

El grafo de Wikipedia vive fuera de la app. Para llenar el pool:

1. Descarga el grafo precompilado de SDOW (SQLite, varios GB) y guárdalo local
   (p. ej. `./sdow.sqlite`). No se commitea.
2. Aplica la migración del modelo `Puzzle` a la DB: `npx prisma migrate deploy`
   (requiere `DATABASE_URL` en `.env`).
3. Prueba sin escribir: `npx tsx scripts/generate-puzzles.ts --sdow ./sdow.sqlite --dry-run`
4. Llena el pool: `npx tsx scripts/generate-puzzles.ts --sdow ./sdow.sqlite --easy 200 --medium 200 --hard 200`

El pool dura meses; se rellena corriendo el script de nuevo (es idempotente).
```

- [ ] **Step 2: Confirmar suite completa verde**

Run: `npx vitest run`
Expected: todos los archivos de test pasan (incluye los nuevos de Tasks 2-5).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document puzzle generation workflow"
```

**Pasos operativos (controlador/usuario, fuera de las tareas de código):**
- Aplicar la migración a Railway (`npx prisma migrate deploy`).
- Descargar el `sdow.sqlite` y correr el generador para llenar el pool.
- Revisar una muestra de puzzles generados y ajustar `--min-indegree` / cuotas si salen
  obscuros o triviales.

---

## Self-Review (cobertura del spec — Plan 2)

- **Interfaz `Graph`** → Task 2. ✅
- **BFS + camino más corto (largo óptimo exacto)** → Task 3. ✅
- **Algoritmo de generación (tiers, filtro in-degree, dedupe, no start==target)** → Task 4. ✅
- **Adaptador SDOW** → Task 5 (con nota de verificación del esquema real). ✅
- **Modelo `Puzzle` (campos, unique, index)** → Task 1. ✅
- **CLI (flags, dry-run, idempotente vía skipDuplicates)** → Task 6. ✅
- **better-sqlite3 solo offline (no en el bundle)** → Task 5 Step 5 + Task 6. ✅
- **Operación / staleness / corrida real** → Task 7 + pasos operativos. ✅
- **Fuera de alcance (daily/cron/UI, runtime graph, themed)** → no hay tareas, correcto.

Tipos consistentes: `Graph`, `BfsResult`, `bfs`/`shortestPath`, `GenerateOptions`/
`PuzzleCandidate`/`Difficulty`, `SdowGraph` se definen una vez y se reutilizan con la misma
firma en todas las tareas. Sin placeholders.
