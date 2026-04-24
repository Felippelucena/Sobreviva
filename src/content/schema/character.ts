import { z } from "zod";
import { HexColor, Id, PositiveNumber } from "./common";

export const CharacterDef = z.object({
  kind: z.literal("character"),
  id: Id,
  name: z.string().min(1),
  startWeaponId: Id,
  baseHp: PositiveNumber,
  baseSpeed: PositiveNumber,
  pickupRadius: PositiveNumber.default(90),
  sprite: z.object({ color: HexColor, radius: PositiveNumber }),
});

export type CharacterDef = z.infer<typeof CharacterDef>;
