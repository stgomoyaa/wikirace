# WikiRace

Juego de wikirace (navegar Wikipedia usando solo enlaces internos) con ELO,
leaderboards (global / país / temas) y monetización con AdSense.

Diseño y planes en `docs/superpowers/`:
- `specs/2026-06-02-wikirace-elo-adsense-design.md` — diseño del producto
- `plans/2026-06-02-wikirace-foundation-playable-race.md` — Plan 1 (esta fase)

## Desarrollo

```bash
npm install
npx prisma migrate dev      # crea/actualiza la base SQLite local
npm run dev                 # http://localhost:3000/play
npm test                    # tests con Vitest
npm run build               # build de producción
```

Variables de entorno: copia `.env.example` a `.env`.

## Estado

**Plan 1 (fundación) — completado:** modo **Práctica** jugable de punta a punta.

- Proxy de Wikipedia con saneo de HTML y extracción de enlaces (`lib/wiki/`)
- Motor de carrera client-side con intercepción de enlaces (`components/RaceView.tsx`)
- Tiempo autoritativo del servidor + validación anti-trampa del camino (`app/api/race/`)
- Endurecimiento de seguridad: validación de idioma (SSRF), saneo XSS, tope de path (DoS)

Pendiente en próximos planes: Daily, ELO ranked, cuentas, leaderboards,
challenges temáticos, AdSense + SEO.

## Generación de puzzles (Plan 2)

El grafo de Wikipedia vive fuera de la app (Vercel no lo toca). Para llenar el pool de
puzzles en Postgres:

1. Descarga el grafo precompilado de SDOW (SQLite, varios GB) y guárdalo local
   (p. ej. `./sdow.sqlite`). No se commitea.
2. Aplica la migración del modelo `Puzzle` a la DB: `npx prisma migrate deploy`
   (requiere `DATABASE_URL` en `.env`).
3. Prueba sin escribir: `npx tsx scripts/generate-puzzles.ts --sdow ./sdow.sqlite --dry-run`
4. Llena el pool: `npx tsx scripts/generate-puzzles.ts --sdow ./sdow.sqlite --easy 200 --medium 200 --hard 200`

El pool dura meses; se rellena corriendo el script de nuevo (es idempotente, `skipDuplicates`).
Flags: `--min-indegree` (umbral de popularidad), `--max-starts`, `--lang`.

## Stack

Next.js 16 (App Router) · TypeScript · Prisma 6 + **Postgres (Railway)** · Vitest.
Generación offline: `better-sqlite3` + `tsx` (no entran al bundle de Vercel).
