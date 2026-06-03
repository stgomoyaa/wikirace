import { describe, it, expect, beforeAll } from 'vitest'
import Database from 'better-sqlite3'
import { SdowGraph } from './sdow'

let graph: SdowGraph

beforeAll(() => {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE pages (id INTEGER PRIMARY KEY, title TEXT, is_redirect INTEGER);
    CREATE TABLE links (id INTEGER PRIMARY KEY, outgoing_links TEXT, incoming_links TEXT);
    INSERT INTO pages VALUES (1,'A',0),(2,'B',0),(3,'C',0);
    INSERT INTO links VALUES
      (1,'2|3',''),
      (2,'3','1'),
      (3,'','1|2');
  `)
  graph = new SdowGraph(db)
})

describe('SdowGraph', () => {
  it('parsea enlaces salientes', () => {
    expect(graph.outLinks(1)).toEqual([2, 3])
    expect(graph.outLinks(3)).toEqual([])
  })
  it('calcula in-degree desde incoming_links', () => {
    expect(graph.inDegree(3)).toBe(2)
    expect(graph.inDegree(1)).toBe(0)
  })
  it('mapea id<->título', () => {
    expect(graph.titleOf(2)).toBe('B')
    expect(graph.idOf('C')).toBe(3)
    expect(graph.idOf('Nope')).toBeNull()
  })
})
