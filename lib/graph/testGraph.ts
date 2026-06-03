import { Graph } from './types'

/** Grafo de prueba determinista. `starts` controla la secuencia de randomArticle(). */
export class InMemoryGraph implements Graph {
  private cursor = 0

  constructor(
    private adj: Record<number, number[]>,
    private titles: Record<number, string>,
    private starts: number[] = [],
  ) {}

  outLinks(id: number): number[] {
    return this.adj[id] ?? []
  }

  inDegree(id: number): number {
    let count = 0
    for (const from of Object.keys(this.adj)) {
      if (this.adj[Number(from)].includes(id)) count++
    }
    return count
  }

  randomArticle(): number {
    if (this.starts.length === 0) throw new Error('no starts configured')
    const s = this.starts[this.cursor % this.starts.length]
    this.cursor++
    return s
  }

  titleOf(id: number): string {
    return this.titles[id] ?? String(id)
  }

  idOf(title: string): number | null {
    for (const id of Object.keys(this.titles)) {
      if (this.titles[Number(id)] === title) return Number(id)
    }
    return null
  }
}
