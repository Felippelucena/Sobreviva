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

// Minimal renderer stub. Pixi Graphics constructs in node fine, only display matters.
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

describe("WeaponSystem", () => {
  let world: World;
  let renderer: ReturnType<typeof fakeRenderer>;
  let bus: EventBus;

  beforeEach(() => {
    world = new World();
    renderer = fakeRenderer();
    bus = new EventBus();
  });

  it("legacy weapon (no burst) fires once per cooldown", () => {
    const weapon = WeaponDef.parse({
      kind: "weapon",
      id: "spark",
      name: "Spark",
      damage: 10,
      cooldownMs: 600,
      projectile: { speed: 360, radius: 4, lifetimeMs: 800 },
    });
    buildPlayer(world, weapon);
    buildEnemy(world, 200, 0);

    weaponSystem(world, renderer, bus, TICK_DT);
    expect(countProjectiles(world)).toBe(1);

    // Within cooldown — no new projectiles.
    for (let i = 0; i < 30; i++) weaponSystem(world, renderer, bus, TICK_DT);
    expect(countProjectiles(world)).toBe(1);

    // After cooldown — one more projectile.
    for (let i = 0; i < 40; i++) weaponSystem(world, renderer, bus, TICK_DT);
    expect(countProjectiles(world)).toBe(2);
  });

  it("low cooldown without burst still fires at most once per tick", () => {
    const weapon = WeaponDef.parse({
      kind: "weapon",
      id: "fast",
      name: "Fast",
      damage: 1,
      cooldownMs: 5,
      projectile: { speed: 300, radius: 3, lifetimeMs: 200 },
    });
    buildPlayer(world, weapon);
    buildEnemy(world, 200, 0);

    for (let i = 0; i < 10; i++) weaponSystem(world, renderer, bus, TICK_DT);
    // 10 ticks → up to 10 projectiles. Critical: NOT more than 10.
    expect(countProjectiles(world)).toBeLessThanOrEqual(10);
    expect(countProjectiles(world)).toBeGreaterThanOrEqual(8);
  });

  it("burst with 6 volleys × 50ms enqueues all and fires within 250ms", () => {
    const weapon = WeaponDef.parse({
      kind: "weapon",
      id: "smg",
      name: "SMG",
      damage: 4,
      cooldownMs: 1000,
      projectile: { speed: 500, radius: 3, lifetimeMs: 600 },
      burst: { volleyCount: 6, volleyIntervalMs: 50 },
    });
    const playerId = buildPlayer(world, weapon);
    buildEnemy(world, 200, 0);

    weaponSystem(world, renderer, bus, TICK_DT);
    // First tick fires volley 0 (atMs = clockMs = 16.66).
    expect(countProjectiles(world)).toBe(1);
    const ws = world.get(playerId, WeaponState)!;
    expect(ws.pendingVolleys.length).toBe(5);

    // Advance ~250ms total → all 6 volleys should have fired.
    for (let i = 0; i < 16; i++) weaponSystem(world, renderer, bus, TICK_DT);
    expect(countProjectiles(world)).toBe(6);
    expect(ws.pendingVolleys.length).toBe(0);
  });

  it("explicit volley with 3 angled shots fires 3 projectiles in one tick", () => {
    const weapon = WeaponDef.parse({
      kind: "weapon",
      id: "shotgun",
      name: "Shotgun",
      damage: 8,
      cooldownMs: 1000,
      projectile: { speed: 400, radius: 4, lifetimeMs: 600 },
      burst: {
        volleyCount: 1,
        volleys: [
          {
            shots: [
              { type: "projectile", angleOffsetDeg: -15 },
              { type: "projectile", angleOffsetDeg: 0 },
              { type: "projectile", angleOffsetDeg: 15 },
            ],
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
      damage: 12,
      cooldownMs: 1500,
      projectile: { speed: 1, radius: 1, lifetimeMs: 1 },
      burst: {
        volleyCount: 1,
        volleys: [{ shots: [{ type: "area", radius: 80 }] }],
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
      damage: 8,
      cooldownMs: 1000,
      projectile: { speed: 400, radius: 4, lifetimeMs: 600 },
      burst: {
        volleyCount: 1,
        volleys: [
          {
            shots: [
              { type: "projectile", angleOffsetDeg: -15 },
              { type: "projectile", angleOffsetDeg: 0 },
              { type: "projectile", angleOffsetDeg: 15 },
            ],
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
