import { z } from "zod";
import { HexColor, Id, NonNegativeInt, NonNegativeNumber, PositiveNumber } from "./common";

export const MapUnlock = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("always") }),
  z.object({ kind: z.literal("kills"), count: NonNegativeInt }),
  z.object({ kind: z.literal("runs"), count: NonNegativeInt }),
  z.object({ kind: z.literal("time"), ms: NonNegativeNumber }),
]);

export type MapUnlock = z.infer<typeof MapUnlock>;

export const MapDef = z.object({
  kind: z.literal("map"),
  id: Id,
  name: z.string().min(1),
  waveId: Id,
  backgroundColor: HexColor.default(0x0e1118),
  spawnRingMin: PositiveNumber.default(360),
  spawnRingMax: PositiveNumber.default(540),
  unlock: MapUnlock.default({ kind: "always" }),
});

export type MapDef = z.infer<typeof MapDef>;
