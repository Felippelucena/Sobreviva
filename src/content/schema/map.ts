import { z } from "zod";
import { HexColor, Id, PositiveNumber } from "./common";

export const MapDef = z.object({
  kind: z.literal("map"),
  id: Id,
  name: z.string().min(1),
  waveId: Id,
  backgroundColor: HexColor.default(0x0e1118),
  spawnRingMin: PositiveNumber.default(360),
  spawnRingMax: PositiveNumber.default(540),
});

export type MapDef = z.infer<typeof MapDef>;
