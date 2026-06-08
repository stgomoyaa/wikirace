/** Secreto para firmar cookies/tokens. Falla rápido en producción si falta. */
export function rankedSecret(): string {
  const s = process.env.RANKED_SECRET
  if (s) return s
  if (process.env.NODE_ENV === 'production') {
    throw new Error('RANKED_SECRET no está configurado en producción')
  }
  return 'dev-secret'
}
