import { z } from "zod";
import { Id, NonNegativeInt, NonNegativeNumber, PositiveNumber } from "./common";

export const WaveEntry = z.object({
  enemyId: Id,
  startSec: NonNegativeNumber,
  endSec: PositiveNumber,
  ratePerSec: PositiveNumber,
  burst: NonNegativeInt.default(0),
  cap: NonNegativeInt.default(0),
});

export const WaveDef = z.object({
  kind: z.literal("wave"),
  id: Id,
  entries: z.array(WaveEntry).min(1),
});

export type WaveDef = z.infer<typeof WaveDef>;
export type WaveEntry = z.infer<typeof WaveEntry>;

export function validateWaveEntries(w: WaveDef): string | null {
  for (const [i, e] of w.entries.entries()) {
    if (e.endSec <= e.startSec) {
      return `wave "${w.id}" entry[${i}]: endSec must be greater than startSec`;
    }
  }
  return null;
}
