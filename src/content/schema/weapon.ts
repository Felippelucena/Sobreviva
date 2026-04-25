import { z } from "zod";
import { HexColor, Id, NonNegativeInt, NonNegativeNumber, PositiveNumber } from "./common";

export const WeaponProjectile = z.object({
  speed: PositiveNumber,
  radius: PositiveNumber,
  lifetimeMs: PositiveNumber,
  pierce: NonNegativeInt.default(0),
  color: HexColor.default(0xffd166),
});

export const WeaponProjectileOverride = z.object({
  speed: PositiveNumber.optional(),
  radius: PositiveNumber.optional(),
  lifetimeMs: PositiveNumber.optional(),
  pierce: NonNegativeInt.optional(),
  color: HexColor.optional(),
});

export const ProjectileShot = z.object({
  type: z.literal("projectile"),
  angleOffsetDeg: z.number().default(0),
  damageMultiplier: PositiveNumber.default(1),
  speedMultiplier: PositiveNumber.default(1),
  projectile: WeaponProjectileOverride.optional(),
});

export const AreaShot = z.object({
  type: z.literal("area"),
  radius: PositiveNumber,
  damageMultiplier: PositiveNumber.default(1),
  originOffsetX: z.number().default(0),
  originOffsetY: z.number().default(0),
  lifetimeMs: NonNegativeNumber.default(0),
  color: HexColor.default(0xff6b6b),
});

export const WeaponShot = z.discriminatedUnion("type", [ProjectileShot, AreaShot]);

export const WeaponVolley = z.object({
  delayMs: NonNegativeNumber.optional(),
  shots: z.array(WeaponShot).min(1),
});

export const WeaponBurst = z.object({
  volleyCount: z.number().int().positive().default(1),
  volleyIntervalMs: NonNegativeNumber.default(0),
  volleys: z.array(WeaponVolley).optional(),
});

export const WeaponDef = z.object({
  kind: z.literal("weapon"),
  id: Id,
  name: z.string().min(1),
  damage: PositiveNumber,
  cooldownMs: PositiveNumber,
  projectile: WeaponProjectile,
  burst: WeaponBurst.optional(),
});

export type WeaponDef = z.infer<typeof WeaponDef>;
export type WeaponProjectile = z.infer<typeof WeaponProjectile>;
export type WeaponProjectileOverride = z.infer<typeof WeaponProjectileOverride>;
export type WeaponShot = z.infer<typeof WeaponShot>;
export type ProjectileShot = z.infer<typeof ProjectileShot>;
export type AreaShot = z.infer<typeof AreaShot>;
export type WeaponVolley = z.infer<typeof WeaponVolley>;
export type WeaponBurst = z.infer<typeof WeaponBurst>;
