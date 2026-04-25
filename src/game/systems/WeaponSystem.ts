import type { Renderer } from "../../engine/Renderer";
import type { World } from "../../engine/World";
import type { EventBus } from "../../engine/events/EventBus";
import { EnemyTag, PlayerTag, Position, WeaponState, type PendingShot } from "../components";
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

    if (weapon.cooldownLeft <= 0 && weapon.pendingShots.length === 0) {
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
      scheduleVolleys(weapon, dx / len, dy / len);
      weapon.cooldownLeft = weapon.cooldownMs;
    }

    while (weapon.pendingShots.length > 0 && weapon.pendingShots[0]!.atMs <= weapon.clockMs) {
      const pending = weapon.pendingShots.shift()!;
      const pos = world.get(id, Position);
      if (!pos) continue;
      fireShots(world, renderer, bus, id, weapon.id, pending, pos.x, pos.y);
    }
  }
}

function scheduleVolleys(weapon: WeaponState, aimX: number, aimY: number): void {
  const startMs = weapon.clockMs;
  for (const volley of weapon.volleys) {
    const volleyOriginMs = startMs + volley.startMs;
    for (let i = 0; i < volley.projectileCount; i++) {
      weapon.pendingShots.push({
        atMs: volleyOriginMs + i * volley.projectileIntervalMs,
        shots: volley.shots,
        aimX,
        aimY,
      });
    }
  }
  // Keep the queue ordered by time so the drain loop fires shots in temporal order
  // even when volleys are authored out of sequence.
  weapon.pendingShots.sort((a, b) => a.atMs - b.atMs);
}

function fireShots(
  world: World,
  renderer: Renderer,
  bus: EventBus,
  ownerId: number,
  weaponId: string,
  pending: PendingShot,
  x: number,
  y: number,
): void {
  for (const shot of pending.shots) {
    spawnShot(world, renderer, ownerId, x, y, pending.aimX, pending.aimY, shot);
    bus.emit("weaponFire", {
      weaponId,
      ownerId,
      x,
      y,
      dx: pending.aimX,
      dy: pending.aimY,
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
