import { Graph } from './types'

export interface BfsResult {
  dist: Map<number, number>
  prev: Map<number, number>
}

/**
 * BFS desde `source` sobre enlaces salientes, acotado a `maxDepth` y a `maxNodes`
 * nodos visitados (para no explotar en grafos enormes). Las distancias de los nodos
 * visitados siguen siendo las más cortas; sólo se detiene la exploración al llegar al tope.
 */
export function bfs(
  graph: Graph,
  source: number,
  maxDepth: number,
  maxNodes = Infinity,
): BfsResult {
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
          if (dist.size >= maxNodes) return { dist, prev }
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
