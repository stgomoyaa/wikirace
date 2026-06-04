/** Tiempo base esperado por salto óptimo (ms). Se calibrará con datos reales. */
export const BASE_MS_PER_HOP = 20_000
/** Par-time esperado para un puzzle de largo óptimo `optimalLen`. */
export function parMs(optimalLen: number): number {
  const hops = Math.max(1, Math.floor(optimalLen))
  return hops * BASE_MS_PER_HOP
}
