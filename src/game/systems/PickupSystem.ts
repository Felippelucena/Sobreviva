import type { World, EntityId } from "../../engine/World";
import type { EventBus } from "../../engine/events/EventBus";
import type { GameState } from "../GameState";
import {
  Health,
  Hitbox,
  Pickup,
  PickupTag,
  PlayerProgress,
  Position,
  Velocity,
} from "../components";
import { destroyEntityWithDisplay } from "./CollisionSystem";

const MAGNET_SPEED = 380;
const MAGNET_ACCEL = 1400;

export function pickupSystem(
  world: World,
  state: GameState,
  bus: EventBus,
  dt: number,
): void {
  if (state.playerId === null) return;
  const ppos = world.get(state.playerId, Position);
  const php = world.get(state.playerId, Health);
  const progress = world.get(state.playerId, PlayerProgress);
  const hb = world.get(state.playerId, Hitbox);
  if (!ppos || !progress || !hb) return;

  const magnetR2 = progress.pickupRadius * progress.pickupRadius;
  const toCollect: EntityId[] = [];

  for (const [id, pos, pickup] of world.query(Position, Pickup)) {
    if (!world.has(id, PickupTag)) continue;
    const dx = ppos.x - pos.x;
    const dy = ppos.y - pos.y;
    const d2 = dx * dx + dy * dy;

    const vel = world.get(id, Velocity);
    if (pickup.magnetizable && vel) {
      if (pickup.state === "idle" && d2 <= magnetR2) {
        pickup.state = "magnet";
      }
      if (pickup.state === "magnet") {
        const d = Math.sqrt(d2) || 1;
        const tx = dx / d;
        const ty = dy / d;
        vel.vx += tx * MAGNET_ACCEL * dt;
        vel.vy += ty * MAGNET_ACCEL * dt;
        const vmag = Math.hypot(vel.vx, vel.vy);
        if (vmag > MAGNET_SPEED) {
          vel.vx = (vel.vx / vmag) * MAGNET_SPEED;
          vel.vy = (vel.vy / vmag) * MAGNET_SPEED;
        }
      }
    }

    const collectR = hb.radius + 8;
    if (d2 <= collectR * collectR) {
      toCollect.push(id);
    }
  }

  for (const id of toCollect) {
    const pickup = world.get(id, Pickup);
    if (!pickup) continue;
    const prevLevel = progress.level;
    applyPickup(pickup, progress, php);
    if (progress.level > prevLevel) {
      bus.emit("levelUp", { level: progress.level });
    }
    destroyEntityWithDisplay(world, id);
  }
}

function applyPickup(
  pickup: { effect: "xp" | "heal" | "magnet"; value: number },
  progress: {
    level: number;
    xp: number;
    xpForNext: number;
    pendingLevelUps: number;
  },
  health: { current: number; max: number } | undefined,
): void {
  if (pickup.effect === "xp") {
    progress.xp += pickup.value;
    while (progress.xp >= progress.xpForNext) {
      progress.xp -= progress.xpForNext;
      progress.level += 1;
      progress.pendingLevelUps += 1;
      progress.xpForNext = xpForLevelLocal(progress.level);
    }
  } else if (pickup.effect === "heal" && health) {
    health.current = Math.min(health.max, health.current + pickup.value);
  }
}

function xpForLevelLocal(level: number): number {
  const base = 5 + (level - 1) * 3;
  if (level <= 5) return base;
  return base + (level - 5) * (level - 5) * 2;
}
