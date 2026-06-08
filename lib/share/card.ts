export function formatTime(ms: number): string {
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
export interface ShareInput { number: number; stars: number; timeMs: number; clicks: number; optimalLen: number; url: string }
export function buildShareCard(input: ShareInput): string {
  const { number, stars, timeMs, clicks, optimalLen, url } = input
  const starStr = '⭐'.repeat(stars)
  const green = '🟩'.repeat(Math.min(clicks, optimalLen))
  const extra = '🟨'.repeat(Math.max(0, clicks - optimalLen))
  return `WikiRace #${number} ${starStr}\n⏱️ ${formatTime(timeMs)} · ${clicks} saltos (óptimo ${optimalLen})\n${green}${extra}\n${url}`
}
