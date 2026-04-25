import { describe, expect, it } from "vitest";
import {
  CharacterDef,
  EnemyDef,
  PackFile,
  PackManifest,
  PickupDef,
  WaveDef,
  WeaponDef,
  validateWaveEntries,
} from "../schema";

function singleProjectileVolleys(damage = 10) {
  return [
    {
      startMs: 0,
      projectileCount: 1,
      projectileIntervalMs: 0,
      shots: [
        {
          type: "projectile" as const,
          angleOffsetDeg: 0,
          damage,
          projectile: { speed: 300, radius: 4, lifetimeMs: 800 },
        },
      ],
    },
  ];
}

describe("WeaponDef", () => {
  it("accepts a straight-shot weapon", () => {
    const parsed = WeaponDef.parse({
      kind: "weapon",
      id: "spark",
      name: "Spark",
      cooldownMs: 500,
      volleys: singleProjectileVolleys(),
    });
    const shot = parsed.volleys[0]!.shots[0]!;
    expect(shot.type).toBe("projectile");
    if (shot.type === "projectile") {
      expect(shot.projectile.pierce).toBe(0);
      expect(shot.projectile.color).toBe(0xffd166);
    }
  });

  it("rejects non-positive damage on a shot", () => {
    expect(() =>
      WeaponDef.parse({
        kind: "weapon",
        id: "bad",
        name: "Bad",
        cooldownMs: 500,
        volleys: singleProjectileVolleys(0),
      }),
    ).toThrow();
  });

  it("rejects ids with invalid characters", () => {
    expect(() =>
      WeaponDef.parse({
        kind: "weapon",
        id: "Has Spaces",
        name: "Bad",
        cooldownMs: 500,
        volleys: singleProjectileVolleys(),
      }),
    ).toThrow();
  });

  it("requires at least one volley", () => {
    expect(() =>
      WeaponDef.parse({
        kind: "weapon",
        id: "no_volleys",
        name: "X",
        cooldownMs: 500,
        volleys: [],
      }),
    ).toThrow();
  });

  it("accepts an explicit shotgun spread (1 volley, 3 shots)", () => {
    const parsed = WeaponDef.parse({
      kind: "weapon",
      id: "shotgun",
      name: "Shotgun",
      cooldownMs: 1000,
      volleys: [
        {
          startMs: 0,
          projectileCount: 1,
          projectileIntervalMs: 0,
          shots: [-15, 0, 15].map((a) => ({
            type: "projectile" as const,
            angleOffsetDeg: a,
            damage: 8,
            projectile: { speed: 400, radius: 4, lifetimeMs: 600 },
          })),
        },
      ],
    });
    expect(parsed.volleys[0]!.shots).toHaveLength(3);
    const first = parsed.volleys[0]!.shots[0]!;
    if (first.type === "projectile") {
      expect(first.angleOffsetDeg).toBe(-15);
      expect(first.damage).toBe(8);
    }
  });

  it("accepts an area shot with damage on the shot", () => {
    const parsed = WeaponDef.parse({
      kind: "weapon",
      id: "nova",
      name: "Nova",
      cooldownMs: 1500,
      volleys: [
        {
          startMs: 0,
          projectileCount: 1,
          projectileIntervalMs: 0,
          shots: [{ type: "area", damage: 22, radius: 80 }],
        },
      ],
    });
    const shot = parsed.volleys[0]!.shots[0]!;
    expect(shot.type).toBe("area");
    if (shot.type === "area") {
      expect(shot.radius).toBe(80);
      expect(shot.damage).toBe(22);
      expect(shot.lifetimeMs).toBe(0);
    }
  });

  it("accepts a volley with projectileCount + projectileIntervalMs (smg)", () => {
    const parsed = WeaponDef.parse({
      kind: "weapon",
      id: "smg",
      name: "SMG",
      cooldownMs: 1000,
      volleys: [
        {
          startMs: 0,
          projectileCount: 6,
          projectileIntervalMs: 50,
          shots: [
            {
              type: "projectile",
              angleOffsetDeg: 0,
              damage: 4,
              projectile: { speed: 500, radius: 3, lifetimeMs: 600 },
            },
          ],
        },
      ],
    });
    expect(parsed.volleys[0]!.projectileCount).toBe(6);
    expect(parsed.volleys[0]!.projectileIntervalMs).toBe(50);
  });

  it("accepts staggered volleys via startMs", () => {
    const parsed = WeaponDef.parse({
      kind: "weapon",
      id: "stagger",
      name: "Stagger",
      cooldownMs: 1500,
      volleys: [
        { startMs: 0, projectileCount: 1, projectileIntervalMs: 0, shots: singleProjectileVolleys()[0]!.shots },
        { startMs: 0, projectileCount: 1, projectileIntervalMs: 0, shots: singleProjectileVolleys()[0]!.shots },
        { startMs: 200, projectileCount: 1, projectileIntervalMs: 0, shots: singleProjectileVolleys()[0]!.shots },
      ],
    });
    expect(parsed.volleys.map((v) => v.startMs)).toEqual([0, 0, 200]);
  });

  it("rejects a volley with empty shots", () => {
    expect(() =>
      WeaponDef.parse({
        kind: "weapon",
        id: "bad",
        name: "Bad",
        cooldownMs: 500,
        volleys: [{ startMs: 0, projectileCount: 1, projectileIntervalMs: 0, shots: [] }],
      }),
    ).toThrow();
  });
});

