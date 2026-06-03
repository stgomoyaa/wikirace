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
