import { describe, expect, it } from "vitest";
import { mergeDef } from "../MergePolicy";
import type { WeaponDef } from "../schema";

function baseWeapon(): WeaponDef {
  return {
    kind: "weapon",
    id: "spark",
    name: "Spark",
    damage: 10,
    cooldownMs: 500,
    projectile: { speed: 300, radius: 4, lifetimeMs: 800, pierce: 0, color: 0xffd166 },
  };
}

describe("mergeDef", () => {
  it("later overrides earlier at top level", () => {
    const a = baseWeapon();
    const b: WeaponDef = { ...baseWeapon(), damage: 99 };
    const merged = mergeDef(a, b) as WeaponDef;
    expect(merged.damage).toBe(99);
    expect(merged.cooldownMs).toBe(500);
  });

  it("shallow-merges nested objects one level deep", () => {
    const a = baseWeapon();
    const b: WeaponDef = {
      ...baseWeapon(),
      projectile: { ...baseWeapon().projectile, speed: 999 },
    };
    const merged = mergeDef(a, b) as WeaponDef;
    expect(merged.projectile.speed).toBe(999);
    expect(merged.projectile.radius).toBe(4);
    expect(merged.projectile.color).toBe(0xffd166);
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
