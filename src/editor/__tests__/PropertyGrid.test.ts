import { describe, expect, it } from "vitest";
import { z } from "zod";
import { makeDefault } from "../PropertyGrid";
import { ShotSelect } from "../../content/schema/upgrade";

describe("makeDefault", () => {
  it("seeds ZodEnum with the first value", () => {
    const schema = z.enum(["projectile", "area"]);
    expect(makeDefault(schema)).toBe("projectile");
  });

  it("seeds ZodObject containing a ZodEnum field with that field present", () => {
    const schema = z.object({
      select: z.literal("type"),
      shotType: z.enum(["projectile", "area"]),
    });
    expect(makeDefault(schema)).toEqual({
      select: "type",
      shotType: "projectile",
    });
  });

  it("seeds ShotSelect discriminated union picking option { select: 'type' } with shotType present (regression: missing shotType broke mod re-import)", () => {
    // makeDefault on a discriminated union picks the first option. Force the
    // 'type' branch (index 1 in the schema) to assert the regression directly.
    const typeOption = ShotSelect.options[1];
    expect(makeDefault(typeOption)).toEqual({
      select: "type",
      shotType: "projectile",
    });
  });

  it("seeds ShotSelect discriminated union default (first option) as { select: 'all' }", () => {
    expect(makeDefault(ShotSelect)).toEqual({ select: "all" });
  });

  it("respects existing leaf defaults (number/string/boolean)", () => {
    expect(makeDefault(z.string())).toBe("");
    expect(makeDefault(z.boolean())).toBe(false);
    expect(makeDefault(z.number())).toBe(0);
    expect(makeDefault(z.number().min(5))).toBe(5);
  });

  it("unwraps ZodOptional/ZodDefault", () => {
    expect(makeDefault(z.enum(["a", "b"]).optional())).toBe("a");
    expect(makeDefault(z.string().default("hello"))).toBe("hello");
  });
});
