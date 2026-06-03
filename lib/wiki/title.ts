/** Normaliza un título de Wikipedia a su forma legible canónica. */
export function normalizeTitle(raw: string): string {
  let t = raw.trim()
  if (t.startsWith('./')) t = t.slice(2)
  try {
    t = decodeURIComponent(t)
  } catch {
    // dejar como está si no es URI válida
  }
  t = t.replace(/_/g, ' ').trim()
  return t
}

/** Compara dos títulos: Wikipedia ignora la mayúscula de la primera letra. */
export function titlesEqual(a: string, b: string): boolean {
  const na = normalizeTitle(a)
  const nb = normalizeTitle(b)
  if (na.length === 0 || nb.length === 0) return na === nb
  const ci = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
  return ci(na) === ci(nb)
}
