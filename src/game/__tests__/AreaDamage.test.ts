import { describe, expect, it, beforeEach } from "vitest";
import { Container } from "pixi.js";
import { World, type EntityId } from "../../engine/World";
import { SpatialGrid } from "../../engine/SpatialGrid";
import { Rng } from "../../engine/Rng";
import { EventBus } from "../../engine/events/EventBus";
import { GameState } from "../GameState";
import { WeaponDef } from "../../content/schema/weapon";
import { weaponSystem } from "../systems/WeaponSystem";
import { collisionSystem } from "../systems/CollisionSystem";
import { lifetimeSystem } from "../systems/LifetimeSystem";
import {
  EnemyTag,
  FlashTint,
  Health,
  Hitbox,
  PlayerTag,
  Position,
  WeaponState,
  EnemySource,
  XpDrop,
} from "../components";
import { weaponStateFromDef } from "../factories";

function fakeRenderer() {
  const world = new Container();
  return { world } as unknown as import("../../engine/Renderer").Renderer;
}

const fakeRegistry = {
  find: () => undefined,
  get: () => {
    throw new Error("registry.get not expected in this test");
  },
  list: () => [],
  packOrder: [],
} as unknown as import("../../content/registry/ContentRegistry").ContentRegistry;

const TICK_DT = 1 / 60;

function buildPlayer(world: World, weapon: WeaponDef): EntityId {
  const id = world.createEntity();
  world.add(id, PlayerTag, true);
  world.add(id, Position, { x: 0, y: 0, prevX: 0, prevY: 0 });
  world.add(id, WeaponState, weaponStateFromDef(weapon));
  return id;
}

function buildEnemy(world: World, x: number, y: number, hp: number): EntityId {
  const id = world.createEntity();
  world.add(id, EnemyTag, true);
  world.add(id, Position, { x, y, prevX: x, prevY: y });
  world.add(id, Hitbox, { radius: 8 });
  world.add(id, Health, { current: hp, max: hp, invulnUntil: 0 });
  world.add(id, EnemySource, { id: "test_enemy" });
  world.add(id, XpDrop, { amount: 0 });
  // Minimal flash tint so the damage handler doesn't crash on lookup.
  world.add(id, FlashTint, {
    until: 0,
    color: 0xffffff,
    base: 0xef476f,
    graphics: null as unknown as import("pixi.js").Graphics,
  });
  return id;
}

function pump(
  world: World,
  renderer: ReturnType<typeof fakeRenderer>,
  state: GameState,
  grid: SpatialGrid,
  rng: Rng,
  bus: EventBus,
  ticks: number,
): void {
  const deps = { world, grid, state, renderer, registry: fakeRegistry, rng, bus };
  for (let i = 0; i < ticks; i++) {
    collisionSystem(deps, performance.now());
    weaponSystem(world, renderer, bus, TICK_DT);
    lifetimeSystem(world, TICK_DT);
    world.flushDestroyed();
  }
}

describe("AOE instantaneous", () => {
  let world: World;
  let renderer: ReturnType<typeof fakeRenderer>;
  let state: GameState;
  let grid: SpatialGrid;
  let rng: Rng;
  let bus: EventBus;

  beforeEach(() => {
    world = new World();
    renderer = fakeRenderer();
    state = new GameState();
    grid = new SpatialGrid(64);
    rng = new Rng(1);
    bus = new EventBus();
  });

  it("instantaneous AOE applies damage to enemies in radius", () => {
    const weapon = WeaponDef.parse({
      kind: "weapon",
      id: "nova",
      name: "Nova",
      cooldownMs: 1500,
      shots: [
        {
          type: "area",
          startMs: 0,
          projectileCount: 1,
          projectileIntervalMs: 0,
          damage: 10,
          radius: 80,
        },
      ],
    });
    const playerId = buildPlayer(world, weapon);
    state.playerId = playerId;
    const enemyId = buildEnemy(world, 50, 0, 100);

    // Need at least 3 ticks to cover: tick1 schedule+spawn AOE, tick2 collision applies damage,
    // tick3 LifetimeSystem reaps the AOE.
    pump(world, renderer, state, grid, rng, bus, 3);

    const hp = world.get(enemyId, Health);
    expect(hp?.current).toBe(90);
  });

  it("instantaneous AOE outside radius leaves enemies untouched", () => {
    const weapon = WeaponDef.parse({
      kind: "weapon",
      id: "nova",
      name: "Nova",
      cooldownMs: 1500,
      shots: [
        {
          type: "area",
          startMs: 0,
          projectileCount: 1,
          projectileIntervalMs: 0,
          damage: 10,
          radius: 30,
        },
      ],
    });
    const playerId = buildPlayer(world, weapon);
    state.playerId = playerId;
    const enemyId = buildEnemy(world, 200, 0, 50);

    pump(world, renderer, state, grid, rng, bus, 3);

    const hp = world.get(enemyId, Health);
    expect(hp?.current).toBe(50);
  });

  it("lifetime-bound AOE damages each enemy once across multiple ticks", () => {
    const weapon = WeaponDef.parse({
      kind: "weapon",
      id: "puddle",
      name: "Puddle",
      cooldownMs: 5000,
      shots: [
        {
          type: "area",
          startMs: 0,
          projectileCount: 1,
          projectileIntervalMs: 0,
          damage: 5,
          radius: 80,
          lifetimeMs: 200,
        },
      ],
    });
    const playerId = buildPlayer(world, weapon);
    state.playerId = playerId;
    const enemyId = buildEnemy(world, 50, 0, 100);

    // Many ticks during the AOE lifetime — the dedup `hit` set must prevent double damage.
    pump(world, renderer, state, grid, rng, bus, 20);

    const hp = world.get(enemyId, Health);
    expect(hp?.current).toBe(95);
  });
});

describe("Upgrade applied mid-burst", () => {
  it("buffs queued shots in-flight (current behavior)", () => {
    const world = new World();
    const renderer = fakeRenderer();
    const bus = new EventBus();
    const weapon = WeaponDef.parse({
      kind: "weapon",
      id: "smg",
      name: "SMG",
      cooldownMs: 5000,
      shots: [
        {
          type: "projectile",
          startMs: 0,
          projectileCount: 6,
          projectileIntervalMs: 50,
          angleOffsetDeg: 0,
          damage: 10,
          projectile: { speed: 500, radius: 3, lifetimeMs: 600 },
        },
      ],
    });
    const playerId = world.createEntity();
    world.add(playerId, PlayerTag, true);
    world.add(playerId, Position, { x: 0, y: 0, prevX: 0, prevY: 0 });
    world.add(playerId, WeaponState, weaponStateFromDef(weapon));

    // Build a target so the burst gets scheduled.
    const enemyId = world.createEntity();
    world.add(enemyId, EnemyTag, true);
    world.add(enemyId, Position, { x: 200, y: 0, prevX: 200, prevY: 0 });
    world.add(enemyId, Hitbox, { radius: 8 });

    weaponSystem(world, renderer, bus, TICK_DT);
    const ws = world.get(playerId, WeaponState)!;
    expect(ws.pendingShots.length).toBe(5);

    // Buff damage on the underlying shot. pendingShots[].shot is by reference,
    // so every queued shot picks up the buff.
    for (const shot of ws.shots) {
      shot.damage *= 2;
    }

    // Ensure the same reference is shared between weapon.shots and pendingShots.
    expect(ws.pendingShots[0]!.shot).toBe(ws.shots[0]);
    if (ws.pendingShots[0]!.shot.type === "projectile") {
      expect(ws.pendingShots[0]!.shot.damage).toBe(20);
    }
  });
});
