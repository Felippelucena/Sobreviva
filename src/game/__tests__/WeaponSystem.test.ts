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

function straightWeapon(opts: { id?: string; cooldownMs?: number; damage?: number; projectile?: Partial<{ speed: number; radius: number; lifetimeMs: number; pierce: number; color: number }> } = {}): WeaponDef {
  return WeaponDef.parse({
    kind: "weapon",
    id: opts.id ?? "test",
    name: "Test",
    cooldownMs: opts.cooldownMs ?? 600,
    volleys: [
      {
        startMs: 0,
        projectileCount: 1,
        projectileIntervalMs: 0,
        shots: [
          {
            type: "projectile",
            angleOffsetDeg: 0,
            damage: opts.damage ?? 10,
            projectile: {
              speed: opts.projectile?.speed ?? 360,
              radius: opts.projectile?.radius ?? 4,
              lifetimeMs: opts.projectile?.lifetimeMs ?? 800,
              ...(opts.projectile?.pierce !== undefined ? { pierce: opts.projectile.pierce } : {}),
              ...(opts.projectile?.color !== undefined ? { color: opts.projectile.color } : {}),
            },
          },
        ],
      },
    ],
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

  it("projectileCount=6 with interval=50ms enqueues 6 shots and fires within 250ms", () => {
    const weapon = WeaponDef.parse({
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

  it("staggered volleys fire according to startMs", () => {
    const projShot = {
      type: "projectile" as const,
      angleOffsetDeg: 0,
      damage: 5,
      projectile: { speed: 300, radius: 3, lifetimeMs: 400 },
    };
    const weapon = WeaponDef.parse({
      kind: "weapon",
      id: "stagger",
      name: "Stagger",
      cooldownMs: 1500,
      volleys: [
        { startMs: 0, projectileCount: 1, projectileIntervalMs: 0, shots: [projShot] },
        { startMs: 0, projectileCount: 1, projectileIntervalMs: 0, shots: [projShot] },
        { startMs: 200, projectileCount: 1, projectileIntervalMs: 0, shots: [projShot] },
      ],
    });
    const playerId = buildPlayer(world, weapon);
    buildEnemy(world, 200, 0);

    weaponSystem(world, renderer, bus, TICK_DT);
    // First tick: clockMs=16.67. Both startMs=0 volleys should fire (atMs=16.67 ≤ 16.67).
    expect(countProjectiles(world)).toBe(2);
    const ws = world.get(playerId, WeaponState)!;
    expect(ws.pendingShots.length).toBe(1);

    // Advance until ~220ms; the startMs=200 volley should now have fired.
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
          startMs: 0,
          projectileCount: 1,
          projectileIntervalMs: 0,
          shots: [{ type: "area", damage: 22, radius: 80 }],
        },
      ],
    });
    buildPlayer(world, weapon);
    buildEnemy(world, 50, 0);

    weaponSystem(world, renderer, bus, TICK_DT);
    expect(countProjectiles(world)).toBe(0);
    expect(countAoe(world)).toBe(1);
  });

  it("emits weaponFire event per shot", () => {
    const weapon = WeaponDef.parse({
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
    buildPlayer(world, weapon);
    buildEnemy(world, 200, 0);

    const handler = vi.fn();
    bus.on("weaponFire", handler, "test");
    weaponSystem(world, renderer, bus, TICK_DT);
    expect(handler).toHaveBeenCalledTimes(3);
  });
});
