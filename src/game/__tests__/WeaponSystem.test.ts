import { describe, expect, it, vi, beforeEach } from "vitest";
import { Container } from "pixi.js";
import { World, type EntityId } from "../../engine/World";
import { EventBus } from "../../engine/events/EventBus";
import { WeaponDef } from "../../content/schema/weapon";
import { weaponSystem } from "../systems/WeaponSystem";
import {
  AreaDamage,
  EnemyTag,
  Hitbox,
  PlayerTag,
  Position,
  Projectile,
  ProjectileTag,
  Velocity,
  WeaponState,
} from "../components";
import { weaponStateFromDef } from "../factories";

function fakeRenderer() {
  const world = new Container();
  return { world } as unknown as import("../../engine/Renderer").Renderer;
}

const TICK_DT = 1 / 60;

function buildPlayer(world: World, weapon: WeaponDef): EntityId {
  const id = world.createEntity();
  world.add(id, PlayerTag, true);
  world.add(id, Position, { x: 0, y: 0, prevX: 0, prevY: 0 });
  world.add(id, WeaponState, weaponStateFromDef(weapon));
  return id;
}

function buildEnemy(world: World, x: number, y: number): EntityId {
  const id = world.createEntity();
  world.add(id, EnemyTag, true);
  world.add(id, Position, { x, y, prevX: x, prevY: y });
  world.add(id, Hitbox, { radius: 8 });
  return id;
}

function countProjectiles(world: World): number {
  let n = 0;
  for (const [id] of world.query(Projectile)) {
    if (world.has(id, ProjectileTag)) n += 1;
  }
  return n;
}

function countAoe(world: World): number {
  let n = 0;
  for (const [, ] of world.query(AreaDamage)) n += 1;
  return n;
}

function projShot(opts: Partial<{ startMs: number; projectileCount: number; projectileIntervalMs: number; angleOffsetDeg: number; damage: number; speed: number }> = {}) {
  return {
    type: "projectile" as const,
    startMs: opts.startMs ?? 0,
    projectileCount: opts.projectileCount ?? 1,
    projectileIntervalMs: opts.projectileIntervalMs ?? 0,
    angleOffsetDeg: opts.angleOffsetDeg ?? 0,
    damage: opts.damage ?? 10,
    projectile: { speed: opts.speed ?? 360, radius: 4, lifetimeMs: 800 },
  };
}

function straightWeapon(opts: { id?: string; cooldownMs?: number } = {}): WeaponDef {
  return WeaponDef.parse({
    kind: "weapon",
    id: opts.id ?? "test",
    name: "Test",
    cooldownMs: opts.cooldownMs ?? 600,
    volleys: [{ shots: [projShot()] }],
  });
}

