# WikiRace — Plan 1: Fundación + carrera jugable (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tener una WikiRace jugable de punta a punta en modo Práctica: el jugador elige (o sortea) artículo de inicio y destino, navega Wikipedia dentro de nuestro shell usando solo enlaces internos, y el servidor valida el camino y calcula tiempo/clics.

**Architecture:** Next.js (App Router, TypeScript) full-stack. Un proxy server-side trae el HTML de artículos desde la REST API de Wikipedia, lo sanea (extrae enlaces internos, neutraliza el resto) y lo cachea. El motor de carrera es client-side: intercepta clics en enlaces internos, registra el camino, sin "atrás" ni buscador. El tiempo es autoritativo del servidor (inicio al crear la carrera, fin al enviar el camino) y el camino se valida server-side reproduciendo cada salto.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · Prisma + SQLite (dev/test; Postgres/Neon en producción se configura en el plan de despliegue) · node-html-parser · Vitest + @testing-library/react.

---

## Estructura de archivos (decisiones de descomposición)

- `lib/wiki/sanitize.ts` — función pura: HTML crudo → `{ html, links }`. Único responsable de saneo y extracción de enlaces.
- `lib/wiki/title.ts` — normalización/comparación de títulos de Wikipedia.
- `lib/wiki/client.ts` — `fetchArticle(lang, title, fetchImpl?)`: trae y sanea un artículo. Aísla el acceso de red (fetch inyectable para tests).
- `lib/race/validate.ts` — `validatePath(...)`: lógica pura de validación de un camino (recibe un `linksOf` inyectable).
- `lib/db.ts` — instancia singleton de Prisma.
- `app/api/wiki/[lang]/[title]/route.ts` — proxy HTTP con caché.
- `app/api/race/start/route.ts` — crea la carrera (tiempo de inicio autoritativo).
- `app/api/race/submit/route.ts` — valida el camino y calcula resultado.
- `app/play/page.tsx` — pantalla de Práctica (formulario inicio/destino + sorteo).
- `components/RaceView.tsx` — motor de carrera client-side (render del artículo, intercepción de clics, timer).
- `prisma/schema.prisma` — modelo `Race`.

Cada archivo tiene una responsabilidad única; la lógica testeable (saneo, títulos, validación) vive separada de la red y de la UI.

---

### Task 1: Scaffold del proyecto

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `vitest.setup.ts`, `app/layout.tsx`, `app/page.tsx`, `.gitignore`

- [ ] **Step 1: Crear el proyecto Next.js con TypeScript**

Run:
```bash
npx create-next-app@latest . --typescript --app --no-tailwind --no-src-dir --eslint --use-npm --no-import-alias
```
Expected: genera `app/`, `package.json`, `tsconfig.json`, `next.config.ts`. Responder "No" a Turbopack si pregunta.

- [ ] **Step 2: Instalar dependencias del dominio y de test**

Run:
```bash
npm install node-html-parser @prisma/client
npm install -D prisma vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```
Expected: instala sin errores; aparecen en `package.json`.

- [ ] **Step 3: Configurar Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
})
```

Create `vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 4: Agregar script de test**

Modify `package.json` — en `"scripts"` agregar:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Asegurar .gitignore**

Modify `.gitignore` — agregar al final:
```
# superpowers visual companion
.superpowers/
# local db
*.db
*.db-journal
.env
```

- [ ] **Step 6: Verificar que compila y testea (sin tests aún)**

Run: `npm run build`
Expected: build exitoso.
Run: `npm test`
Expected: "No test files found" (exit 0 con `vitest run` y sin tests; aceptable).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + TypeScript + Vitest"
```

---

### Task 2: Modelo de datos `Race` (Prisma + SQLite)

**Files:**
- Create: `prisma/schema.prisma`, `lib/db.ts`, `.env`

- [ ] **Step 1: Inicializar Prisma con SQLite**

Run: `npx prisma init --datasource-provider sqlite`
Expected: crea `prisma/schema.prisma` y agrega `DATABASE_URL` a `.env`.

Modify `.env` para que quede:
```
DATABASE_URL="file:./dev.db"
```

- [ ] **Step 2: Definir el modelo `Race`**

Replace `prisma/schema.prisma` con:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Race {
  id          String    @id @default(cuid())
  lang        String    @default("en")
  startTitle  String
  targetTitle String
  status      String    @default("active") // active | completed | invalid
  startedAt   DateTime  @default(now())
  completedAt DateTime?
  timeMs      Int?
  clicks      Int?
  path        String?   // JSON array de títulos
  valid       Boolean   @default(false)
}
```

