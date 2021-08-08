/**
 * Clamps a value between low and high constraints.
 *
 * @param n - Input number
 * @param lo - Lower bound
 * @param hi - Upper bound
 * @returns Clamped value
 */
export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(lo, n), hi);
}
