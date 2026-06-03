# Generación de puzzles (grafo de Wikipedia) — Documento de diseño (Plan 2)

**Fecha:** 2026-06-03
**Estado:** Diseño aprobado (pendiente plan de implementación)
**Depende de:** Plan 1 (fundación + carrera jugable), ya desplegado.

## 1. Resumen

Generar puzzles de WikiRace **resolubles** y con **largo óptimo conocido** (para el
scoring por estrellas), con dificultad controlada y artículos reconocibles. Es el
componente de mayor riesgo técnico del producto.

**Principio de arquitectura:** el grafo de enlaces de Wikipedia (varios GB) **nunca entra
a Vercel** (serverless, sin disco persistente). Se separa en dos mundos:

1. **Generador offline (pesado, ocasional):** script Node/TS que se corre localmente,
   lee el grafo precompilado de SDOW, corre BFS y escribe puzzles listos en Postgres.
2. **App en Vercel (liviana):** solo lee puzzles del pool en Postgres; nunca toca el grafo.

## 2. Decisiones de diseño

- **Fuente del grafo:** SDOW (Six Degrees of Wikipedia) — base SQLite precomputada del
  grafo EN. Da BFS exacto offline (largo óptimo real), sin rate limits.
- **Cadencia:** generación por **lote → pool**. El generador corre pocas veces y llena un
  pool de cientos de puzzles en Postgres (dura meses). No hay cron pesado diario.
- **Dónde corre:** **localmente** (máquina del dev). Automatizarlo queda para después.
- **Dificultad:** **tiers por largo óptimo** — fácil (3), medio (4), difícil (5-6). Se
  evita trivial (1-2) y frustrante (>6).
- **Calidad de artículos:** filtro por **in-degree** (enlaces entrantes como proxy de
  notoriedad), usando el propio grafo SDOW. Sin dependencias extra.

## 3. Arquitectura y unidades de código

Responsabilidad única por archivo; lógica pura separada del I/O y del grafo concreto.

- `lib/graph/types.ts` — interfaz `Graph`:
  - `outLinks(id: number): number[]`
  - `inDegree(id: number): number`
  - `randomArticle(): number` (id de un artículo no-redirect)
  - `titleOf(id: number): string`, `idOf(title: string): number | null`
- `lib/graph/bfs.ts` — `bfs(graph, sourceId, maxDepth)` → `{ dist: Map<id,number>,
  prev: Map<id,id> }`; y `shortestPath(prev, sourceId, targetId): number[]`. **Puro.**
- `lib/graph/sdow.ts` — `SdowGraph` implementa `Graph` leyendo el SQLite de SDOW
  (`better-sqlite3`, modo lectura). Parsea el formato real de SDOW (tabla `pages` id↔
  título; tabla `links` con IDs entrantes/salientes empacados). Único acoplado a SDOW.
- `lib/puzzle/generate.ts` — `generatePuzzles(graph, opts)` → candidatos
  `{ startTitle, targetTitle, optimalLen, difficulty, shortestPath }[]`. Recibe la
  interfaz `Graph`, así que se testea con un grafo en memoria. **Puro.**
- `scripts/generate-puzzles.ts` — CLI: une `SdowGraph` + `generatePuzzles` + escritura a
  Postgres (Prisma). Flags: cantidad por tier, idioma, `--dry-run`.
- `prisma/schema.prisma` — modelo `Puzzle` + migración.

## 4. Algoritmo de generación

1. Elegir un **START** al azar con in-degree ≥ umbral `T` (popularidad).
2. **Un BFS** desde START sobre enlaces salientes, acotado a profundidad 6 → distancia
   más corta exacta a todos los nodos alcanzables.
3. Candidatos **TARGET:** nodos a distancia d ∈ {3,4,5,6} con in-degree ≥ `T`. La
   distancia BFS es el largo óptimo garantizado.
4. Por tier, tomar targets en su distancia: fácil=3, medio=4, difícil=5-6.
5. Emitir `{startTitle, targetTitle, optimalLen=d, difficulty, shortestPath}`.
6. Saltar redirects, evitar `start==target`, dedupe de pares, saltar callejones sin salida.
7. Repetir con muchos starts hasta llenar la cuota por tier.

Un BFS por start rinde muchos targets de varias distancias → eficiente. No se necesita
BFS bidireccional.

## 5. Modelo de datos (`Puzzle`)

- `id` (cuid)
- `lang` (String, def "en")
- `startTitle` (String), `targetTitle` (String)
- `optimalLen` (Int)
- `difficulty` (String: easy | medium | hard)
- `shortestPath` (String?, JSON — un camino óptimo de ejemplo; sirve para "rendirse"/hint)
- `status` (String, def "available": available | assigned) — gestión del pool
- `type` (String?, daily | practice | ranked | themed — lo usan planes posteriores)
- `date` (DateTime? — el Plan 3 lo setea al promover a daily)
- `createdAt` (DateTime, def now)
- **@@unique([lang, startTitle, targetTitle])** — anti-duplicados (idempotencia)
- **@@index([status, difficulty])** — selección rápida del pool

## 6. CLI del generador

- Lee el SQLite de SDOW (ruta por env/flag), abre `Graph`.
- Genera candidatos según cuota por tier.
- Inserta en Postgres vía Prisma; el unique hace **skip de duplicados** (idempotente).
- `--dry-run` imprime sin escribir. Loguea progreso (candidatos por tier, descartes).
- `better-sqlite3` es **devDependency**, usada solo aquí; ninguna ruta de la app la
  importa (no infla el bundle serverless).

## 7. Manejo de errores

- Saltar redirects, callejones sin salida y nodos inalcanzables.
- Si un start da pocos candidatos, pasar al siguiente.
- Tope al trabajo total de BFS (límite de starts intentados).
- Staleness: Wikipedia cambia → algún puzzle puede romperse; la validación en runtime
  (Plan 1) atrapa envíos rotos. Marcar/saltar puzzles rotos queda para planes posteriores.

## 8. Testing

- `bfs.test` (grafo en memoria): distancias correctas, camino más corto, inalcanzables,
  tope de profundidad.
- `generate.test` (grafo en memoria): `optimalLen` coincide con el tier, respeta el filtro
  in-degree, sin `start==target`, sin duplicados, maneja "no hay suficientes candidatos".
- `sdow.ts`: chequeo de integración liviano contra un fixture mínimo (el grafo completo no
  va a CI).

## 9. Fuera de alcance (otros planes)

- Promoción del daily + cron + UI del daily → **Plan 3**.
- Uso del grafo en runtime / aceleración de validación → no se hace (runtime usa fetch
  en vivo, Plan 1).
- Sets temáticos → **Plan 7**.
- Automatizar el generador (Railway/Actions) → más adelante.

## 10. Riesgos

1. **Esquema/formato real de SDOW** (links empacados) — se verifica contra el archivo
   descargado al implementar `sdow.ts`; es el punto de mayor incertidumbre.
2. **Tamaño del archivo SDOW** (varios GB) — local, gitignored; descarga única.
3. **Calidad/dificultad de los puzzles** — el umbral `T` de in-degree y los rangos de
   tier se ajustan empíricamente revisando una muestra generada.
