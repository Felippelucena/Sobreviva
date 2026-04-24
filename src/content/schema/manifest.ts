import { z } from "zod";
import { Id, SchemaVersion } from "./common";

export const PackManifest = z.object({
  schemaVersion: SchemaVersion,
  id: Id,
  name: z.string().min(1),
  version: z.string().min(1),
  priority: z.number().int().default(0),
  dependsOn: z.array(Id).default([]),
  files: z.array(z.string().min(1)).min(1),
  js: z.array(z.string().min(1)).default([]),
});

export type PackManifest = z.infer<typeof PackManifest>;
