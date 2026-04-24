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

describe("WeaponDef", () => {
  it("accepts a complete weapon", () => {
    const parsed = WeaponDef.parse({
      kind: "weapon",
      id: "spark",
      name: "Spark",
      damage: 10,
      cooldownMs: 500,
      projectile: { speed: 300, radius: 4, lifetimeMs: 800 },
    });
    expect(parsed.projectile.pierce).toBe(0);
    expect(parsed.projectile.color).toBe(0xffd166);
  });

  it("rejects non-positive damage", () => {
    expect(() =>
      WeaponDef.parse({
        kind: "weapon",
        id: "bad",
        name: "Bad",
        damage: 0,
        cooldownMs: 500,
        projectile: { speed: 300, radius: 4, lifetimeMs: 800 },
      }),
    ).toThrow();
  });

  it("rejects ids with invalid characters", () => {
    expect(() =>
      WeaponDef.parse({
        kind: "weapon",
        id: "Has Spaces",
        name: "Bad",
        damage: 1,
        cooldownMs: 500,
        projectile: { speed: 300, radius: 4, lifetimeMs: 800 },
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
          damage: 10,
          cooldownMs: 500,
          projectile: { speed: 300, radius: 4, lifetimeMs: 800 },
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
