import type { Renderer } from "../../engine/Renderer";
import type { World } from "../../engine/World";
import type { EventBus } from "../../engine/events/EventBus";
import type { WeaponShot } from "../../content/schema/weapon";
import { EnemyTag, PlayerTag, Position, WeaponState, type PendingVolley } from "../components";
import { spawnShot } from "../factories";

const COOLDOWN_WHEN_NO_TARGET_MS = 100;

export function weaponSystem(
  world: World,
  renderer: Renderer,
  bus: EventBus,
  dt: number,
): void {
  const dtMs = dt * 1000;
  for (const [id, weapon] of world.query(WeaponState)) {
    if (!world.has(id, PlayerTag)) continue;

    weapon.clockMs += dtMs;
    weapon.cooldownLeft -= dtMs;

    if (weapon.cooldownLeft <= 0 && weapon.pendingVolleys.length === 0) {
      const pos = world.get(id, Position);
      if (!pos) continue;
      const target = findNearestEnemy(world, pos.x, pos.y);
      if (!target) {
        weapon.cooldownLeft = COOLDOWN_WHEN_NO_TARGET_MS;
        continue;
      }
      const dx = target.x - pos.x;
      const dy = target.y - pos.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      scheduleBurst(weapon, ux, uy);
      weapon.cooldownLeft = weapon.cooldownMs;
    }

    while (weapon.pendingVolleys.length > 0 && weapon.pendingVolleys[0]!.atMs <= weapon.clockMs) {
      const volley = weapon.pendingVolleys.shift()!;
      const pos = world.get(id, Position);
      if (!pos) continue;
      fireVolley(world, renderer, bus, id, weapon, volley, pos.x, pos.y);
    }
  }
}

function scheduleBurst(weapon: WeaponState, aimX: number, aimY: number): void {
  const burst = weapon.burst;
  const startMs = weapon.clockMs;
  if (burst.volleys && burst.volleys.length > 0) {
    let cursorMs = startMs;
    for (const volley of burst.volleys) {
      const at = volley.delayMs != null ? startMs + volley.delayMs : cursorMs;
      weapon.pendingVolleys.push({ atMs: at, shots: volley.shots, aimX, aimY });
      cursorMs = at + burst.volleyIntervalMs;
    }
    return;
  }
  // Metronome mode: repeat the default volley `volleyCount` times spaced by interval.
  // Default volley = single straight projectile (also the `burst === null` case is
  // pre-baked in burstConfigFromDef as a one-volley list, so this branch is reached
  // only when an author specified volleyCount + interval without a volleys list).
  const defaultShots: readonly WeaponShot[] = [
    { type: "projectile", angleOffsetDeg: 0, damageMultiplier: 1, speedMultiplier: 1 },
  ];
  for (let i = 0; i < burst.volleyCount; i++) {
    weapon.pendingVolleys.push({
      atMs: startMs + i * burst.volleyIntervalMs,
      shots: defaultShots,
      aimX,
      aimY,
    });
  }
}

function fireVolley(
  world: World,
  renderer: Renderer,
  bus: EventBus,
  ownerId: number,
  weapon: WeaponState,
  volley: PendingVolley,
  x: number,
  y: number,
): void {
  for (const shot of volley.shots) {
    spawnShot(world, renderer, ownerId, x, y, volley.aimX, volley.aimY, shot, weapon);
    bus.emit("weaponFire", {
      weaponId: weapon.id,
      ownerId,
      x,
      y,
      dx: volley.aimX,
      dy: volley.aimY,
    });
  }
}

function findNearestEnemy(world: World, x: number, y: number): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;
  for (const [id, pos] of world.query(Position)) {
    if (!world.has(id, EnemyTag)) continue;
    const dx = pos.x - x;
    const dy = pos.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = pos;
    }
  }
  return best;
}
