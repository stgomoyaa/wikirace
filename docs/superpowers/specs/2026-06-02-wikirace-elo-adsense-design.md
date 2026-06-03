# WikiRace con ELO, leaderboards y AdSense — Documento de diseño

**Fecha:** 2026-06-02
**Estado:** Diseño aprobado (pendiente plan de implementación)

## 1. Resumen

Juego web de "wikirace": navegar de un artículo de Wikipedia a otro usando solo
enlaces internos, en el menor tiempo posible. Versión propia diferenciada por
**sistema ELO**, **leaderboards global / por país / por tema**, y monetización con
**Google AdSense**.

**Objetivo del proyecto:** negocio real con ingresos por AdSense. La consecuencia de
diseño más importante: el motor de ingresos no es el multiplayer en tiempo real (caro
de operar, poco indexable), sino el **modo diario single-player + archivo de puzzles +
leaderboards**, que generan tráfico orgánico recurrente y muchas páginas indexables
(modelo Wordle).

**Mercado:** inglés / global primero (mayor RPM de AdSense), compitiendo de frente con
WikiRun y The Wiki Game Daily. Arquitectura preparada para i18n (español futuro).

## 2. Análisis competitivo (contexto)

| Sitio | Enfoque | ELO | Leaderboards | Daily | Multiplayer | Ads |
|---|---|---|---|---|---|---|
| wikirace.app | Multiplayer fiesta, power-ups | No | No | No | Sí (2-12) | No |
| thewikigamedaily.com | Puzzle diario tipo Wordle | No | Comparas score | Sí | No | No |
| wiki-race.com | Multiplayer simple con amigos | No | No | No | Sí | Solo donaciones |
| **wiki-speedrun.com (WikiRun)** | Competidor directo | Sí (1000) | Sí global | Sí | Sí (duelos/salas) | ? |
| wiki-racing.com | Daily + leaderboard | Parcial | Sí global | Sí | Sí | ? |

**Diferenciadores nuestros:** leaderboards **por país** (nadie los destaca), challenges
temáticos bien hechos, UX superior, y monetización con ads (los líderes la evitan a
propósito).

## 3. Alcance del MVP

**Modos incluidos:**
1. **Daily Challenge** (single-player) — mismo inicio→destino para todos cada día.
2. **Práctica / Free play** — inicio/destino aleatorio o elegido.
3. **Ranked ELO (asíncrono)** — sin servidores en tiempo real.
4. **Challenges temáticos** (versión ligera sobre el motor del daily).

**Fuera del MVP (Fase 2):** duelo 1v1 en tiempo real, salas multiplayer con amigos,
temporadas de ELO, amigos/seguidos, español/i18n activo.

## 4. Arquitectura

- **Next.js (App Router) en Vercel.** Páginas públicas con SSG/ISR (landing,
  `/daily/[fecha]`, `/archive`, `/leaderboard`, `/themed/[tema]`, guías) para SEO. El
  juego en vivo es client-side.
- **Postgres (Neon, serverless) + Prisma.**
- **Auth.js (NextAuth):** Google + sesión de invitado (cookie firmada / JWT). El
  invitado puede "reclamar" su progreso (ELO, historial) al vincular Google.
- **Stack full-stack en Next.js** (API routes), sin backend separado. El multiplayer en
  tiempo real de Fase 2 se asume como trabajo adicional cuando llegue.
- **Analytics:** GA4 (opcional Plausible).

### 4.1 Proxy de Wikipedia (`/api/wiki/[lang]/[title]`)

- Trae el HTML del artículo desde la API de MediaWiki.
- **Sanea** el HTML: quita el buscador, enlaces de "editar", reescribe los enlaces
  internos para que pasen por el router del juego; opcionalmente normaliza infobox.
- **Cachea agresivamente** (Vercel Data Cache / tabla en DB) para respetar rate limits de
  Wikipedia y abaratar costos.
- Inserta la **atribución CC BY-SA** obligatoria (enlace al artículo original y a la
  licencia) en el shell.

## 5. Núcleo del juego (motor de carrera)

- Una carrera = `{inicio, destino, idioma}`.
- El cliente carga el artículo inicial dentro de nuestro shell. Al clickear un enlace
  interno: se intercepta, se registra el paso y se carga el siguiente artículo sin
  recargar la página (SPA dentro del juego). Sin botón "atrás", sin buscador.
- **Métricas:** tiempo (autoritativo del servidor: empieza al pedir la carrera vía API,
  termina al enviar el resultado) y clics (saltos).
- **Validación anti-trampa server-side:** al terminar, el servidor reproduce el camino y
  verifica que cada salto exista realmente como enlace, que empiece en el inicio y
  termine en el destino.

### 5.1 Anti-trampa (detalle)

- Tiempo autoritativo del servidor.
- Validación del camino completo (cada salto = enlace real).
- **Token por paso:** el HTML del artículo debe haber salido de nuestro proxy; cada paso
  lleva un token para que no se falsifiquen saltos.
- Buscador y "atrás" deshabilitados en el cliente.
- Detección de tiempos imposibles + rate limiting.
- **Invitados en ranked:** permitido (decisión del usuario), pero con salvaguardas: ELO
  atado a cookie/dispositivo, mostrado en el ladder **marcado como "invitado"**, con
  rate-limits y detección de abuso. Reclama su rating al vincular Google.