- [ ] **Step 3: Crear la migración**

Run: `npx prisma migrate dev --name init_race`
Expected: crea `prisma/migrations/...` y `dev.db`; genera el client.

- [ ] **Step 4: Singleton de Prisma**

Create `lib/db.ts`:
```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Race model and Prisma client"
```

---

### Task 3: Normalización de títulos (puro, TDD)

**Files:**
- Create: `lib/wiki/title.ts`
- Test: `lib/wiki/title.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Create `lib/wiki/title.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { normalizeTitle, titlesEqual } from './title'

describe('normalizeTitle', () => {
  it('convierte guiones bajos a espacios y recorta', () => {
    expect(normalizeTitle('Albert_Einstein ')).toBe('Albert Einstein')
  })
  it('decodifica porcentajes', () => {
    expect(normalizeTitle('Caf%C3%A9')).toBe('Café')
  })
  it('quita el prefijo ./ de enlaces REST', () => {
    expect(normalizeTitle('./Alan_Turing')).toBe('Alan Turing')
  })
})

describe('titlesEqual', () => {
  it('compara ignorando mayúscula inicial y separadores', () => {
    expect(titlesEqual('alan_Turing', 'Alan Turing')).toBe(true)
  })
  it('distingue títulos diferentes', () => {
    expect(titlesEqual('Dog', 'Cat')).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test para ver que falla**

Run: `npx vitest run lib/wiki/title.test.ts`
Expected: FAIL ("Cannot find module './title'").

- [ ] **Step 3: Implementar**

Create `lib/wiki/title.ts`:
```ts
/** Normaliza un título de Wikipedia a su forma legible canónica. */
export function normalizeTitle(raw: string): string {
  let t = raw.trim()
  if (t.startsWith('./')) t = t.slice(2)
  try {
    t = decodeURIComponent(t)
  } catch {
    // dejar como está si no es URI válida
  }
  t = t.replace(/_/g, ' ').trim()
  return t
}

/** Compara dos títulos: Wikipedia ignora la mayúscula de la primera letra. */
export function titlesEqual(a: string, b: string): boolean {
  const na = normalizeTitle(a)
  const nb = normalizeTitle(b)
  if (na.length === 0 || nb.length === 0) return na === nb
  const ci = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
  return ci(na) === ci(nb)
}
```

- [ ] **Step 4: Correr el test para ver que pasa**

Run: `npx vitest run lib/wiki/title.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/wiki/title.ts lib/wiki/title.test.ts
git commit -m "feat: wiki title normalization and comparison"
```

---

### Task 4: Saneo de HTML y extracción de enlaces (puro, TDD)

**Files:**
- Create: `lib/wiki/sanitize.ts`
- Test: `lib/wiki/sanitize.test.ts`

La REST API de Wikipedia (`/api/rest_v1/page/html/{title}`) marca los enlaces de artículo como `<a rel="mw:WikiLink" href="./Title">`. Los enlaces a otros espacios de nombres (File:, Category:, Help:) contienen `:` y deben neutralizarse.

- [ ] **Step 1: Escribir el test que falla**

Create `lib/wiki/sanitize.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { sanitizeArticleHtml } from './sanitize'

const SAMPLE = `
<section>
  <p>
    <a rel="mw:WikiLink" href="./Physics">physics</a> and
    <a rel="mw:WikiLink" href="./Alan_Turing">Turing</a>.
  </p>
  <a rel="mw:WikiLink" href="./File:Logo.png">a file</a>
  <a rel="mw:ExtLink" href="https://example.com">external</a>
  <span class="mw-editsection">[edit]</span>
  <script>alert(1)</script>
</section>`

describe('sanitizeArticleHtml', () => {
  it('extrae solo enlaces internos de artículo', () => {
    const { links } = sanitizeArticleHtml(SAMPLE)
    expect(links).toEqual(['Physics', 'Alan Turing'])
  })
  it('reescribe enlaces internos con data-wiki-title y clase wiki-link', () => {
    const { html } = sanitizeArticleHtml(SAMPLE)
    expect(html).toContain('data-wiki-title="Physics"')
    expect(html).toContain('class="wiki-link"')
  })
  it('elimina scripts y secciones de edición', () => {
    const { html } = sanitizeArticleHtml(SAMPLE)
    expect(html).not.toContain('<script')
    expect(html).not.toContain('mw-editsection')
  })
  it('neutraliza enlaces externos y de otros namespaces (no clickeables)', () => {
    const { html } = sanitizeArticleHtml(SAMPLE)
    expect(html).not.toContain('https://example.com')
    expect(html).not.toContain('File:Logo.png')
  })
})
```

- [ ] **Step 2: Correr el test para ver que falla**

Run: `npx vitest run lib/wiki/sanitize.test.ts`
Expected: FAIL ("Cannot find module './sanitize'").

- [ ] **Step 3: Implementar**

Create `lib/wiki/sanitize.ts`:
```ts
import { parse } from 'node-html-parser'
import { normalizeTitle } from './title'

export interface SanitizeResult {
  html: string
  links: string[]
}

const KILL_SELECTORS = ['script', 'style', '.mw-editsection', 'link', 'meta']

/** Sanea el HTML de un artículo de Wikipedia y extrae sus enlaces internos. */
export function sanitizeArticleHtml(raw: string): SanitizeResult {
  const root = parse(raw, { comment: false })

  for (const sel of KILL_SELECTORS) {
    root.querySelectorAll(sel).forEach((el) => el.remove())
  }

  const links: string[] = []
  const seen = new Set<string>()

  for (const a of root.querySelectorAll('a')) {
    const href = a.getAttribute('href') ?? ''
    const isInternal = href.startsWith('./') && !href.slice(2).includes(':')
    if (isInternal) {
      const title = normalizeTitle(href)
      a.setAttribute('data-wiki-title', title)
      a.setAttribute('class', 'wiki-link')
      a.removeAttribute('href')
      a.removeAttribute('rel')
      if (!seen.has(title)) {
        seen.add(title)
        links.push(title)
      }
    } else {
      // externo o de otro namespace: neutralizar
      a.removeAttribute('href')
      a.removeAttribute('rel')
      a.setAttribute('data-disabled', 'true')
    }
  }

  return { html: root.toString(), links }
}
```

- [ ] **Step 4: Correr el test para ver que pasa**

Run: `npx vitest run lib/wiki/sanitize.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/wiki/sanitize.ts lib/wiki/sanitize.test.ts
git commit -m "feat: sanitize Wikipedia HTML and extract internal links"
```

---

### Task 5: Cliente de Wikipedia (`fetchArticle`, TDD con fetch mockeado)

**Files:**
- Create: `lib/wiki/client.ts`
- Test: `lib/wiki/client.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Create `lib/wiki/client.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { fetchArticle, REST_BASE } from './client'

const HTML = `<a rel="mw:WikiLink" href="./Dog">dog</a>`

describe('fetchArticle', () => {
  it('pide la URL REST correcta y devuelve título, html y links', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => HTML,
    }) as unknown as typeof fetch

    const article = await fetchArticle('en', 'Cat', fakeFetch)

    expect(fakeFetch).toHaveBeenCalledWith(
      `${REST_BASE('en')}/Cat`,
      expect.any(Object),
    )
    expect(article.title).toBe('Cat')
    expect(article.lang).toBe('en')
    expect(article.links).toEqual(['Dog'])
    expect(article.html).toContain('data-wiki-title="Dog"')
  })

  it('lanza error si la respuesta no es ok', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch
    await expect(fetchArticle('en', 'Nope', fakeFetch)).rejects.toThrow('404')
  })
})
```

- [ ] **Step 2: Correr el test para ver que falla**

Run: `npx vitest run lib/wiki/client.test.ts`
Expected: FAIL ("Cannot find module './client'").

- [ ] **Step 3: Implementar**

Create `lib/wiki/client.ts`:
```ts
import { sanitizeArticleHtml } from './sanitize'
import { normalizeTitle } from './title'

