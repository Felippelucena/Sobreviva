import { z } from "zod";
import { HexColor, Id, NonNegativeInt, PositiveNumber } from "./common";

export const WeaponProjectile = z.object({
  speed: PositiveNumber,
  radius: PositiveNumber,
  lifetimeMs: PositiveNumber,
  pierce: NonNegativeInt.default(0),
  color: HexColor.default(0xffd166),
});

export const WeaponDef = z.object({
  kind: z.literal("weapon"),
  id: Id,
  name: z.string().min(1),
  damage: PositiveNumber,
  cooldownMs: PositiveNumber,
  projectile: WeaponProjectile,
});

export type WeaponDef = z.infer<typeof WeaponDef>;
export type WeaponProjectile = z.infer<typeof WeaponProjectile>;
