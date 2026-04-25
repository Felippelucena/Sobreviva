import { describe, expect, it } from "vitest";
import type { CharacterDef } from "../../../content/schema/character";
import type { UpgradeDef } from "../../../content/schema/upgrade";
import type { WeaponDef } from "../../../content/schema/weapon";
import { applyUpgradesToCharacter, applyUpgradesToWeapon } from "../applyUpgrades";

function makeWeapon(): WeaponDef {
  return {
    kind: "weapon",
    id: "test",
    name: "Test",
    cooldownMs: 1000,
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
      {
        type: "projectile",
        startMs: 0,
        projectileCount: 1,
        projectileIntervalMs: 0,
        angleOffsetDeg: 15,
        damage: 8,
        projectile: { speed: 300, radius: 4, lifetimeMs: 800, pierce: 0, color: 0xffd166 },
      },
    ],
  };
}

function makeCharacter(): CharacterDef {
  return {
    kind: "character",
    id: "test_char",
    name: "Tester",
    startWeaponId: "test",
    baseHp: 100,
    baseSpeed: 180,
    pickupRadius: 90,
    sprite: { color: 0xffffff, radius: 12 },
    upgradeIds: [],
    maxWeapons: 4,
  };
}

const cooldownUpgrade: UpgradeDef = {
  kind: "upgrade",
  id: "cooldown",
  name: "Cooldown",
  desc: "",
  scope: "weapon",
  maxLevel: 3,
  target: { path: "cooldownMs", op: "mul" },
  values: [0.9, 0.75, 0.5],
};

const damageUpgrade: UpgradeDef = {
  kind: "upgrade",
  id: "damage",
  name: "Damage",
  desc: "",
  scope: "weapon",
  maxLevel: 3,
  target: { path: "shots[].damage", op: "mul" },
  values: [1.5, 2, 3],
};

const pierceUpgrade: UpgradeDef = {
  kind: "upgrade",
  id: "pierce",
  name: "Pierce",
  desc: "",
  scope: "weapon",
  maxLevel: 3,
  target: { path: "shots[].projectile.pierce", op: "add" },
  values: [1, 2, 3],
};

const moveSpeedUpgrade: UpgradeDef = {
  kind: "upgrade",
  id: "move_speed",
  name: "Move",
  desc: "",
  scope: "character",
  maxLevel: 3,
  target: { path: "baseSpeed", op: "mul" },
  values: [1.1, 1.25, 1.5],
};

const maxHpUpgrade: UpgradeDef = {
  kind: "upgrade",
  id: "max_hp",
  name: "HP",
  desc: "",
  scope: "character",
  maxLevel: 3,
  target: { path: "baseHp", op: "add" },
  values: [25, 50, 100],
};