export interface WikiArticle {
  title: string
  lang: string
  html: string
  links: string[]
}

export const REST_BASE = (lang: string) =>
  `https://${lang}.wikipedia.org/api/rest_v1/page/html`

/** Trae y sanea un artículo. `fetchImpl` es inyectable para tests. */
export async function fetchArticle(
  lang: string,
  title: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WikiArticle> {
  const encoded = encodeURIComponent(title.replace(/ /g, '_'))
  const res = await fetchImpl(`${REST_BASE(lang)}/${encoded}`, {
    headers: { 'User-Agent': 'WikiRace/1.0 (contacto@ejemplo.com)' },
    // caché de 24h a nivel de Next (ignorado por fetch mock en tests)
    next: { revalidate: 86400 },
  } as RequestInit)

  if (!res.ok) {
    throw new Error(`Wikipedia fetch failed: ${(res as Response).status}`)
  }

  const raw = await res.text()
  const { html, links } = sanitizeArticleHtml(raw)
  return { title: normalizeTitle(title), lang, html, links }
}
```

- [ ] **Step 4: Correr el test para ver que pasa**

Run: `npx vitest run lib/wiki/client.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/wiki/client.ts lib/wiki/client.test.ts
git commit -m "feat: Wikipedia article client with injectable fetch"
```

---

### Task 6: Proxy HTTP de artículos

**Files:**
- Create: `app/api/wiki/[lang]/[title]/route.ts`

- [ ] **Step 1: Implementar el route handler**

Create `app/api/wiki/[lang]/[title]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { fetchArticle } from '@/lib/wiki/client'

export const revalidate = 86400

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ lang: string; title: string }> },
) {
  const { lang, title } = await params
  try {
    const article = await fetchArticle(lang, decodeURIComponent(title))
    return NextResponse.json(article, {
      headers: { 'Cache-Control': 'public, s-maxage=86400' },
    })
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
}
```

Nota: `create-next-app --no-import-alias` puede no configurar `@/`. Si `@/lib/...` no resuelve, usar rutas relativas o agregar a `tsconfig.json` en `compilerOptions`: `"paths": { "@/*": ["./*"] }` y `"baseUrl": "."`.

- [ ] **Step 2: Verificar `@/` y compilar**

Modify `tsconfig.json` si hace falta: en `compilerOptions` asegurar:
```json
"baseUrl": ".",
"paths": { "@/*": ["./*"] }
```
Run: `npm run build`
Expected: build exitoso, la ruta `/api/wiki/[lang]/[title]` aparece listada.

- [ ] **Step 3: Probar el proxy manualmente**

Run: `npm run dev` (en otra terminal) y luego:
```bash
curl "http://localhost:3000/api/wiki/en/Cat" | head -c 300
```
Expected: JSON con `"title":"Cat"`, `"links":[...]`, `"html":"..."`. Detener `dev` después.

- [ ] **Step 4: Commit**

```bash
git add app/api/wiki tsconfig.json
git commit -m "feat: Wikipedia proxy route with caching"
```

---

### Task 7: API de inicio de carrera (tiempo autoritativo, TDD)

**Files:**
- Create: `app/api/race/start/route.ts`
- Test: `app/api/race/start/route.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Create `app/api/race/start/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { race: { create: vi.fn() } },
}))

import { POST } from './route'
import { db } from '@/lib/db'

describe('POST /api/race/start', () => {
  beforeEach(() => vi.clearAllMocks())

  it('crea una carrera y devuelve su id', async () => {
    ;(db.race.create as any).mockResolvedValue({
      id: 'race1',
      startTitle: 'Dog',
      targetTitle: 'Cat',
      lang: 'en',
      startedAt: new Date('2026-06-02T00:00:00Z'),
    })

    const req = new Request('http://x/api/race/start', {
      method: 'POST',
      body: JSON.stringify({ startTitle: 'Dog', targetTitle: 'Cat', lang: 'en' }),
    })
    const res = await POST(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.id).toBe('race1')
    expect(db.race.create).toHaveBeenCalledOnce()
  })

  it('rechaza si faltan títulos', async () => {
    const req = new Request('http://x/api/race/start', {
      method: 'POST',
      body: JSON.stringify({ startTitle: 'Dog' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Correr el test para ver que falla**

Run: `npx vitest run app/api/race/start/route.test.ts`
Expected: FAIL ("Cannot find module './route'").

- [ ] **Step 3: Implementar**

Create `app/api/race/start/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { startTitle, targetTitle, lang } = body as {
    startTitle?: string
    targetTitle?: string
    lang?: string
  }

  if (!startTitle || !targetTitle) {
    return NextResponse.json({ error: 'missing_titles' }, { status: 400 })
  }

  const race = await db.race.create({
    data: { startTitle, targetTitle, lang: lang ?? 'en' },
  })

  return NextResponse.json({
    id: race.id,
    startTitle: race.startTitle,
    targetTitle: race.targetTitle,
    lang: race.lang,
    startedAt: race.startedAt,
  })
}
```

- [ ] **Step 4: Correr el test para ver que pasa**

Run: `npx vitest run app/api/race/start/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/race/start
git commit -m "feat: race start API with server-authoritative timestamp"
```

---

### Task 8: Validación de camino (puro, TDD)

**Files:**
- Create: `lib/race/validate.ts`
- Test: `lib/race/validate.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Create `lib/race/validate.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { validatePath } from './validate'

// grafo de prueba: title -> enlaces salientes
const GRAPH: Record<string, string[]> = {
  Dog: ['Mammal', 'Wolf'],
  Mammal: ['Animal', 'Cat'],
  Cat: ['Animal'],
}
const linksOf = async (_lang: string, title: string) => GRAPH[title] ?? []

describe('validatePath', () => {
  it('acepta un camino válido inicio→destino', async () => {
    const r = await validatePath('en', ['Dog', 'Mammal', 'Cat'], 'Dog', 'Cat', linksOf)
    expect(r.valid).toBe(true)
  })
  it('rechaza si el primer nodo no es el inicio', async () => {
    const r = await validatePath('en', ['Wolf', 'Cat'], 'Dog', 'Cat', linksOf)
    expect(r).toMatchObject({ valid: false, reason: 'bad_start' })
  })
  it('rechaza si el último nodo no es el destino', async () => {
    const r = await validatePath('en', ['Dog', 'Mammal'], 'Dog', 'Cat', linksOf)
    expect(r).toMatchObject({ valid: false, reason: 'bad_target' })
  })
  it('rechaza si un salto no existe como enlace', async () => {
    const r = await validatePath('en', ['Dog', 'Cat'], 'Dog', 'Cat', linksOf)
    expect(r).toMatchObject({ valid: false, reason: 'broken_link' })
  })
  it('rechaza un camino demasiado corto', async () => {
    const r = await validatePath('en', ['Dog'], 'Dog', 'Dog', linksOf)
    expect(r).toMatchObject({ valid: false, reason: 'too_short' })
  })
})
```

