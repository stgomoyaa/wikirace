# Sistema de progresión Ranked + Daily — Documento de diseño (Plan 3)

**Fecha:** 2026-06-03
**Estado:** Diseño aprobado (pendiente planes de implementación por etapas)
**Depende de:** Plan 1 (carrera jugable) y Plan 2 (pool de puzzles), ambos desplegados.

## 1. Resumen y visión

El corazón adictivo de WikiRace. El **Daily** deja de ser un mini-juego aislado y se
vuelve la puerta de entrada a un **loop de ranked**: Daily de alto RR → ves tu cambio de
rango → te tira directo a la cola ranked de tu tier → "una más" infinito. El rango sube/
baja por **velocidad** (tiempo vs el "par" de tu nivel) + bonus por ruta óptima.

Esto **fusiona** lo que antes eran Plan 3 (Daily) y Plan 5 (ELO) en un solo sistema de
progresión, porque la adicción nace de que estén acoplados. Referencia de calidad:
GeoGuessr / Valorant / LoL.

Mecanismos adictivos adoptados (de Valorant/LoL): tiers + divisiones con identidad visual,
rank visible (RR) vs MMR oculto con **convergencia**, recompensa variable por desempeño,
**protección indulgente** de descenso, placements, temporadas con reset, ápex sin techo,
y el loop "una más".

## 2. Identidad (se adelanta lo mínimo)

El rating debe persistir server-side, así que se adelanta una identidad mínima:

- **Invitado vía cookie firmada** (httpOnly): contiene un `playerId`. Se crea en la primera
  interacción ranked. Sin login. **Reclamable con Google en el Plan 4.**
- Modelo `Player`: `id`, `displayName`, `country` (IP, editable), `googleId?` (null por
  ahora), `createdAt`.
- El estado **personal del Daily** (streak, historial, "ya jugaste hoy") va en
  **localStorage** (como Wordle) — no requiere identidad. El **rating** sí es server-side.

## 3. Escalera de rangos

- **Iron · Bronze · Silver · Gold · Platinum · Emerald · Diamond** — 4 divisiones (IV→I),
  RR 0-100 por división; promueve a 100, desciende a 0.
- **Master · Grandmaster** — ápex, RR acumulativo, sin divisiones.
- **Polymath** — tope, corte por leaderboard (top N / umbral de RR).

## 4. Modelo de cálculo de RR (par-time)

- Cada puzzle ranked tiene un **par-time** esperado: inicialmente
  `par = optimalLen × SEG_BASE_POR_SALTO`, ajustado por el MMR del jugador; se **calibra**
  con datos reales (mediana de tiempos por puzzle) a medida que hay volumen.
- Al completar (camino válido, tiempo autoritativo del server):
  `deltaRR = f(margen_vs_par, bonus_estrellas, convergencia, protección, racha)`.
  - **margen_vs_par:** más rápido que el par → ganas; más lento → pierdes; escala con el margen.
  - **bonus_estrellas:** ruta óptima (3⭐) suma.
  - **convergencia:** si MMR > rank visible, ganas más y pierdes menos (te jala hacia tu nivel real).
  - **protección indulgente:** escudos al entrar a un tier, piso de descenso (no caes al fondo),
    bonus por racha de victorias.
- Se actualizan **MMR** (continuo, oculto) y **RR/tier/división** (visible). Ápex = RR
  acumulativo puro (sin bonus de desempeño, como Immortal/Radiant).

## 5. Placements

- Un jugador nuevo juega **5 partidas de placement**; al terminar se le **revela** su rango
  inicial (momento de dopamina). Durante placements el MMR se mueve más rápido.

## 6. Daily integrado

- El **Daily ES una partida ranked especial**: 1/día, **multiplicador ~3x RR**, cuenta para
  el rango. Usa `getOrAssignDaily` (lazy get-or-assign, sin cron) sobre el pool del Plan 2.
- Al terminar el Daily → animación de cambio de rango → **CTA que auto-encola** la siguiente
  ranked del tier (entra al loop "una más").
- **Estado personal (localStorage):** streak diario, historial, "ya jugaste hoy".
  Estrellas: **3=óptimo, 2=óptimo+1, 1=resto**. Reset del día en **UTC**.
- **Número de daily** `#N` = días desde el lanzamiento.
- **Tarjeta de compartir** (texto, sin spoiler): `WikiRace #N ⭐⭐⭐ / ⏱️ 0:51 / 4 saltos
  (óptimo 4) / 🟩🟩🟩🟩` + link. Cuadros = tus saltos (🟩 óptimos, 🟨 extra).
- **Archivo básico:** `/daily/[fecha]` jugable + lista simple de días pasados (las carreras
  de archivo no afectan streak ni cuentan ranked). SEO completo → Plan 8.