describe("applyUpgradesToWeapon", () => {
  it("applies mul on flat field absolute over base", () => {
    const w = makeWeapon();
    const out = applyUpgradesToWeapon(w, [{ def: cooldownUpgrade, level: 2 }]);
    expect(out.cooldownMs).toBeCloseTo(750);
    expect(w.cooldownMs).toBe(1000);
  });

  it("applies mul on array path to every shot", () => {
    const out = applyUpgradesToWeapon(makeWeapon(), [{ def: damageUpgrade, level: 1 }]);
    expect(out.shots[0]!.damage).toBeCloseTo(15);
    expect(out.shots[1]!.damage).toBeCloseTo(12);
  });

  it("applies add on nested array path", () => {
    const out = applyUpgradesToWeapon(makeWeapon(), [{ def: pierceUpgrade, level: 3 }]);
    expect((out.shots[0] as { projectile: { pierce: number } }).projectile.pierce).toBe(3);
    expect((out.shots[1] as { projectile: { pierce: number } }).projectile.pierce).toBe(3);
  });

  it("recompute is idempotent — level 3 from base equals level 3 from base", () => {
    const a = applyUpgradesToWeapon(makeWeapon(), [{ def: cooldownUpgrade, level: 3 }]);
    const b = applyUpgradesToWeapon(makeWeapon(), [{ def: cooldownUpgrade, level: 3 }]);
    expect(a.cooldownMs).toBe(b.cooldownMs);
  });

  it("absolute multiplier — level 3 is base*values[2], NOT base*v0*v1*v2", () => {
    const out = applyUpgradesToWeapon(makeWeapon(), [{ def: cooldownUpgrade, level: 3 }]);
    expect(out.cooldownMs).toBe(500); // 1000 * 0.5
    expect(out.cooldownMs).not.toBe(1000 * 0.9 * 0.75 * 0.5);
  });

  it("ignores upgrade out of scope (character upgrade on weapon base)", () => {
    const out = applyUpgradesToWeapon(makeWeapon(), [{ def: moveSpeedUpgrade, level: 1 }]);
    expect(out.cooldownMs).toBe(1000);
  });

  it("does not mutate the base def", () => {
    const w = makeWeapon();
    applyUpgradesToWeapon(w, [{ def: damageUpgrade, level: 3 }]);
    expect(w.shots[0]!.damage).toBe(10);
  });

  it("silently skips non-matching paths (e.g. pierce on area shot)", () => {
    const areaWeapon: WeaponDef = {
      ...makeWeapon(),
      shots: [
        {
          type: "area",
          startMs: 0,
          projectileCount: 1,
          projectileIntervalMs: 0,
          damage: 30,
          radius: 80,
          originOffsetX: 0,
          originOffsetY: 0,
          lifetimeMs: 200,
          color: 0xff0000,
        },
      ],
    };
    expect(() =>
      applyUpgradesToWeapon(areaWeapon, [{ def: pierceUpgrade, level: 2 }]),
    ).not.toThrow();
  });

  it("pushShot appends one shot per level (level 2 = 2 added)", () => {
    const newShot = {
      type: "projectile" as const,
      startMs: 0,
      projectileCount: 1,
      projectileIntervalMs: 0,
      angleOffsetDeg: 30,
      damage: 5,
      projectile: { speed: 400, radius: 3, lifetimeMs: 500, pierce: 0, color: 0x00ff00 },
    };
    const pushUpgrade: UpgradeDef = {
      kind: "upgrade",
      id: "extra_shot",
      name: "Extra Shot",
      desc: "",
      scope: "weapon",
      maxLevel: 2,
      target: { path: "shots", op: "pushShot" },
      values: [newShot, { ...newShot, angleOffsetDeg: -30 }],
    };
    const out = applyUpgradesToWeapon(makeWeapon(), [{ def: pushUpgrade, level: 2 }]);
    expect(out.shots).toHaveLength(4);
    const s2 = out.shots[2]!;
    const s3 = out.shots[3]!;
    if (s2.type !== "projectile" || s3.type !== "projectile") {
      throw new Error("expected both pushed shots to be projectile");
    }
    expect(s2.angleOffsetDeg).toBe(30);
    expect(s3.angleOffsetDeg).toBe(-30);
  });
});

describe("applyUpgradesToWeapon — security", () => {
  it("rejects path containing __proto__ (prototype pollution attempt)", () => {
    const evil: UpgradeDef = {
      kind: "upgrade",
      id: "evil",
      name: "Evil",
      desc: "",
      scope: "weapon",
      maxLevel: 1,
      target: { path: "__proto__.polluted", op: "set" },
      values: [42],
    };
    applyUpgradesToWeapon(makeWeapon(), [{ def: evil, level: 1 }]);
    expect((Object.prototype as Record<string, unknown>)["polluted"]).toBeUndefined();
  });

  it("rejects path containing constructor.prototype", () => {
    const evil: UpgradeDef = {
      kind: "upgrade",
      id: "evil2",
      name: "Evil2",
      desc: "",
      scope: "weapon",
      maxLevel: 1,
      target: { path: "constructor.prototype.polluted2", op: "set" },
      values: [99],
    };
    applyUpgradesToWeapon(makeWeapon(), [{ def: evil, level: 1 }]);
    expect((Object.prototype as Record<string, unknown>)["polluted2"]).toBeUndefined();
  });

  it("ignores path that only matches via prototype chain (uses hasOwn)", () => {
    const sneaky: UpgradeDef = {
      kind: "upgrade",
      id: "sneaky",
      name: "Sneaky",
      desc: "",
      scope: "weapon",
      maxLevel: 1,
      // toString exists on every object via Object.prototype, but is not own.
      target: { path: "toString", op: "set" },
      values: [123],
    };
    const out = applyUpgradesToWeapon(makeWeapon(), [{ def: sneaky, level: 1 }]);
    expect(typeof out.toString).toBe("function");
  });
});

describe("applyUpgradesToCharacter", () => {
  it("applies mul on baseSpeed", () => {
    const out = applyUpgradesToCharacter(makeCharacter(), [{ def: moveSpeedUpgrade, level: 2 }]);
    expect(out.baseSpeed).toBeCloseTo(225); // 180 * 1.25
  });

  it("applies add on baseHp", () => {
    const out = applyUpgradesToCharacter(makeCharacter(), [{ def: maxHpUpgrade, level: 1 }]);
    expect(out.baseHp).toBe(125);
  });

  it("ignores weapon-scope upgrades", () => {
    const out = applyUpgradesToCharacter(makeCharacter(), [{ def: cooldownUpgrade, level: 3 }]);
    expect(out.baseHp).toBe(100);
    expect(out.baseSpeed).toBe(180);
  });
});
