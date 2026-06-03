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

Pendiente en próximos planes: generación de puzzles (grafo), Daily, ELO ranked,
cuentas, leaderboards, challenges temáticos, AdSense + SEO.

## Stack

Next.js 16 (App Router) · TypeScript · Prisma 6 + SQLite (dev) · Vitest.
Producción: Postgres/Neon (se configura en el plan de despliegue).