describe("WeaponSystem", () => {
  let world: World;
  let renderer: ReturnType<typeof fakeRenderer>;
  let bus: EventBus;

  beforeEach(() => {
    world = new World();
    renderer = fakeRenderer();
    bus = new EventBus();
  });

  it("straight weapon fires once per cooldown", () => {
    const weapon = straightWeapon({ id: "spark", cooldownMs: 600 });
    buildPlayer(world, weapon);
    buildEnemy(world, 200, 0);

    weaponSystem(world, renderer, bus, TICK_DT);
    expect(countProjectiles(world)).toBe(1);

    for (let i = 0; i < 30; i++) weaponSystem(world, renderer, bus, TICK_DT);
    expect(countProjectiles(world)).toBe(1);

    for (let i = 0; i < 40; i++) weaponSystem(world, renderer, bus, TICK_DT);
    expect(countProjectiles(world)).toBe(2);
  });

  it("low cooldown still fires at most once per tick (60Hz floor)", () => {
    const weapon = straightWeapon({ id: "fast", cooldownMs: 5 });
    buildPlayer(world, weapon);
    buildEnemy(world, 200, 0);

    for (let i = 0; i < 10; i++) weaponSystem(world, renderer, bus, TICK_DT);
    expect(countProjectiles(world)).toBeLessThanOrEqual(10);
    expect(countProjectiles(world)).toBeGreaterThanOrEqual(8);
  });

  it("shot.projectileCount=6 with interval=50ms enqueues 6 shots and fires within 250ms", () => {
    const weapon = WeaponDef.parse({
      kind: "weapon",
      id: "smg",
      name: "SMG",
      cooldownMs: 1000,
      volleys: [{ shots: [projShot({ projectileCount: 6, projectileIntervalMs: 50, damage: 4, speed: 500 })] }],
    });
    const playerId = buildPlayer(world, weapon);
    buildEnemy(world, 200, 0);

    weaponSystem(world, renderer, bus, TICK_DT);
    expect(countProjectiles(world)).toBe(1);
    const ws = world.get(playerId, WeaponState)!;
    expect(ws.pendingShots.length).toBe(5);

    for (let i = 0; i < 16; i++) weaponSystem(world, renderer, bus, TICK_DT);
    expect(countProjectiles(world)).toBe(6);
    expect(ws.pendingShots.length).toBe(0);
  });

  it("3 angled shots in one volley fire 3 projectiles in one tick", () => {
    const weapon = WeaponDef.parse({
      kind: "weapon",
      id: "shotgun",
      name: "Shotgun",
      cooldownMs: 1000,
      volleys: [
        {
          shots: [-15, 0, 15].map((a) => projShot({ angleOffsetDeg: a, damage: 8, speed: 400 })),
        },
      ],
    });
    buildPlayer(world, weapon);
    buildEnemy(world, 200, 0);

    weaponSystem(world, renderer, bus, TICK_DT);
    expect(countProjectiles(world)).toBe(3);

    const angles: number[] = [];
    for (const [, vel] of world.query(Velocity)) {
      angles.push(Math.atan2(vel.vy, vel.vx) * (180 / Math.PI));
    }
    angles.sort((a, b) => a - b);
    expect(angles[0]).toBeCloseTo(-15, 1);
    expect(angles[1]).toBeCloseTo(0, 1);
    expect(angles[2]).toBeCloseTo(15, 1);
  });

  it("staggered shots fire according to shot.startMs", () => {
    const weapon = WeaponDef.parse({
      kind: "weapon",
      id: "stagger",
      name: "Stagger",
      cooldownMs: 1500,
      volleys: [
        {
          shots: [
            projShot({ startMs: 0 }),
            projShot({ startMs: 0 }),
            projShot({ startMs: 200 }),
          ],
        },
      ],
    });
    const playerId = buildPlayer(world, weapon);
    buildEnemy(world, 200, 0);

    weaponSystem(world, renderer, bus, TICK_DT);
    // First tick at clockMs ≈ 16.67. Both startMs=0 shots should fire (atMs=16.67 ≤ 16.67).
    expect(countProjectiles(world)).toBe(2);
    const ws = world.get(playerId, WeaponState)!;
    expect(ws.pendingShots.length).toBe(1);

    // Advance ~220ms; the startMs=200 shot should fire.
    for (let i = 0; i < 13; i++) weaponSystem(world, renderer, bus, TICK_DT);
    expect(countProjectiles(world)).toBe(3);
  });

  it("area shot creates an AreaDamage entity, no projectile", () => {
    const weapon = WeaponDef.parse({
      kind: "weapon",
      id: "nova",
      name: "Nova",
      cooldownMs: 1500,
      volleys: [
        {
          shots: [
            {
              type: "area",
              startMs: 0,
              projectileCount: 1,
              projectileIntervalMs: 0,
              damage: 22,
              radius: 80,
            },
          ],
        },
      ],
    });
    buildPlayer(world, weapon);
    buildEnemy(world, 50, 0);

    weaponSystem(world, renderer, bus, TICK_DT);
    expect(countProjectiles(world)).toBe(0);
    expect(countAoe(world)).toBe(1);
  });

  it("emits weaponFire event per shot fired", () => {
    const weapon = WeaponDef.parse({
      kind: "weapon",
      id: "shotgun",
      name: "Shotgun",
      cooldownMs: 1000,
      volleys: [
        {
          shots: [-15, 0, 15].map((a) => projShot({ angleOffsetDeg: a, damage: 8, speed: 400 })),
        },
      ],
    });
    buildPlayer(world, weapon);
    buildEnemy(world, 200, 0);

    const handler = vi.fn();
    bus.on("weaponFire", handler, "test");
    weaponSystem(world, renderer, bus, TICK_DT);
    expect(handler).toHaveBeenCalledTimes(3);
  });
});
