import { titlesEqual } from '@/lib/wiki/title'

export type ValidationReason =
  | 'too_short'
  | 'bad_start'
  | 'bad_target'
  | 'broken_link'

export interface ValidationResult {
  valid: boolean
  reason?: ValidationReason
}

export type LinksOf = (lang: string, title: string) => Promise<string[]>

/** Verifica que `path` sea una secuencia real de saltos de `start` a `target`. */
export async function validatePath(
  lang: string,
  path: string[],
  start: string,
  target: string,
  linksOf: LinksOf,
): Promise<ValidationResult> {
  if (path.length < 2) return { valid: false, reason: 'too_short' }
  if (!titlesEqual(path[0], start)) return { valid: false, reason: 'bad_start' }
  if (!titlesEqual(path[path.length - 1], target)) {
    return { valid: false, reason: 'bad_target' }
  }

  for (let i = 0; i < path.length - 1; i++) {
    const outgoing = await linksOf(lang, path[i])
    const linked = outgoing.some((l) => titlesEqual(l, path[i + 1]))
    if (!linked) return { valid: false, reason: 'broken_link' }
  }

  return { valid: true }
}
