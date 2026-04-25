import type { World, EntityId } from "../../engine/World";
import type { SpatialGrid } from "../../engine/SpatialGrid";
import type { Renderer } from "../../engine/Renderer";
import type { Rng } from "../../engine/Rng";
import type { EventBus } from "../../engine/events/EventBus";
import type { ContentRegistry } from "../../content/registry/ContentRegistry";
import type { GameState } from "../GameState";
import {
  AreaDamage,
  ContactDamage,
  EnemySource,
  EnemyTag,
  FlashTint,
  Health,
  Hitbox,
  Lifetime,
  Position,
  Projectile,
  ProjectileTag,
  SpriteRef,
  XpDrop,
} from "../components";
import { spawnDamageNumber, spawnDeathParticles, spawnPickup } from "../factories";

const PLAYER_IFRAMES_MS = 500;

export interface CollisionDeps {
  world: World;
  grid: SpatialGrid;
  state: GameState;
  renderer: Renderer;
  registry: ContentRegistry;
  rng: Rng;
  bus: EventBus;
}

export function collisionSystem(deps: CollisionDeps, nowMs: number): void {
  const { world, grid } = deps;
  grid.clear();
  for (const [id, pos] of world.query(Position)) {
    if (world.has(id, EnemyTag)) grid.insert(id, pos.x, pos.y);
  }

  resolvePlayerVsEnemies(deps, nowMs);
  resolveProjectilesVsEnemies(deps, nowMs);
  resolveAreaVsEnemies(deps, nowMs);
}

function resolvePlayerVsEnemies(deps: CollisionDeps, nowMs: number): void {
  const { world, grid, state, bus } = deps;
  if (state.playerId === null) return;
  const pos = world.get(state.playerId, Position);
  const hb = world.get(state.playerId, Hitbox);
  const hp = world.get(state.playerId, Health);
  if (!pos || !hb || !hp) return;
  if (nowMs < hp.invulnUntil) return;

  const candidates: EntityId[] = [];
  grid.queryCircle(pos.x, pos.y, hb.radius + 32, candidates);
  for (const eid of candidates) {
    if (!world.isAlive(eid)) continue;
    const epos = world.get(eid, Position);
    const ehb = world.get(eid, Hitbox);
    const dmgC = world.get(eid, ContactDamage);
    if (!epos || !ehb || !dmgC) continue;
    const r = hb.radius + ehb.radius;
    const dx = epos.x - pos.x;
    const dy = epos.y - pos.y;
    if (dx * dx + dy * dy > r * r) continue;
    hp.current = Math.max(0, hp.current - dmgC.damage);
    hp.invulnUntil = nowMs + PLAYER_IFRAMES_MS;
    const flash = world.get(state.playerId, FlashTint);
    if (flash) {
      flash.color = 0xef476f;
      flash.until = nowMs + 120;
    }
    state.shakeAmount = Math.min(14, state.shakeAmount + 8);
    bus.emit("playerHit", { damage: dmgC.damage, hpLeft: hp.current });
    if (hp.current <= 0) {
      state.gameOver = true;
    }
    return;
  }
}

