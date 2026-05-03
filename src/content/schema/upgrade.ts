import { z } from "zod";
import { Id } from "./common";
import { WeaponShot } from "./weapon";

export const UpgradeAttrOp = z.enum(["mul", "add", "set"]);
export type UpgradeAttrOp = z.infer<typeof UpgradeAttrOp>;

export const UpgradeScopeKind = z.enum(["weapon", "character"]);
export type UpgradeScopeKind = z.infer<typeof UpgradeScopeKind>;

export const UpgradeScope = z.object({
  kind: UpgradeScopeKind,
  ids: z.array(Id).min(1).optional(),
});
export type UpgradeScope = z.infer<typeof UpgradeScope>;

export const ShotTypeId = z.enum(["projectile", "area"]);
export type ShotTypeId = z.infer<typeof ShotTypeId>;

export const ShotSelect = z.discriminatedUnion("select", [
  z.object({ select: z.literal("all") }),
  z.object({ select: z.literal("type"), shotType: ShotTypeId }),
  z.object({ select: z.literal("index"), index: z.number().int().nonnegative() }),
]);
export type ShotSelect = z.infer<typeof ShotSelect>;

export const AttrImprovement = z.object({
  type: z.literal("attr"),
  path: z.string().min(1),
  op: UpgradeAttrOp,
  value: z.number().finite(),
  shotSelect: ShotSelect.optional(),
});
export type AttrImprovement = z.infer<typeof AttrImprovement>;

export const PushShotImprovement = z.object({
  type: z.literal("pushShot"),
  shot: WeaponShot,
});
export type PushShotImprovement = z.infer<typeof PushShotImprovement>;

export const Improvement = z.discriminatedUnion("type", [
  AttrImprovement,
  PushShotImprovement,
]);
export type Improvement = z.infer<typeof Improvement>;

export const UpgradeLevel = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  improvements: z.array(Improvement).min(1),
});
export type UpgradeLevel = z.infer<typeof UpgradeLevel>;

export const UpgradeDef = z.object({
  kind: z.literal("upgrade"),
  id: Id,
  name: z.string().min(1),
  desc: z.string().default(""),
  scope: UpgradeScope,
  levels: z.array(UpgradeLevel).min(1),
});

export type UpgradeDef = z.infer<typeof UpgradeDef>;

const FORBIDDEN_PATH_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

export function validateUpgradeDef(def: UpgradeDef): string | null {
  for (const [li, level] of def.levels.entries()) {
    for (const [ii, imp] of level.improvements.entries()) {
      if (imp.type !== "attr") continue;
      const segs = imp.path.split(".");
      for (const raw of segs) {
        const name = raw.endsWith("[]") ? raw.slice(0, -2) : raw;
        if (name.length === 0 || FORBIDDEN_PATH_SEGMENTS.has(name)) {
          return `upgrade "${def.id}" levels[${li}].improvements[${ii}]: path "${imp.path}" contains a forbidden segment`;
        }
      }
      if (imp.shotSelect && !imp.path.startsWith("shots")) {
        return `upgrade "${def.id}" levels[${li}].improvements[${ii}]: shotSelect requires path to start with "shots"`;
      }
    }
  }
  return null;
}
