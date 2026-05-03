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
  scope: { kind: "weapon" },
  levels: [
    { name: "L1", description: "", improvements: [{ type: "attr", path: "cooldownMs", op: "mul", value: 0.9 }] },
    { name: "L2", description: "", improvements: [{ type: "attr", path: "cooldownMs", op: "mul", value: 0.75 }] },
    { name: "L3", description: "", improvements: [{ type: "attr", path: "cooldownMs", op: "mul", value: 0.5 }] },
  ],
};

const damageUpgrade: UpgradeDef = {
  kind: "upgrade",
  id: "damage",
  name: "Damage",
  desc: "",
  scope: { kind: "weapon" },
  levels: [
    { name: "L1", description: "", improvements: [{ type: "attr", path: "shots[].damage", op: "mul", value: 1.5, shotSelect: { select: "all" } }] },
    { name: "L2", description: "", improvements: [{ type: "attr", path: "shots[].damage", op: "mul", value: 2, shotSelect: { select: "all" } }] },
    { name: "L3", description: "", improvements: [{ type: "attr", path: "shots[].damage", op: "mul", value: 3, shotSelect: { select: "all" } }] },
  ],
};

const pierceUpgrade: UpgradeDef = {
  kind: "upgrade",
  id: "pierce",
  name: "Pierce",
  desc: "",
  scope: { kind: "weapon" },
  levels: [
    { name: "L1", description: "", improvements: [{ type: "attr", path: "shots[].projectile.pierce", op: "add", value: 1, shotSelect: { select: "type", shotType: "projectile" } }] },
    { name: "L2", description: "", improvements: [{ type: "attr", path: "shots[].projectile.pierce", op: "add", value: 2, shotSelect: { select: "type", shotType: "projectile" } }] },
    { name: "L3", description: "", improvements: [{ type: "attr", path: "shots[].projectile.pierce", op: "add", value: 3, shotSelect: { select: "type", shotType: "projectile" } }] },
  ],
};

const moveSpeedUpgrade: UpgradeDef = {
  kind: "upgrade",
  id: "move_speed",
  name: "Move",
  desc: "",
  scope: { kind: "character" },
  levels: [
    { name: "L1", description: "", improvements: [{ type: "attr", path: "baseSpeed", op: "mul", value: 1.1 }] },
    { name: "L2", description: "", improvements: [{ type: "attr", path: "baseSpeed", op: "mul", value: 1.25 }] },
    { name: "L3", description: "", improvements: [{ type: "attr", path: "baseSpeed", op: "mul", value: 1.5 }] },
  ],
};

const maxHpUpgrade: UpgradeDef = {
  kind: "upgrade",
  id: "max_hp",
  name: "HP",
  desc: "",
  scope: { kind: "character" },
  levels: [
    { name: "L1", description: "", improvements: [{ type: "attr", path: "baseHp", op: "add", value: 25 }] },
    { name: "L2", description: "", improvements: [{ type: "attr", path: "baseHp", op: "add", value: 50 }] },
    { name: "L3", description: "", improvements: [{ type: "attr", path: "baseHp", op: "add", value: 100 }] },
  ],
};