## 7. Anti-trampa (incluido en esta etapa, porque el RR importa)

- **Token por paso:** cada artículo servido por el proxy lleva un token firmado; el `submit`
  incluye los tokens, probando que la navegación pasó por nuestro proxy.
- **Detección de tiempos imposibles:** piso de tiempo por nº de saltos; se rechaza lo absurdo.
- Validación estricta de camino server-side (ya existe, Plan 1) + tiempo autoritativo.
- Rate limiting. Si no pasa anti-trampa, **no cuenta para ranked**.

## 8. Leaderboard básico

- Ladder por RR **global + por país** + listado de ápex (Master/GM/Polymath). UI básica;
  el pulido completo (filtros, paginación, perfiles) va al Plan 6.

## 9. Temporadas

- El modelo soporta `seasonId` y `peakTier`. El **reset suave + recompensas/insignias** se
  **implementa más adelante** (no en la primera etapa), pero los datos se diseñan para ello.

## 10. Juice / dopamina (lo ejecuta frontend-design en 3C)

- Barra de RR que se llena animada, celebración de promoción, reveal de tier, llamas por
  racha, cuenta regresiva "vs par", microsonidos. Objetivo de feel: nivel GeoGuessr.

## 11. Modelo de datos

- `Player` (id, displayName, country, googleId?, createdAt).
- `PlayerRating` (playerId, mmr, rr, tier, division, placementsDone, shields, peakTier,
  seasonId, updatedAt).
- `RatingHistory` (playerId, raceId, mmrBefore/after, rrBefore/after, delta, createdAt).
- Extender `Race` (Plan 1): `puzzleId?`, `playerId?`, `isRanked` (bool), `stars?`, `rrDelta?`.
- (Se reutiliza `Race` como la "partida ranked"; no se crea un modelo separado de match.)

## 12. Unidades de código (responsabilidad única, lógica pura aislada)

- `lib/rank/tiers.ts` — tier/división ↔ RR, nombres, promover/descender, manejo de ápex. Puro.
- `lib/rank/par.ts` — par-time desde optimalLen + MMR. Puro.
- `lib/rank/elo.ts` — `computeRrChange({timeMs, parMs, stars, mmr, rr, shields, streak})`. Puro.
- `lib/rank/placements.ts` — lógica de placements y reveal. Puro.
- `lib/daily/number.ts`, `lib/daily/select.ts`, `lib/daily/state.ts` (reducer de streak, puro).
- `lib/score/stars.ts` — `starsFor(clicks, optimalLen)`. Puro.
- `lib/share/card.ts` — `buildShareCard(...)`. Puro.
- `lib/race/token.ts` — firmar/verificar tokens por paso; chequeo de tiempo imposible. Puro.
- `lib/player/identity.ts` — leer/crear el `playerId` desde cookie firmada.
- APIs: `/api/ranked/start`, `/api/ranked/submit` (o extender las de Plan 1 con modo ranked),
  `/api/daily`, `/api/leaderboard`.

## 13. Testing

- Pura y exhaustiva con TDD: `tiers` (límites de promoción/descenso, ápex), `elo`
  (gana al batir par, pierde si lento, convergencia, escudos, racha), `par`, `placements`,
  `stars`, `card`, `daily/state` (streak: +1 consecutivo, reset al fallar, idempotente same-day),
  `race/token` (firma válida/ inválida, tiempo imposible).
- Identidad/APIs/leaderboard: tests de integración más livianos.

## 14. Implementación por etapas (cada una lanzable)

- **3A — Núcleo ranked:** identidad invitado (cookie + `Player`/`PlayerRating`), `tiers`,
  `par`, `elo`, placements, flujo de carrera ranked (start→submit→update rango), anti-trampa
  (tokens + tiempos imposibles). *Mucha lógica pura TDD. Resultado: se puede grindear ranked.*
- **3B — Daily + funnel + streak + compartir + archivo.** *El gancho diario y el loop.*
- **3C — UI/juice ranked + leaderboard básico** (badges, barra RR, celebraciones, "una más",
  ladder global/país). *El feel adictivo + estatus.* (frontend-design)

Cada etapa = su propio plan de implementación (spec → plan → ejecución).

## 15. Riesgos

1. **Calibración del par-time** (cold start) — al inicio se deriva del óptimo; afinarlo con
   datos reales para que ganar/perder se sienta justo. Riesgo de que el grind se sienta
   arbitrario si está mal calibrado.
2. **Anti-trampa vs velocidad** — el ranking por tiempo invita a scripts; tokens por paso +
   tiempos imposibles mitigan, pero hay que monitorear.
3. **Identidad invitado** — cookie borrable; migración limpia a cuentas Google (Plan 4) sin
   perder rating.
4. **Equilibrio de dopamina** — protección demasiado indulgente infla rangos; calibrar.