- [ ] **Step 2: Correr el test para ver que falla**

Run: `npx vitest run lib/race/validate.test.ts`
Expected: FAIL ("Cannot find module './validate'").

- [ ] **Step 3: Implementar**

Create `lib/race/validate.ts`:
```ts
import { titlesEqual } from '@/lib/wiki/title'

export type ValidationReason =
  | 'too_short'
  | 'bad_start'
  | 'bad_target'
  | 'broken_link'

export interface ValidationResult {
  valid: boolean
  reason?: ValidationReason
}

export type LinksOf = (lang: string, title: string) => Promise<string[]>

/** Verifica que `path` sea una secuencia real de saltos de `start` a `target`. */
export async function validatePath(
  lang: string,
  path: string[],
  start: string,
  target: string,
  linksOf: LinksOf,
): Promise<ValidationResult> {
  if (path.length < 2) return { valid: false, reason: 'too_short' }
  if (!titlesEqual(path[0], start)) return { valid: false, reason: 'bad_start' }
  if (!titlesEqual(path[path.length - 1], target)) {
    return { valid: false, reason: 'bad_target' }
  }

  for (let i = 0; i < path.length - 1; i++) {
    const outgoing = await linksOf(lang, path[i])
    const linked = outgoing.some((l) => titlesEqual(l, path[i + 1]))
    if (!linked) return { valid: false, reason: 'broken_link' }
  }

  return { valid: true }
}
```

