import { z } from "zod";
import { HexColor, Id, NonNegativeInt, PositiveNumber } from "./common";

export const EnemyDef = z.object({
  kind: z.literal("enemy"),
  id: Id,
  name: z.string().min(1),
  hp: PositiveNumber,
  speed: PositiveNumber,
  contactDamage: PositiveNumber,
  xpDrop: NonNegativeInt,
  hitbox: z.object({ radius: PositiveNumber }),
  sprite: z.object({ color: HexColor, radius: PositiveNumber }),
});

export type EnemyDef = z.infer<typeof EnemyDef>;
