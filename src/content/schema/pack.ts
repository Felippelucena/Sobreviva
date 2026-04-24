import { z } from "zod";
import { CharacterDef } from "./character";
import { SchemaVersion } from "./common";
import { EnemyDef } from "./enemy";
import { MapDef } from "./map";
import { PickupDef } from "./pickup";
import { WaveDef } from "./wave";
import { WeaponDef } from "./weapon";

export const AnyDef = z.discriminatedUnion("kind", [
  WeaponDef,
  EnemyDef,
  PickupDef,
  WaveDef,
  CharacterDef,
  MapDef,
]);

export type AnyDef = z.infer<typeof AnyDef>;

export const PackFile = z.object({
  schemaVersion: SchemaVersion,
  defs: z.array(AnyDef),
});

export type PackFile = z.infer<typeof PackFile>;

export type DefKind = AnyDef["kind"];
