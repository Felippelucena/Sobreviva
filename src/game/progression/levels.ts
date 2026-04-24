/**
 * XP needed to go from level N to N+1. Gentle early curve, quadratic after level 5.
 */
export function xpForLevel(level: number): number {
  if (level < 1) return 5;
  const base = 5 + (level - 1) * 3;
  if (level <= 5) return base;
  const extra = (level - 5) * (level - 5) * 2;
  return base + extra;
}
