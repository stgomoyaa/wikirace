import type { Database, Statement } from 'better-sqlite3'
import { Graph } from './types'

function parseIds(packed: string | null): number[] {
  if (!packed) return []
  return packed
    .split('|')
    .filter((s) => s.length > 0)
    .map((s) => Number(s))
}

/**
 * Adaptador del grafo SDOW. Recibe una conexión better-sqlite3 (inyectable para tests).
 * Cachea los prepared statements porque el BFS los invoca millones de veces.
 */
export class SdowGraph implements Graph {
  private outStmt: Statement
  private inStmt: Statement
  private titleStmt: Statement
  private idStmt: Statement
  private randomStmt: Statement

  constructor(private db: Database) {
    this.outStmt = db.prepare('SELECT outgoing_links FROM links WHERE id = ?')
    this.inStmt = db.prepare('SELECT incoming_links_count AS c FROM links WHERE id = ?')
    this.titleStmt = db.prepare('SELECT title FROM pages WHERE id = ?')
    this.idStmt = db.prepare('SELECT id FROM pages WHERE title = ?')
    this.randomStmt = db.prepare(
      'SELECT id FROM pages WHERE is_redirect = 0 ORDER BY RANDOM() LIMIT 1',
    )
  }

  outLinks(id: number): number[] {
    const row = this.outStmt.get(id) as { outgoing_links: string | null } | undefined
    return row ? parseIds(row.outgoing_links) : []
  }

  inDegree(id: number): number {
    const row = this.inStmt.get(id) as { c: number } | undefined
    return row ? row.c : 0
  }

  randomArticle(): number {
    const row = this.randomStmt.get() as { id: number } | undefined
    if (!row) throw new Error('no articles in graph')
    return row.id
  }

  titleOf(id: number): string {
    const row = this.titleStmt.get(id) as { title: string } | undefined
    return row?.title ?? String(id)
  }

  idOf(title: string): number | null {
    const row = this.idStmt.get(title) as { id: number } | undefined
    return row?.id ?? null
  }
}
