import type { Container, Graphics } from "pixi.js";
import { defineComponent, type EntityId } from "../../engine/World";
import type { WeaponShot } from "../../content/schema/weapon";

export interface Position {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
}

export interface Velocity {
  vx: number;
  vy: number;
  speed: number;
}

export interface SpriteRef {
  display: Container;
}

export interface Health {
  current: number;
  max: number;
  invulnUntil: number;
}

export interface Hitbox {
  radius: number;
}

export interface ContactDamage {
  damage: number;
}

export interface EnemyAI {
  targetId: EntityId | null;
}

export interface EnemySource {
  id: string;
}

export interface PendingShot {
  atMs: number;
  shots: readonly WeaponShot[];
  aimX: number;
  aimY: number;
}

export interface WeaponVolleyState {
  startMs: number;
  projectileCount: number;
  projectileIntervalMs: number;
  shots: WeaponShot[];
}

export interface WeaponState {
  id: string;
  cooldownLeft: number;
  cooldownMs: number;
  // Mutable so runtime upgrades can buff shots in-place.
  volleys: WeaponVolleyState[];
  clockMs: number;
  pendingShots: PendingShot[];
}

export interface Projectile {
  damage: number;
  pierceLeft: number;
  ownerId: EntityId;
  radius: number;
  hit: Set<EntityId>;
}

export interface AreaDamage {
  damage: number;
  ownerId: EntityId;
  radius: number;
  hit: Set<EntityId>;
  /** When true, applies dano once and self-destructs in same tick. */
  instantaneous: boolean;
}

export interface Lifetime {
  remainingMs: number;
}

export interface FlashTint {
  until: number;
  color: number;
  base: number;
  graphics: Graphics;
}

export interface FadeOverLife {
  durationMs: number;
}

export interface XpDrop {
  amount: number;
}

export interface Pickup {
  effect: "xp" | "heal" | "magnet";
  value: number;
  magnetizable: boolean;
  state: "idle" | "magnet";
}

export interface PlayerProgress {
  level: number;
  xp: number;
  xpForNext: number;
  pickupRadius: number;
  pendingLevelUps: number;
}

export const Position = defineComponent<Position>("Position");
export const Velocity = defineComponent<Velocity>("Velocity");
export const SpriteRef = defineComponent<SpriteRef>("SpriteRef");
export const Health = defineComponent<Health>("Health");
export const Hitbox = defineComponent<Hitbox>("Hitbox");
export const ContactDamage = defineComponent<ContactDamage>("ContactDamage");
export const EnemyAI = defineComponent<EnemyAI>("EnemyAI");
export const EnemySource = defineComponent<EnemySource>("EnemySource");
export const WeaponState = defineComponent<WeaponState>("WeaponState");
export const Projectile = defineComponent<Projectile>("Projectile");
export const AreaDamage = defineComponent<AreaDamage>("AreaDamage");
export const Lifetime = defineComponent<Lifetime>("Lifetime");
export const FlashTint = defineComponent<FlashTint>("FlashTint");
export const FadeOverLife = defineComponent<FadeOverLife>("FadeOverLife");
export const XpDrop = defineComponent<XpDrop>("XpDrop");
export const Pickup = defineComponent<Pickup>("Pickup");
export const PlayerProgress = defineComponent<PlayerProgress>("PlayerProgress");

export const PlayerTag = defineComponent<true>("PlayerTag");
export const EnemyTag = defineComponent<true>("EnemyTag");
export const ProjectileTag = defineComponent<true>("ProjectileTag");
export const PickupTag = defineComponent<true>("PickupTag");
