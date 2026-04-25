import { describe, expect, it } from "vitest";
import { mergeDef } from "../MergePolicy";
import type { WeaponDef } from "../schema";

function baseWeapon(): WeaponDef {
  return {
    kind: "weapon",
    id: "spark",
    name: "Spark",
    cooldownMs: 500,
    burst: {
      volleyCount: 1,
      volleyIntervalMs: 0,
      volleys: [
        {
          shots: [
            {
              type: "projectile",
              angleOffsetDeg: 0,
              damage: 10,
              projectile: { speed: 300, radius: 4, lifetimeMs: 800, pierce: 0, color: 0xffd166 },
            },
          ],
        },
      ],
    },
  };
}

describe("mergeDef", () => {
  it("later overrides earlier at top level", () => {
    const a = baseWeapon();
    const b: WeaponDef = { ...baseWeapon(), cooldownMs: 999 };
    const merged = mergeDef(a, b) as WeaponDef;
    expect(merged.cooldownMs).toBe(999);
    expect(merged.name).toBe("Spark");
  });

  it("shallow-merges nested burst object one level deep", () => {
    const a = baseWeapon();
    const b: WeaponDef = {
      ...baseWeapon(),
      burst: { ...baseWeapon().burst, volleyCount: 7 },
    };
    const merged = mergeDef(a, b) as WeaponDef;
    expect(merged.burst.volleyCount).toBe(7);
    expect(merged.burst.volleyIntervalMs).toBe(0);
  });

  it("throws on kind mismatch", () => {
    const a = baseWeapon();
    const b = {
      kind: "enemy" as const,
      id: "spark",
      name: "Fake",
      hp: 1,
      speed: 1,
      contactDamage: 1,
      xpDrop: 0,
      hitbox: { radius: 1 },
      sprite: { color: 0, radius: 1 },
    };
    expect(() => mergeDef(a, b)).toThrow(/kind mismatch/);
  });
});
