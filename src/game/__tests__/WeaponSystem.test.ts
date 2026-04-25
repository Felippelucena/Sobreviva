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
    burst: {
      volleyCount: 1,
      volleyIntervalMs: 0,
      volleys: [
        {
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
    },
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

  it("low cooldown still fires at most once per tick (60Hz floor without burst)", () => {
    const weapon = straightWeapon({ id: "fast", cooldownMs: 5 });
    buildPlayer(world, weapon);
    buildEnemy(world, 200, 0);

    for (let i = 0; i < 10; i++) weaponSystem(world, renderer, bus, TICK_DT);
    expect(countProjectiles(world)).toBeLessThanOrEqual(10);
    expect(countProjectiles(world)).toBeGreaterThanOrEqual(8);
  });

  it("burst with 6 reps × 50ms interval enqueues 6 volleys and fires within 250ms", () => {
    const weapon = WeaponDef.parse({
      kind: "weapon",
      id: "smg",
      name: "SMG",
      cooldownMs: 1000,
      burst: {
        volleyCount: 6,
        volleyIntervalMs: 50,
        volleys: [
          {
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
      },
    });
    const playerId = buildPlayer(world, weapon);
    buildEnemy(world, 200, 0);

    weaponSystem(world, renderer, bus, TICK_DT);
    expect(countProjectiles(world)).toBe(1);
    const ws = world.get(playerId, WeaponState)!;
    expect(ws.pendingVolleys.length).toBe(5);

    for (let i = 0; i < 16; i++) weaponSystem(world, renderer, bus, TICK_DT);
    expect(countProjectiles(world)).toBe(6);
    expect(ws.pendingVolleys.length).toBe(0);
  });

  it("explicit volley with 3 angled shots fires 3 projectiles in one tick", () => {
    const weapon = WeaponDef.parse({
      kind: "weapon",
      id: "shotgun",
      name: "Shotgun",
      cooldownMs: 1000,
      burst: {
        volleyCount: 1,
        volleyIntervalMs: 0,
        volleys: [
          {
            shots: [-15, 0, 15].map((a) => ({
              type: "projectile" as const,
              angleOffsetDeg: a,
              damage: 8,
              projectile: { speed: 400, radius: 4, lifetimeMs: 600 },
            })),
          },
        ],
      },
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

  it("area shot creates an AreaDamage entity, no projectile", () => {
    const weapon = WeaponDef.parse({
      kind: "weapon",
      id: "nova",
      name: "Nova",
      cooldownMs: 1500,
      burst: {
        volleyCount: 1,
        volleyIntervalMs: 0,
        volleys: [{ shots: [{ type: "area", damage: 22, radius: 80 }] }],
      },
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
      burst: {
        volleyCount: 1,
        volleyIntervalMs: 0,
        volleys: [
          {
            shots: [-15, 0, 15].map((a) => ({
              type: "projectile" as const,
              angleOffsetDeg: a,
              damage: 8,
              projectile: { speed: 400, radius: 4, lifetimeMs: 600 },
            })),
          },
        ],
      },
    });
    buildPlayer(world, weapon);
    buildEnemy(world, 200, 0);

    const handler = vi.fn();
    bus.on("weaponFire", handler, "test");
    weaponSystem(world, renderer, bus, TICK_DT);
    expect(handler).toHaveBeenCalledTimes(3);
  });
});