describe("applyUpgradesToWeapon", () => {
  it("applies mul on flat field absolute over base", () => {
    const w = makeWeapon();
    const out = applyUpgradesToWeapon(w, [{ def: cooldownUpgrade, level: 2 }]);
    expect(out.cooldownMs).toBeCloseTo(750);
    expect(w.cooldownMs).toBe(1000);
  });

  it("applies mul on array path to every shot when shotSelect=all", () => {
    const out = applyUpgradesToWeapon(makeWeapon(), [{ def: damageUpgrade, level: 1 }]);
    expect(out.shots[0]!.damage).toBeCloseTo(15);
    expect(out.shots[1]!.damage).toBeCloseTo(12);
  });

  it("applies add on nested array path filtered by shot type", () => {
    const out = applyUpgradesToWeapon(makeWeapon(), [{ def: pierceUpgrade, level: 3 }]);
    expect((out.shots[0] as { projectile: { pierce: number } }).projectile.pierce).toBe(3);
    expect((out.shots[1] as { projectile: { pierce: number } }).projectile.pierce).toBe(3);
  });

  it("recompute is idempotent — level 3 from base equals level 3 from base", () => {
    const a = applyUpgradesToWeapon(makeWeapon(), [{ def: cooldownUpgrade, level: 3 }]);
    const b = applyUpgradesToWeapon(makeWeapon(), [{ def: cooldownUpgrade, level: 3 }]);
    expect(a.cooldownMs).toBe(b.cooldownMs);
  });

  it("absolute multiplier — level 3 is base*level3 value, NOT cumulative", () => {
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

  it("scope.ids restricts to listed weapon ids only", () => {
    const restricted: UpgradeDef = {
      ...cooldownUpgrade,
      id: "rifle_only",
      scope: { kind: "weapon", ids: ["rifle"] },
    };
    const out = applyUpgradesToWeapon(makeWeapon(), [{ def: restricted, level: 2 }]);
    expect(out.cooldownMs).toBe(1000);
  });

  it("silently skips non-matching shots when shotSelect filters by type", () => {
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

  it("shotSelect=index targets only the chosen shot", () => {
    const onlyFirst: UpgradeDef = {
      kind: "upgrade",
      id: "only_first",
      name: "Only first",
      desc: "",
      scope: { kind: "weapon" },
      levels: [
        {
          name: "L1",
          description: "",
          improvements: [{ type: "attr", path: "shots[].damage", op: "set", value: 999, shotSelect: { select: "index", index: 0 } }],
        },
      ],
    };
    const out = applyUpgradesToWeapon(makeWeapon(), [{ def: onlyFirst, level: 1 }]);
    expect(out.shots[0]!.damage).toBe(999);
    expect(out.shots[1]!.damage).toBe(8);
  });

  it("pushShot adds exactly one shot per pushShot improvement at the level", () => {
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
      scope: { kind: "weapon" },
      levels: [
        { name: "L1", description: "", improvements: [{ type: "pushShot", shot: newShot }] },
        { name: "L2", description: "", improvements: [{ type: "pushShot", shot: { ...newShot, angleOffsetDeg: -30 } }] },
      ],
    };
    const out = applyUpgradesToWeapon(makeWeapon(), [{ def: pushUpgrade, level: 2 }]);
    expect(out.shots).toHaveLength(3);
    const s2 = out.shots[2]!;
    if (s2.type !== "projectile") throw new Error("expected pushed shot to be projectile");
    expect(s2.angleOffsetDeg).toBe(-30);
  });

  it("multi-improvement level applies every improvement in one block", () => {
    const combo: UpgradeDef = {
      kind: "upgrade",
      id: "combo",
      name: "Combo",
      desc: "",
      scope: { kind: "weapon" },
      levels: [
        {
          name: "Power",
          description: "damage + pierce",
          improvements: [
            { type: "attr", path: "shots[].damage", op: "mul", value: 2, shotSelect: { select: "all" } },
            { type: "attr", path: "shots[].projectile.pierce", op: "add", value: 1, shotSelect: { select: "type", shotType: "projectile" } },
          ],
        },
      ],
    };
    const out = applyUpgradesToWeapon(makeWeapon(), [{ def: combo, level: 1 }]);
    expect(out.shots[0]!.damage).toBe(20);
    expect((out.shots[0] as { projectile: { pierce: number } }).projectile.pierce).toBe(1);
  });
});

describe("applyUpgradesToWeapon — security", () => {
  function evilAttr(path: string, value: number): UpgradeDef {
    return {
      kind: "upgrade",
      id: "evil",
      name: "Evil",
      desc: "",
      scope: { kind: "weapon" },
      levels: [
        { name: "L1", description: "", improvements: [{ type: "attr", path, op: "set", value }] },
      ],
    };
  }

  it("rejects path containing __proto__ (prototype pollution attempt)", () => {
    applyUpgradesToWeapon(makeWeapon(), [{ def: evilAttr("__proto__.polluted", 42), level: 1 }]);
    expect((Object.prototype as Record<string, unknown>)["polluted"]).toBeUndefined();
  });

  it("rejects path containing constructor.prototype", () => {
    applyUpgradesToWeapon(makeWeapon(), [{ def: evilAttr("constructor.prototype.polluted2", 99), level: 1 }]);
    expect((Object.prototype as Record<string, unknown>)["polluted2"]).toBeUndefined();
  });

  it("ignores path that only matches via prototype chain (uses hasOwn)", () => {
    const out = applyUpgradesToWeapon(makeWeapon(), [{ def: evilAttr("toString", 123), level: 1 }]);
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

  it("scope.ids restricts to listed character ids only", () => {
    const restricted: UpgradeDef = {
      ...moveSpeedUpgrade,
      id: "john_only",
      scope: { kind: "character", ids: ["john"] },
    };
    const out = applyUpgradesToCharacter(makeCharacter(), [{ def: restricted, level: 2 }]);
    expect(out.baseSpeed).toBe(180);
  });
});
