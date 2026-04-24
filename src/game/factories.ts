import { Graphics, Text } from "pixi.js";
import type { Renderer } from "../engine/Renderer";
import type { Rng } from "../engine/Rng";
import type { EntityId, World } from "../engine/World";
import type {
  CharacterDef,
  EnemyDef,
  PickupDef,
  WeaponDef,
} from "../content/schema";
import {
  ContactDamage,
  EnemyAI,
  EnemySource,
  EnemyTag,
  FadeOverLife,
  FlashTint,
  Health,
  Hitbox,
  Lifetime,
  Pickup,
  PickupTag,
  PlayerProgress,
  PlayerTag,
  Position,
  Projectile,
  ProjectileTag,
  SpriteRef,
  Velocity,
  WeaponState,
  XpDrop,
} from "./components";
import { xpForLevel } from "./progression/levels";

export function spawnPlayerFromCharacter(
  world: World,
  renderer: Renderer,
  x: number,
  y: number,
  character: CharacterDef,
  weapon: WeaponDef,
): EntityId {
  const id = world.createEntity();
  const g = new Graphics()
    .circle(0, 0, character.sprite.radius)
    .fill(character.sprite.color)
    .stroke({ color: 0xffffff, width: 2, alpha: 0.4 });
  g.position.set(x, y);
  renderer.world.addChild(g);

  world.add(id, Position, { x, y, prevX: x, prevY: y });
  world.add(id, Velocity, { vx: 0, vy: 0, speed: character.baseSpeed });
  world.add(id, SpriteRef, { display: g });
  world.add(id, Health, { current: character.baseHp, max: character.baseHp, invulnUntil: 0 });
  world.add(id, Hitbox, { radius: character.sprite.radius });
  world.add(id, PlayerTag, true);
  world.add(id, FlashTint, { until: 0, color: 0xffffff, base: character.sprite.color, graphics: g });
  world.add(id, WeaponState, weaponStateFromDef(weapon));
  world.add(id, PlayerProgress, {
    level: 1,
    xp: 0,
    xpForNext: xpForLevel(1),
    pickupRadius: character.pickupRadius,
    pendingLevelUps: 0,
  });
  return id;
}

export function weaponStateFromDef(weapon: WeaponDef): WeaponState {
  return {
    id: weapon.id,
    cooldownLeft: 0,
    cooldownMs: weapon.cooldownMs,
    damage: weapon.damage,
    projectileSpeed: weapon.projectile.speed,
    projectileLifetimeMs: weapon.projectile.lifetimeMs,
    projectileRadius: weapon.projectile.radius,
    projectileColor: weapon.projectile.color,
    pierce: weapon.projectile.pierce,
  };
}

export function spawnEnemy(
  world: World,
  renderer: Renderer,
  x: number,
  y: number,
  def: EnemyDef,
): EntityId {
  const id = world.createEntity();
  const g = new Graphics().circle(0, 0, def.sprite.radius).fill(def.sprite.color);
  g.position.set(x, y);
  renderer.world.addChild(g);

  world.add(id, Position, { x, y, prevX: x, prevY: y });
  world.add(id, Velocity, { vx: 0, vy: 0, speed: def.speed });
  world.add(id, SpriteRef, { display: g });
  world.add(id, Health, { current: def.hp, max: def.hp, invulnUntil: 0 });
  world.add(id, Hitbox, { radius: def.hitbox.radius });
  world.add(id, ContactDamage, { damage: def.contactDamage });
  world.add(id, EnemyAI, { targetId: null });
  world.add(id, EnemyTag, true);
  world.add(id, EnemySource, { id: def.id });
  world.add(id, FlashTint, { until: 0, color: 0xffffff, base: def.sprite.color, graphics: g });
  world.add(id, XpDrop, { amount: def.xpDrop });
  return id;
}

export function spawnProjectile(
  world: World,
  renderer: Renderer,
  owner: EntityId,
  x: number,
  y: number,
  vx: number,
  vy: number,
  state: WeaponState,
): EntityId {
  const id = world.createEntity();
  const g = new Graphics().circle(0, 0, state.projectileRadius).fill(state.projectileColor);
  g.position.set(x, y);
  renderer.world.addChild(g);

  world.add(id, Position, { x, y, prevX: x, prevY: y });
  world.add(id, Velocity, { vx, vy, speed: Math.hypot(vx, vy) });
  world.add(id, SpriteRef, { display: g });
  world.add(id, Hitbox, { radius: state.projectileRadius });
  world.add(id, Lifetime, { remainingMs: state.projectileLifetimeMs });
  world.add(id, ProjectileTag, true);
  world.add(id, Projectile, {
    damage: state.damage,
    pierceLeft: state.pierce,
    ownerId: owner,
    radius: state.projectileRadius,
    hit: new Set(),
  });
  return id;
}

export function spawnPickup(
  world: World,
  renderer: Renderer,
  x: number,
  y: number,
  def: PickupDef,
): EntityId {
  const id = world.createEntity();
  const g = new Graphics().circle(0, 0, def.sprite.radius).fill(def.sprite.color);
  g.position.set(x, y);
  renderer.world.addChild(g);

  world.add(id, Position, { x, y, prevX: x, prevY: y });
  world.add(id, Velocity, { vx: 0, vy: 0, speed: 0 });
  world.add(id, SpriteRef, { display: g });
  world.add(id, Hitbox, { radius: def.sprite.radius });
  world.add(id, PickupTag, true);
  world.add(id, Pickup, {
    effect: def.effect,
    value: def.value,
    magnetizable: def.magnetizable,
    state: "idle",
  });
  return id;
}

const DAMAGE_NUMBER_MS = 520;

export function spawnDamageNumber(
  world: World,
  renderer: Renderer,
  x: number,
  y: number,
  value: number,
): EntityId {
  const id = world.createEntity();
  const text = new Text({
    text: String(value),
    style: {
      fill: 0xffe082,
      fontSize: 13,
      fontWeight: "700",
      stroke: { color: 0x000000, width: 2 },
    },
  });
  text.anchor.set(0.5);
  text.position.set(x, y);
  renderer.world.addChild(text);

  world.add(id, Position, { x, y, prevX: x, prevY: y });
  world.add(id, Velocity, { vx: 0, vy: -55, speed: 0 });
  world.add(id, SpriteRef, { display: text });
  world.add(id, Lifetime, { remainingMs: DAMAGE_NUMBER_MS });
  world.add(id, FadeOverLife, { durationMs: DAMAGE_NUMBER_MS });
  return id;
}

const PARTICLE_COUNT = 6;
const PARTICLE_MS = 360;

export function spawnDeathParticles(
  world: World,
  renderer: Renderer,
  x: number,
  y: number,
  color: number,
  rng: Rng,
): void {
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const id = world.createEntity();
    const g = new Graphics().circle(0, 0, rng.range(1.5, 3)).fill(color);
    g.position.set(x, y);
    renderer.world.addChild(g);
    const angle = rng.range(0, Math.PI * 2);
    const speed = rng.range(90, 180);
    world.add(id, Position, { x, y, prevX: x, prevY: y });
    world.add(id, Velocity, { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, speed: 0 });
    world.add(id, SpriteRef, { display: g });
    world.add(id, Lifetime, { remainingMs: PARTICLE_MS });
    world.add(id, FadeOverLife, { durationMs: PARTICLE_MS });
  }
}
