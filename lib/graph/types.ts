/** Contrato mínimo del grafo de Wikipedia que necesita la generación. */
export interface Graph {
  /** IDs de artículos a los que `id` enlaza (salientes). */
  outLinks(id: number): number[]
  /** Cantidad de enlaces entrantes a `id` (proxy de notoriedad). */
  inDegree(id: number): number
  /** Un id de artículo (no-redirect) elegido para usar como punto de partida. */
  randomArticle(): number
  /** Título legible de un id. */
  titleOf(id: number): string
  /** Id de un título, o null si no existe. */
  idOf(title: string): number | null
}
