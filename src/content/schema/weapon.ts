import { z } from "zod";
import { HexColor, Id, NonNegativeInt, NonNegativeNumber, PositiveNumber } from "./common";

export const WeaponProjectile = z.object({
  speed: PositiveNumber,
  radius: PositiveNumber,
  lifetimeMs: PositiveNumber,
  pierce: NonNegativeInt.default(0),
  color: HexColor.default(0xffd166),
});

export const ProjectileShot = z.object({
  type: z.literal("projectile"),
  angleOffsetDeg: z.number().default(0),
  damage: PositiveNumber,
  projectile: WeaponProjectile,
});

export const AreaShot = z.object({
  type: z.literal("area"),
  damage: PositiveNumber,
  radius: PositiveNumber,
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
  volleys: z.array(WeaponVolley).min(1),
});

export const WeaponDef = z.object({
  kind: z.literal("weapon"),
  id: Id,
  name: z.string().min(1),
  cooldownMs: PositiveNumber,
  burst: WeaponBurst,
});

export type WeaponDef = z.infer<typeof WeaponDef>;
export type WeaponProjectile = z.infer<typeof WeaponProjectile>;
export type WeaponShot = z.infer<typeof WeaponShot>;
export type ProjectileShot = z.infer<typeof ProjectileShot>;
export type AreaShot = z.infer<typeof AreaShot>;
export type WeaponVolley = z.infer<typeof WeaponVolley>;
export type WeaponBurst = z.infer<typeof WeaponBurst>;
