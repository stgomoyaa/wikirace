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
