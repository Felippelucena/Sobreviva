import { z } from "zod";
import { Id } from "./common";

export const UpgradeOp = z.enum(["mul", "add", "set", "pushShot"]);
export type UpgradeOp = z.infer<typeof UpgradeOp>;

export const UpgradeScope = z.enum(["weapon", "character"]);
export type UpgradeScope = z.infer<typeof UpgradeScope>;

export const UpgradeTarget = z.object({
  // Path on the def: "cooldownMs", "shots[].damage", "shots[].projectile.pierce".
  // The "[]" segment means "every element of this array".
  path: z.string().min(1),
  op: UpgradeOp,
});
export type UpgradeTarget = z.infer<typeof UpgradeTarget>;

export const UpgradeDef = z.object({
  kind: z.literal("upgrade"),
  id: Id,
  name: z.string().min(1),
  desc: z.string().default(""),
  scope: UpgradeScope,
  maxLevel: z.number().int().positive(),
  target: UpgradeTarget,
  // values[i] is applied at level i+1, ABSOLUTE over the BASE def value.
  // Type depends on op: number for mul/add/set; WeaponShot for pushShot.
  // Per-op shape and length-vs-maxLevel are checked by validateUpgradeDef.
  values: z.array(z.unknown()).min(1),
});

export type UpgradeDef = z.infer<typeof UpgradeDef>;

export function validateUpgradeDef(def: UpgradeDef): string | null {
  if (def.values.length !== def.maxLevel) {
    return `upgrade "${def.id}": values length (${def.values.length}) must equal maxLevel (${def.maxLevel})`;
  }
  if (def.target.op === "pushShot") {
    // Defer WeaponShot validation to applyUpgrades / coherence test to avoid
    // a circular import between upgrade.ts and weapon.ts.
    return null;
  }
  for (const [i, v] of def.values.entries()) {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return `upgrade "${def.id}": values[${i}] must be a finite number when op is "${def.target.op}"`;
    }
  }
  return null;
}
