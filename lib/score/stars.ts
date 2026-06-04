/** Estrellas según clics vs largo óptimo: 3=óptimo, 2=óptimo+1, 1=resto. */
export function starsFor(clicks: number, optimalLen: number): 1 | 2 | 3 {
  if (clicks <= optimalLen) return 3
  if (clicks === optimalLen + 1) return 2
  return 1
}
