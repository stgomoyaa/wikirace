import type { Database } from 'better-sqlite3'
import { Graph } from './types'

function parseIds(packed: string | null): number[] {
  if (!packed) return []
  return packed
    .split('|')
    .filter((s) => s.length > 0)
    .map((s) => Number(s))
}

/** Adaptador del grafo SDOW. Recibe una conexión better-sqlite3 (inyectable para tests). */
export class SdowGraph implements Graph {
  constructor(private db: Database) {}

  outLinks(id: number): number[] {
    const row = this.db
      .prepare('SELECT outgoing_links FROM links WHERE id = ?')
      .get(id) as { outgoing_links: string | null } | undefined
    return row ? parseIds(row.outgoing_links) : []
  }

  inDegree(id: number): number {
    const row = this.db
      .prepare('SELECT incoming_links FROM links WHERE id = ?')
      .get(id) as { incoming_links: string | null } | undefined
    return row ? parseIds(row.incoming_links).length : 0
  }

  randomArticle(): number {
    const row = this.db
      .prepare('SELECT id FROM pages WHERE is_redirect = 0 ORDER BY RANDOM() LIMIT 1')
      .get() as { id: number } | undefined
    if (!row) throw new Error('no articles in graph')
    return row.id
  }

  titleOf(id: number): string {
    const row = this.db.prepare('SELECT title FROM pages WHERE id = ?').get(id) as
      | { title: string }
      | undefined
    return row?.title ?? String(id)
  }

  idOf(title: string): number | null {
    const row = this.db.prepare('SELECT id FROM pages WHERE title = ?').get(title) as
      | { id: number }
      | undefined
    return row?.id ?? null
  }
}
