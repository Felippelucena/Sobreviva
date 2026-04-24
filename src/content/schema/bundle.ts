import { z } from "zod";
import { Id, SchemaVersion } from "./common";
import { AnyDef } from "./pack";

export const BundledManifest = z.object({
  id: Id,
  name: z.string().min(1),
  version: z.string().min(1),
  priority: z.number().int().default(0),
  dependsOn: z.array(Id).default([]),
});

export type BundledManifest = z.infer<typeof BundledManifest>;

export const PackScript = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
});

export type PackScript = z.infer<typeof PackScript>;

export const BundledPack = z.object({
  schemaVersion: SchemaVersion,
  manifest: BundledManifest,
  defs: z.array(AnyDef),
  scripts: z.array(PackScript).default([]),
});

export type BundledPack = z.infer<typeof BundledPack>;