function resolveProjectilesVsEnemies(deps: CollisionDeps, nowMs: number): void {
  const { world, grid, state, renderer, registry, rng, bus } = deps;
  const candidates: EntityId[] = [];
  for (const [pid, ppos, proj] of world.query(Position, Projectile)) {
    if (!world.has(pid, ProjectileTag)) continue;
    candidates.length = 0;
    grid.queryCircle(ppos.x, ppos.y, proj.radius + 48, candidates);
    for (const eid of candidates) {
      if (!world.isAlive(eid)) continue;
      if (proj.hit.has(eid)) continue;
      const epos = world.get(eid, Position);
      const ehb = world.get(eid, Hitbox);
      const ehp = world.get(eid, Health);
      if (!epos || !ehb || !ehp) continue;
      const r = proj.radius + ehb.radius;
      const dx = epos.x - ppos.x;
      const dy = epos.y - ppos.y;
      if (dx * dx + dy * dy > r * r) continue;

      ehp.current -= proj.damage;
      proj.hit.add(eid);
      spawnDamageNumber(world, renderer, epos.x, epos.y - ehb.radius, Math.round(proj.damage));
      const eflash = world.get(eid, FlashTint);
      if (eflash) {
        eflash.color = 0xffffff;
        eflash.until = nowMs + 80;
      }
      if (ehp.current <= 0) {
        const enemySource = world.get(eid, EnemySource);
        const enemyId = enemySource?.id ?? "";
        spawnDeathParticles(world, renderer, epos.x, epos.y, eflash?.base ?? 0xef476f, rng);
        killEnemy(world, eid, state, registry, renderer, rng);
        bus.emit("enemyDeath", { enemyId, entityId: eid, x: epos.x, y: epos.y });
      }
      if (proj.pierceLeft <= 0) {
        destroyEntityWithDisplay(world, pid);
        break;
      }
      proj.pierceLeft -= 1;
    }
  }
}

function killEnemy(
  world: World,
  id: EntityId,
  state: GameState,
  registry: ContentRegistry,
  renderer: Renderer,
  rng: Rng,
): void {
  dropXpFor(world, renderer, registry, rng, id);
  destroyEntityWithDisplay(world, id);
  state.kills += 1;
}

function dropXpFor(
  world: World,
  renderer: Renderer,
  registry: ContentRegistry,
  rng: Rng,
  enemyId: EntityId,
): void {
  const drop = world.get(enemyId, XpDrop);
  const pos = world.get(enemyId, Position);
  if (!drop || drop.amount <= 0 || !pos) return;
  const pickupId = drop.amount >= 4 ? "xp_medium" : "xp_small";
  const def = registry.find("pickup", pickupId);
  if (!def) return;
  const jitter = 6;
  spawnPickup(world, renderer, pos.x + rng.range(-jitter, jitter), pos.y + rng.range(-jitter, jitter), def);
}

function resolveAreaVsEnemies(deps: CollisionDeps, nowMs: number): void {
  const { world, grid, state, renderer, registry, rng, bus } = deps;
  const candidates: EntityId[] = [];
  for (const [aid, apos, area] of world.query(Position, AreaDamage)) {
    candidates.length = 0;
    grid.queryCircle(apos.x, apos.y, area.radius + 32, candidates);
    for (const eid of candidates) {
      if (!world.isAlive(eid)) continue;
      if (area.hit.has(eid)) continue;
      const epos = world.get(eid, Position);
      const ehb = world.get(eid, Hitbox);
      const ehp = world.get(eid, Health);
      if (!epos || !ehb || !ehp) continue;
      const r = area.radius + ehb.radius;
      const dx = epos.x - apos.x;
      const dy = epos.y - apos.y;
      if (dx * dx + dy * dy > r * r) continue;

      ehp.current -= area.damage;
      area.hit.add(eid);
      spawnDamageNumber(world, renderer, epos.x, epos.y - ehb.radius, Math.round(area.damage));
      const eflash = world.get(eid, FlashTint);
      if (eflash) {
        eflash.color = 0xffffff;
        eflash.until = nowMs + 80;
      }
      if (ehp.current <= 0) {
        const enemySource = world.get(eid, EnemySource);
        const enemyId = enemySource?.id ?? "";
        spawnDeathParticles(world, renderer, epos.x, epos.y, eflash?.base ?? 0xef476f, rng);
        killEnemy(world, eid, state, registry, renderer, rng);
        bus.emit("enemyDeath", { enemyId, entityId: eid, x: epos.x, y: epos.y });
      }
    }
    if (area.instantaneous) {
      const lifetime = world.get(aid, Lifetime);
      if (lifetime) lifetime.remainingMs = 0;
    }
  }
}

export function destroyEntityWithDisplay(world: World, id: EntityId): void {
  const sprite = world.get(id, SpriteRef);
  if (sprite) {
    sprite.display.parent?.removeChild(sprite.display);
    sprite.display.destroy();
  }
  world.destroyEntity(id);
}
