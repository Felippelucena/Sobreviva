import { describe, expect, it } from "vitest";
import { mergeDef } from "../MergePolicy";
import type { WeaponDef } from "../schema";

function baseWeapon(): WeaponDef {
  return {
    kind: "weapon",
    id: "spark",
    name: "Spark",
    cooldownMs: 500,
    upgradeIds: [],
    shots: [
      {
        type: "projectile",
        startMs: 0,
        projectileCount: 1,
        projectileIntervalMs: 0,
        angleOffsetDeg: 0,
        damage: 10,
        projectile: { speed: 300, radius: 4, lifetimeMs: 800, pierce: 0, color: 0xffd166 },
      },
    ],
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

  it("replaces shots array when override provides one", () => {
    const a = baseWeapon();
    const buffedShots = baseWeapon().shots.map((s) => {
      if (s.type === "projectile") return { ...s, projectileCount: 3, projectileIntervalMs: 25 };
      return s;
    });
    const b: WeaponDef = { ...baseWeapon(), shots: buffedShots };
    const merged = mergeDef(a, b) as WeaponDef;
    const shot = merged.shots[0]!;
    if (shot.type === "projectile") {
      expect(shot.projectileCount).toBe(3);
      expect(shot.projectileIntervalMs).toBe(25);
    }
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
