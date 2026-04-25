import { describe, expect, it } from "vitest";
import { bundleFromLoadedPack, parseBundle } from "../bundle";
import type { LoadedPack } from "../PackLoader";
import type { BundledPack, WeaponDef } from "../schema";

function sampleWeapon(damage = 30): WeaponDef {
  return {
    kind: "weapon",
    id: "spark",
    name: "Spark Plus",
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
              damage,
              projectile: { speed: 400, radius: 5, lifetimeMs: 800, pierce: 0, color: 0xffd166 },
            },
          ],
        },
      ],
    },
  };
}

function validBundle(): BundledPack {
  return {
    schemaVersion: 1,
    manifest: {
      id: "mymod",
      name: "My Mod",
      version: "0.1.0",
      priority: 50,
      dependsOn: [],
    },
    defs: [sampleWeapon()],
    scripts: [],
  };
}

describe("parseBundle", () => {
  it("parses a valid bundle", () => {
    const b = parseBundle(validBundle());
    expect(b.manifest.id).toBe("mymod");
    expect(b.defs).toHaveLength(1);
  });

  it("rejects duplicate def ids in a bundle", () => {
    const b = validBundle();
    b.defs.push({ ...b.defs[0]! });
    expect(() => parseBundle(b)).toThrow(/Duplicate def/);
  });

  it("rejects invalid wave entries", () => {
    const b = validBundle();
    b.defs = [
      {
        kind: "wave",
        id: "w",
        entries: [{ enemyId: "runner", startSec: 10, endSec: 5, ratePerSec: 1, burst: 0, cap: 0 }],
      },
    ];
    expect(() => parseBundle(b)).toThrow(/endSec must be greater/);
  });

  it("rejects missing manifest id", () => {
    expect(() => parseBundle({ ...validBundle(), manifest: { name: "x", version: "1" } })).toThrow();
  });
});

describe("bundleFromLoadedPack", () => {
  it("roundtrips a loaded pack to a bundle", () => {
    const pack: LoadedPack = {
      manifest: {
        schemaVersion: 1,
        id: "base",
        name: "Base",
        version: "0.1.0",
        priority: 0,
        dependsOn: [],
        files: ["weapons.json"],
        js: [],
      },
      defs: [sampleWeapon(10)],
    };
    const bundle = bundleFromLoadedPack(pack);
    expect(bundle.manifest.id).toBe("base");
    expect(bundle.manifest).not.toHaveProperty("files");
    expect(bundle.defs).toEqual(pack.defs);
    expect(() => parseBundle(bundle)).not.toThrow();
  });
});
