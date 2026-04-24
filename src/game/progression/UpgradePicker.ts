import type { Rng } from "../../engine/Rng";
import { UPGRADES, type Upgrade } from "./upgrades";

export function pickUpgrades(rng: Rng, count = 3): Upgrade[] {
  if (UPGRADES.length <= count) return [...UPGRADES];
  const pool = [...UPGRADES];
  const out: Upgrade[] = [];
  for (let i = 0; i < count; i++) {
    const idx = rng.intRange(0, pool.length);
    out.push(pool[idx]!);
    pool.splice(idx, 1);
  }
  return out;
}
