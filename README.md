# WikiRace

Dog to philosophy. One link at a time.

Pick 2 Wikipedia articles and reach the second using internal links only. WikiRace tracks the route on the server, validates every jump, and supports multiple Wikipedia languages.

[Live demo](https://wikirace-three.vercel.app/) · [Setup](#local-setup) · [Game modes](#game-modes) · [Architecture](#how-it-works) · [Limitations](#what-this-does-not-do)

## Try it

1. Choose a Wikipedia language.
2. Search for the start and target articles. Autocomplete uses Wikipedia's live article index.
3. Start the race and navigate through highlighted internal links.
4. Reach the target. The server checks the complete path and calculates the final time.

The practice mode accepts custom article pairs. The same language selection controls autocomplete, random articles, article rendering, and route validation.

## Game modes

| Mode | What it does |
| --- | --- |
| Practice | Custom start and target articles, language selector, autocomplete, and random article picks |
| Daily | One shared puzzle per day with stars, streak tracking, and a share card |
| Ranked | Puzzle matchmaking, placements, rank rating, and a play-again loop |
| Archive | Replay previous daily puzzles without affecting the original daily attempt |

## Local setup

Requirements: Node.js, npm, and PostgreSQL.

```bash
npm install
cp .env.example .env
npx prisma migrate deploy
npm run dev
```

Open <http://localhost:3000/>.

Set `DATABASE_URL` to a PostgreSQL connection string. Production also requires `RANKED_SECRET`, which should be a long random value used to sign player cookies and race tokens.

Local development may use the built-in `RANKED_SECRET` fallback. Production fails fast when the variable is missing.

## Commands

```bash
npm run dev        # Development server
npm test           # Vitest test suite
npm run lint       # ESLint
npm run build      # Production build
npm start          # Run the production build
```

## How it works

1. The app fetches Wikipedia HTML through a server-side proxy.
2. The proxy removes scripts, event handlers, inline styles, references, navigation boxes, and other non-game content.
3. Internal article links become playable `wiki-link` elements. External and non-article links are disabled.
4. A race record stores the language, start article, target article, and authoritative start time.
5. On completion, the server fetches each article in the submitted path and verifies that every jump existed.

The proxy also validates Wikipedia language subdomains and limits submitted path length to reduce SSRF, XSS, and request-amplification risks.

## Puzzle generation

Daily and ranked puzzles come from an offline Wikipedia graph. Vercel does not load this graph at runtime.

```bash
npx prisma migrate deploy
npx tsx scripts/generate-puzzles.ts --sdow ./sdow.sqlite --dry-run
npx tsx scripts/generate-puzzles.ts --sdow ./sdow.sqlite --easy 200 --medium 200 --hard 200
```

The generator is idempotent through Prisma `skipDuplicates`. Useful flags include `--min-indegree`, `--max-starts`, and `--lang`.

## What this does not do

- Practice and autocomplete need network access to Wikipedia.
- Daily and ranked modes need a seeded PostgreSQL puzzle pool. A fresh database has no playable ranked puzzles.
- The language selector applies to Practice. The current daily and ranked puzzle pool uses English articles.
- There are no user accounts, public leaderboards, country ladders, or themed challenges yet.
- The offline graph is several gigabytes and is deliberately kept outside the Vercel deployment.

## Project notes

Product specs and implementation plans live in [`docs/superpowers/`](docs/superpowers/):

- [`2026-06-02-wikirace-elo-adsense-design.md`](docs/superpowers/specs/2026-06-02-wikirace-elo-adsense-design.md)
- [`2026-06-02-wikirace-foundation-playable-race.md`](docs/superpowers/plans/2026-06-02-wikirace-foundation-playable-race.md)

## Stack

Next.js 16 App Router, React 19, TypeScript, Prisma 6, PostgreSQL, Vitest, and `better-sqlite3` for offline graph processing.

## License

[MIT](LICENSE). Copyright 2026 Santiago Moya.
