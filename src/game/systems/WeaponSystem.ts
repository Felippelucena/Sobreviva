import type { Renderer } from "../../engine/Renderer";
import type { World } from "../../engine/World";
import type { EventBus } from "../../engine/events/EventBus";
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
      scheduleBurst(weapon, dx / len, dy / len);
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
  let cursorMs = startMs;
  // Outer loop: volleyCount tells how many times to repeat the volleys[] sequence.
  for (let rep = 0; rep < burst.volleyCount; rep++) {
    for (const volley of burst.volleys) {
      const at = volley.delayMs != null ? cursorMs + volley.delayMs : cursorMs;
      weapon.pendingVolleys.push({ atMs: at, shots: volley.shots, aimX, aimY });
      cursorMs = at + burst.volleyIntervalMs;
    }
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
    spawnShot(world, renderer, ownerId, x, y, volley.aimX, volley.aimY, shot);
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
