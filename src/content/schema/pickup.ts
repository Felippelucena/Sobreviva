import { z } from "zod";
import { HexColor, Id, PositiveNumber } from "./common";

export const PickupDef = z.object({
  kind: z.literal("pickup"),
  id: Id,
  effect: z.enum(["xp", "heal", "magnet"]),
  value: PositiveNumber,
  magnetizable: z.boolean().default(true),
  sprite: z.object({ color: HexColor, radius: PositiveNumber }),
});

export type PickupDef = z.infer<typeof PickupDef>;