describe("EnemyDef", () => {
  it("requires sprite and hitbox", () => {
    expect(() =>
      EnemyDef.parse({
        kind: "enemy",
        id: "runner",
        name: "Runner",
        hp: 10,
        speed: 50,
        contactDamage: 5,
        xpDrop: 1,
      }),
    ).toThrow();
  });
});

describe("WaveDef validation", () => {
  it("rejects entry with endSec <= startSec", () => {
    const wave = WaveDef.parse({
      kind: "wave",
      id: "bad",
      entries: [{ enemyId: "runner", startSec: 10, endSec: 5, ratePerSec: 1 }],
    });
    expect(validateWaveEntries(wave)).toMatch(/endSec must be greater/);
  });

  it("passes when entries are valid", () => {
    const wave = WaveDef.parse({
      kind: "wave",
      id: "ok",
      entries: [{ enemyId: "runner", startSec: 0, endSec: 10, ratePerSec: 1 }],
    });
    expect(validateWaveEntries(wave)).toBeNull();
  });
});

describe("PackManifest", () => {
  it("requires at least one file", () => {
    expect(() =>
      PackManifest.parse({
        schemaVersion: 1,
        id: "p",
        name: "P",
        version: "0.1.0",
        files: [],
      }),
    ).toThrow();
  });

  it("defaults priority and dependsOn", () => {
    const m = PackManifest.parse({
      schemaVersion: 1,
      id: "p",
      name: "P",
      version: "0.1.0",
      files: ["a.json"],
    });
    expect(m.priority).toBe(0);
    expect(m.dependsOn).toEqual([]);
    expect(m.js).toEqual([]);
  });
});

describe("PackFile discriminated union", () => {
  it("parses mixed kinds", () => {
    const file = PackFile.parse({
      schemaVersion: 1,
      defs: [
        {
          kind: "weapon",
          id: "spark",
          name: "Spark",
          cooldownMs: 500,
          volleys: singleProjectileVolleys(),
        },
        {
          kind: "pickup",
          id: "xp_small",
          effect: "xp",
          value: 1,
          sprite: { color: 0x06d6a0, radius: 4 },
        },
      ],
    });
    expect(file.defs).toHaveLength(2);
    expect(file.defs[0]!.kind).toBe("weapon");
  });

  it("rejects unknown kind", () => {
    expect(() =>
      PackFile.parse({
        schemaVersion: 1,
        defs: [{ kind: "wat", id: "x" }],
      }),
    ).toThrow();
  });
});

describe("CharacterDef + PickupDef smoke", () => {
  it("parse", () => {
    CharacterDef.parse({
      kind: "character",
      id: "runner",
      name: "Runner",
      startWeaponId: "spark",
      baseHp: 100,
      baseSpeed: 180,
      sprite: { color: 0x4cc9f0, radius: 12 },
    });
    PickupDef.parse({
      kind: "pickup",
      id: "heal_small",
      effect: "heal",
      value: 15,
      sprite: { color: 0xffd166, radius: 6 },
    });
  });
});