## 6. Generación de puzzles diarios

⚠️ **Riesgo técnico principal del proyecto.** Generar puzzles resolubles y con dificultad
controlada requiere el grafo de enlaces de Wikipedia para correr BFS (y para validar
caminos sin re-fetchear).

- **Enfoque:** dataset precomputado del grafo de enlaces (estilo *Six Degrees of
  Wikipedia* / dump de `pagelinks`) cargado en un almacén consultable.
- Un **job cron** (Vercel Cron) selecciona inicio/destino, corre BFS para confirmar que
  existe un camino del largo objetivo (p. ej. 3-5 saltos) y que no hay solución trivial
  (1-2 saltos). Guarda el puzzle con su **largo óptimo** (para el scoring por estrellas).
- El mismo grafo sirve para acelerar la validación de caminos.
- **Reset del daily:** UTC fijo (todos el mismo puzzle a la misma hora global).

## 7. Scoring

- **Ranking principal por TIEMPO**, desempate por clics.
- **Estrellas vs óptimo:** 3⭐ si igualas el camino más corto conocido; menos estrellas
  cuanto más te alejes. Incentiva rejugar.
- **Streak diario** (tipo Wordle): días consecutivos jugando el daily. Palanca principal
  de retención.

## 8. Sistema ELO (Ranked asíncrono)

- Hay un **puzzle ranked rotativo**.
- Al terminar, el servidor compara tu resultado contra un **pool de jugadores que
  hicieron el mismo puzzle** (muestra dentro de tu ventana de rating).
- Por cada rival comparado: "ganas" si tu score es mejor (tiempo, luego clics). Se
  calcula el delta Elo esperado según diferencia de rating y se suman con un **K-factor**
  acotado (K alto al inicio, decae con la cantidad de partidas).
- Rating inicial **1000**, con piso.
- Sin servidores en tiempo real (todo asíncrono y barato).

## 9. Leaderboards

- **Daily:** ranking por puzzle, **global + por país**, hoy y permanente en el archivo de
  cada día pasado.
- **Ladder ELO:** **global + por país**, all-time (temporadas en Fase 2).
- **Themed:** mejores por tema.
- **País:** detectado por IP (geolocalización), editable por el usuario.
- Amigos/seguidos → Fase 2.

## 10. Modelo de datos (tablas clave)

- `users` (id, google_id?, nombre, país, is_guest, created_at)
- `puzzles` (id, tipo [daily|themed|ranked|practice], idioma, inicio, destino,
  largo_óptimo, tema?, fecha?)
- `results` (id, user_id, puzzle_id, clics, tiempo_ms, camino jsonb, validado, created_at)
- `elo` (user_id, rating, partidas, peak)
- `elo_history` (user_id, puzzle_id, rating_antes, rating_después, delta, fecha)
- `themed_sets` (tema, nombre, puzzle_ids[])
- `streaks` (user_id, actual, máximo, último_día)

## 11. Monetización (AdSense) y SEO

### 11.1 Reparto de anuncios

- **Con ads** (contenido original, alto engagement): Home, pantalla de **Resultado**
  (pausa natural tras la carrera), Leaderboard, Archivo, guías.
- **Sin ads:** pantalla de **carrera en vivo** sobre el artículo de Wikipedia (política
  de AdSense sobre contenido de terceros + no romper la UX + atribución visible).
- **Sin pistas/rendirse incentivados con ads** (AdSense prohíbe incentivar clics). El
  "rendirse" revela el camino y no entra al ranking; pistas gratis limitadas (opcional).

### 11.2 Estrategia SEO

- **Long-tail masivo:** una página indexable por cada daily pasado
  (`/daily/AAAA-MM-DD`) y por cada tema.
- **Contenido original** (guías, estrategias, curiosidades) — requisito para aprobar
  AdSense y para captar búsquedas.
- **Compartir tipo Wordle** (tarjeta con emojis: ruta/tiempo sin spoiler) → backlinks y
  tráfico social.
- **Técnico:** SSG/ISR, sitemaps, schema.org, OG images por puzzle, hreflang preparado
  para i18n futuro.

## 12. Legal

- **Atribución CC BY-SA** del contenido de Wikipedia: enlace al artículo original y a la
  licencia en cada página que sirva contenido de Wikipedia. Obligatorio.
- Revisar uso de marca "Wikipedia" (evitar dar a entender afiliación oficial).
- Cumplir políticas de AdSense (contenido original suficiente, no incentivar clics).

## 13. Decisiones pendientes

- **Nombre / dominio:** por definir (el usuario lo pensará luego).

## 14. Riesgos

1. **Generación/validación de puzzles** (grafo de Wikipedia) — el componente técnico más
   complejo; mitigado con dataset precomputado.
2. **Aprobación de AdSense** — requiere contenido original y algo de tráfico antes de
   aprobar; mitigado con páginas de guías/contenido.
3. **Anti-trampa** — carrera client-side; mitigado con validación server-side y tokens.
4. **Rate limits / costos de Wikipedia** — mitigado con caché agresiva.