- [ ] **Step 4: Correr el test para ver que pasa**

Run: `npx vitest run lib/race/validate.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/race/validate.ts lib/race/validate.test.ts
git commit -m "feat: server-side path validation"
```

---

### Task 9: API de envío de carrera (TDD)

**Files:**
- Create: `app/api/race/submit/route.ts`
- Test: `app/api/race/submit/route.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Create `app/api/race/submit/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { race: { findUnique: vi.fn(), update: vi.fn() } },
}))
vi.mock('@/lib/wiki/client', () => ({
  fetchArticle: vi.fn(async (_l: string, title: string) => ({
    title,
    lang: 'en',
    html: '',
    links: { Dog: ['Mammal'], Mammal: ['Cat'] }[title] ?? [],
  })),
}))

import { POST } from './route'
import { db } from '@/lib/db'

const baseRace = {
  id: 'r1',
  lang: 'en',
  startTitle: 'Dog',
  targetTitle: 'Cat',
  status: 'active',
  startedAt: new Date(Date.now() - 5000),
}

describe('POST /api/race/submit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('valida el camino, marca completado y devuelve tiempo y clics', async () => {
    ;(db.race.findUnique as any).mockResolvedValue(baseRace)
    ;(db.race.update as any).mockImplementation(async ({ data }: any) => ({ ...baseRace, ...data }))

    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ raceId: 'r1', path: ['Dog', 'Mammal', 'Cat'] }),
    })
    const res = await POST(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.valid).toBe(true)
    expect(json.clicks).toBe(2)
    expect(json.timeMs).toBeGreaterThan(0)
  })

  it('marca invalid si el camino está roto', async () => {
    ;(db.race.findUnique as any).mockResolvedValue(baseRace)
    ;(db.race.update as any).mockImplementation(async ({ data }: any) => ({ ...baseRace, ...data }))

    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ raceId: 'r1', path: ['Dog', 'Cat'] }),
    })
    const res = await POST(req as any)
    const json = await res.json()
    expect(json.valid).toBe(false)
    expect(json.reason).toBe('broken_link')
  })

  it('404 si la carrera no existe', async () => {
    ;(db.race.findUnique as any).mockResolvedValue(null)
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ raceId: 'x', path: ['Dog', 'Cat'] }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Correr el test para ver que falla**

Run: `npx vitest run app/api/race/submit/route.test.ts`
Expected: FAIL ("Cannot find module './route'").

- [ ] **Step 3: Implementar**

Create `app/api/race/submit/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchArticle } from '@/lib/wiki/client'
import { validatePath, LinksOf } from '@/lib/race/validate'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { raceId, path } = body as { raceId?: string; path?: string[] }

  if (!raceId || !Array.isArray(path)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const race = await db.race.findUnique({ where: { id: raceId } })
  if (!race) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (race.status !== 'active') {
    return NextResponse.json({ error: 'already_submitted' }, { status: 409 })
  }

  const linksOf: LinksOf = async (lang, title) =>
    (await fetchArticle(lang, title)).links

  const result = await validatePath(
    race.lang,
    path,
    race.startTitle,
    race.targetTitle,
    linksOf,
  )

  const timeMs = Date.now() - new Date(race.startedAt).getTime()
  const clicks = path.length - 1

  const updated = await db.race.update({
    where: { id: raceId },
    data: {
      status: result.valid ? 'completed' : 'invalid',
      valid: result.valid,
      completedAt: new Date(),
      timeMs,
      clicks,
      path: JSON.stringify(path),
    },
  })

  return NextResponse.json({
    valid: updated.valid,
    reason: result.reason,
    timeMs: updated.timeMs,
    clicks: updated.clicks,
  })
}
```

- [ ] **Step 4: Correr el test para ver que pasa**

Run: `npx vitest run app/api/race/submit/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/race/submit
git commit -m "feat: race submit API with validation and scoring"
```

---

### Task 10: Motor de carrera client-side (`RaceView`)

**Files:**
- Create: `components/RaceView.tsx`
- Test: `components/RaceView.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

Create `components/RaceView.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RaceView from './RaceView'

beforeEach(() => {
  global.fetch = vi.fn(async (url: any) => {
    const u = String(url)
    if (u.includes('/api/wiki/')) {
      const title = decodeURIComponent(u.split('/').pop()!)
      const html =
        title === 'Dog'
          ? '<a class="wiki-link" data-wiki-title="Cat">go to cat</a>'
          : '<p>Cat article</p>'
      return { ok: true, json: async () => ({ title, lang: 'en', html, links: [] }) } as any
    }
    if (u.includes('/api/race/submit')) {
      return { ok: true, json: async () => ({ valid: true, timeMs: 1234, clicks: 1 }) } as any
    }
    return { ok: false } as any
  }) as any
})

describe('RaceView', () => {
  it('renderiza el artículo inicial y el destino', async () => {
    render(<RaceView raceId="r1" lang="en" start="Dog" target="Cat" />)
    await waitFor(() => expect(screen.getByText('go to cat')).toBeInTheDocument())
    expect(screen.getByText(/Cat/)).toBeInTheDocument()
  })

  it('al clickear un enlace interno avanza y al llegar al destino muestra el resultado', async () => {
    render(<RaceView raceId="r1" lang="en" start="Dog" target="Cat" />)
    const link = await screen.findByText('go to cat')
    fireEvent.click(link)
    await waitFor(() => expect(screen.getByText(/¡Llegaste!/)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Correr el test para ver que falla**

Run: `npx vitest run components/RaceView.test.tsx`
Expected: FAIL ("Cannot find module './RaceView'").

- [ ] **Step 3: Implementar**

Create `components/RaceView.tsx`:
```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { titlesEqual } from '@/lib/wiki/title'

interface Props {
  raceId: string
  lang: string
  start: string
  target: string
}

interface Result {
  valid: boolean
  timeMs: number
  clicks: number
}

export default function RaceView({ raceId, lang, start, target }: Props) {
  const [path, setPath] = useState<string[]>([start])
  const [html, setHtml] = useState<string>('')
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const startRef = useRef<number>(Date.now())
  const containerRef = useRef<HTMLDivElement>(null)

  const current = path[path.length - 1]

  // cargar el artículo actual
  useEffect(() => {
    let cancelled = false
    fetch(`/api/wiki/${lang}/${encodeURIComponent(current)}`)
      .then((r) => r.json())
      .then((a) => {
        if (!cancelled) setHtml(a.html ?? '')
      })
    return () => {
      cancelled = true
    }
  }, [current, lang])

  // timer
  useEffect(() => {
    if (result) return
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 100)
    return () => clearInterval(id)
  }, [result])

  const submit = useCallback(
    async (finalPath: string[]) => {
      const res = await fetch('/api/race/submit', {
        method: 'POST',
        body: JSON.stringify({ raceId, path: finalPath }),
      })
      setResult(await res.json())
    },
    [raceId],
  )

  // interceptar clics en enlaces internos
  const onClick = useCallback(
    (e: React.MouseEvent) => {
      const el = (e.target as HTMLElement).closest('a.wiki-link') as HTMLElement | null
      if (!el) return
      e.preventDefault()
      const title = el.getAttribute('data-wiki-title')
      if (!title || result) return
      const next = [...path, title]
      setPath(next)
      if (titlesEqual(title, target)) void submit(next)
    },
    [path, target, result, submit],
  )

  const seconds = (elapsed / 1000).toFixed(1)

  return (
    <div>
      <div style={{ position: 'sticky', top: 0, background: '#1a1a2e', color: '#fff', padding: 12 }}>
        <strong>{start}</strong> → <strong>{target}</strong>
        {' · '}⏱️ {seconds}s · clics: {path.length - 1}
      </div>

      {result ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          {result.valid ? (
            <h2>¡Llegaste! ⏱️ {(result.timeMs / 1000).toFixed(1)}s · {result.clicks} clics</h2>
          ) : (
            <h2>Camino inválido 😕</h2>
          )}
        </div>
      ) : (
        <div
          ref={containerRef}
          onClick={onClick}
          style={{ padding: 16, maxWidth: 800, margin: '0 auto' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Correr el test para ver que pasa**

Run: `npx vitest run components/RaceView.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/RaceView.tsx components/RaceView.test.tsx
git commit -m "feat: client-side race engine with link interception"
```

---

### Task 11: Pantalla de Práctica (sorteo / elección de artículos)

**Files:**
- Create: `app/play/page.tsx`
- Create: `lib/wiki/random.ts`
- Test: `lib/wiki/random.test.ts`

- [ ] **Step 1: Escribir el test que falla (artículo aleatorio)**

Create `lib/wiki/random.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { randomTitle } from './random'

describe('randomTitle', () => {
  it('devuelve el título que entrega la API de Wikipedia', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ query: { random: [{ title: 'Alan Turing' }] } }),
    }) as unknown as typeof fetch
    const t = await randomTitle('en', fakeFetch)
    expect(t).toBe('Alan Turing')
  })
})
```

- [ ] **Step 2: Correr el test para ver que falla**

Run: `npx vitest run lib/wiki/random.test.ts`
Expected: FAIL ("Cannot find module './random'").

- [ ] **Step 3: Implementar `randomTitle`**

Create `lib/wiki/random.ts`:
```ts
/** Devuelve el título de un artículo aleatorio (namespace 0). */
export async function randomTitle(
  lang: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const url =
    `https://${lang}.wikipedia.org/w/api.php` +
    `?action=query&list=random&rnnamespace=0&rnlimit=1&format=json&origin=*`
  const res = await fetchImpl(url)
  if (!(res as Response).ok) throw new Error('random failed')
  const data = await (res as Response).json()
  return data.query.random[0].title as string
}
```

- [ ] **Step 4: Correr el test para ver que pasa**

Run: `npx vitest run lib/wiki/random.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Endpoint de artículo aleatorio**

Create `app/api/wiki/random/[lang]/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { randomTitle } from '@/lib/wiki/random'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params
  const title = await randomTitle(lang)
  return NextResponse.json({ title })
}
```

- [ ] **Step 6: Pantalla de Práctica**

Create `app/play/page.tsx`:
```tsx
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
```

- [ ] **Step 7: Verificar build y test completo**

Run: `npm run build`
Expected: build exitoso; rutas `/play`, `/api/wiki/random/[lang]` listadas.
Run: `npm test`
Expected: PASS, todos los archivos de test verdes.

- [ ] **Step 8: Commit**

```bash
git add app/play app/api/wiki/random lib/wiki/random.ts lib/wiki/random.test.ts
git commit -m "feat: practice mode page with random article picker"
```

---

### Task 12: Prueba end-to-end manual + README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Documentar cómo correr**

Create `README.md`:
```md
# WikiRace

Juego de wikirace (navegar Wikipedia con solo enlaces internos) con ELO,
leaderboards y AdSense. Ver diseño en `docs/superpowers/specs/`.

## Desarrollo

```bash
npm install
npx prisma migrate dev
npm run dev      # http://localhost:3000/play
npm test         # tests con Vitest
```

## Estado

Plan 1 (fundación): modo Práctica jugable de punta a punta.
```

- [ ] **Step 2: Smoke test manual de la carrera completa**

Run: `npm run dev`
Manual:
1. Abrir `http://localhost:3000/play`.
2. Escribir "Dog" en inicio y "Mammal" en destino (o usar 🎲).
3. Click "Empezar carrera" → debe cargar el artículo "Dog" dentro del shell.
4. Verificar que el buscador de Wikipedia NO aparece y que los enlaces externos no son clickeables.
5. Clickear enlaces internos hasta llegar a "Mammal".
6. Al llegar, debe mostrarse "¡Llegaste!" con tiempo y clics.

Expected: el flujo completo funciona; el tiempo mostrado es plausible.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README with run instructions"
```

---

## Self-Review (cobertura del spec — Plan 1)

- **Proxy de Wikipedia + saneo + caché** → Tasks 4, 5, 6. ✅
- **Motor de carrera client-side (sin atrás/buscador, intercepción)** → Tasks 4 (neutraliza), 10. ✅
- **Tiempo autoritativo del servidor** → Tasks 7 (start), 9 (submit calcula `Date.now() - startedAt`). ✅
- **Validación anti-trampa server-side (cada salto = enlace real)** → Tasks 8, 9. ✅
- **Modo Práctica jugable (elección + sorteo)** → Task 11. ✅
- **Atribución CC BY-SA** → ⚠️ NO incluida en Plan 1; el saneo deja el contenido pero la línea de atribución visible se agrega junto a los layouts en el Plan 8 (AdSense + SEO). Anotado como dependencia.
- **Generación de puzzles / Daily / ELO / leaderboards / cuentas / themed / ads** → fuera de alcance (Planes 2-8).

Sin placeholders. Tipos consistentes: `WikiArticle`, `SanitizeResult`, `ValidationResult`/`ValidationReason`, `LinksOf` se definen una vez y se reutilizan; `fetchArticle`, `sanitizeArticleHtml`, `normalizeTitle`/`titlesEqual`, `validatePath`, `randomTitle` mantienen la misma firma en todas las tareas.
```
