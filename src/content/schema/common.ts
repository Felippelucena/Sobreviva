import { z } from "zod";

export const SCHEMA_VERSION = 1;

export const Id = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_.-]*$/, "id must be kebab/snake-case, starting with a letter or digit");

export const SchemaVersion = z.literal(SCHEMA_VERSION);

export const HexColor = z
  .number()
  .int()
  .min(0)
  .max(0xffffff);

export const PositiveNumber = z.number().positive();
export const NonNegativeNumber = z.number().nonnegative();
export const NonNegativeInt = z.number().int().nonnegative();
