export const DIVISIONED_TIERS = ['Iron','Bronze','Silver','Gold','Platinum','Emerald','Diamond'] as const
export const DIVISION_SIZE = 100
export const DIVISIONS_PER_TIER = 4
export const TIER_SPAN = DIVISION_SIZE * DIVISIONS_PER_TIER
export const MASTER_FLOOR = DIVISIONED_TIERS.length * TIER_SPAN // 2800
export const GRANDMASTER_FLOOR = MASTER_FLOOR + 500 // 3300

export type TierName = (typeof DIVISIONED_TIERS)[number] | 'Master' | 'Grandmaster'
export interface RankView { tier: TierName; division: number; rr: number }

export function tierFromPoints(points: number): RankView {
  const p = Math.max(0, Math.floor(points))
  if (p >= GRANDMASTER_FLOOR) return { tier: 'Grandmaster', division: 0, rr: p - GRANDMASTER_FLOOR }
  if (p >= MASTER_FLOOR) return { tier: 'Master', division: 0, rr: p - MASTER_FLOOR }
  const tierIndex = Math.floor(p / TIER_SPAN)
  const withinTier = p - tierIndex * TIER_SPAN
  const divIndex = Math.floor(withinTier / DIVISION_SIZE)
  const rr = withinTier % DIVISION_SIZE
  return { tier: DIVISIONED_TIERS[tierIndex], division: DIVISIONS_PER_TIER - divIndex, rr }
}
export function tierFloor(points: number): number {
  const p = Math.max(0, Math.floor(points))
  if (p >= GRANDMASTER_FLOOR) return GRANDMASTER_FLOOR
  if (p >= MASTER_FLOOR) return MASTER_FLOOR
  return Math.floor(p / TIER_SPAN) * TIER_SPAN
}
export function applyDelta(points: number, delta: number, shields: number): { points: number; shields: number } {
  let next = points + delta
  if (delta < 0) {
    const floor = tierFloor(points)
    // El escudo sólo se gasta si protege un piso real (> 0); en Iron (piso 0) no.
    if (floor > 0 && next < floor && shields > 0) return { points: floor, shields: shields - 1 }
  }
  if (next < 0) next = 0
  return { points: next, shields }
}
export function rankLabel(points: number): string {
  const v = tierFromPoints(points)
  if (v.division === 0) return `${v.tier} · ${v.rr} RR`
  const roman = ['I', 'II', 'III', 'IV'][v.division - 1]
  return `${v.tier} ${roman} · ${v.rr} RR`
}
