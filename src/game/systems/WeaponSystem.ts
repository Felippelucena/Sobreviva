import type { Renderer } from "../../engine/Renderer";
import type { World } from "../../engine/World";
import type { EventBus } from "../../engine/events/EventBus";
import { EnemyTag, PlayerTag, Position, WeaponState } from "../components";
import { spawnProjectile } from "../factories";

export function weaponSystem(
  world: World,
  renderer: Renderer,
  bus: EventBus,
  dt: number,
): void {
  for (const [id, weapon] of world.query(WeaponState)) {
    if (!world.has(id, PlayerTag)) continue;
    weapon.cooldownLeft -= dt * 1000;
    if (weapon.cooldownLeft > 0) continue;

    const pos = world.get(id, Position);
    if (!pos) continue;

    const target = findNearestEnemy(world, pos.x, pos.y);
    if (!target) {
      weapon.cooldownLeft = 100;
      continue;
    }

    const dx = target.x - pos.x;
    const dy = target.y - pos.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const vx = ux * weapon.projectileSpeed;
    const vy = uy * weapon.projectileSpeed;

    spawnProjectile(world, renderer, id, pos.x, pos.y, vx, vy, weapon);
    bus.emit("weaponFire", {
      weaponId: weapon.id,
      ownerId: id,
      x: pos.x,
      y: pos.y,
      dx: ux,
      dy: uy,
    });
    weapon.cooldownLeft = weapon.cooldownMs;
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
