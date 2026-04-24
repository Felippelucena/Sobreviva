import type { World } from "../../engine/World";
import type { GameState } from "../GameState";
import { EnemyAI, Position, Velocity } from "../components";

export function aiSystem(world: World, state: GameState): void {
  if (state.playerId === null) return;
  const playerPos = world.get(state.playerId, Position);
  if (!playerPos) return;

  for (const [id, ai, vel] of world.query(EnemyAI, Velocity)) {
    ai.targetId = state.playerId;
    const pos = world.get(id, Position);
    if (!pos) continue;
    const dx = playerPos.x - pos.x;
    const dy = playerPos.y - pos.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) {
      vel.vx = 0;
      vel.vy = 0;
      continue;
    }
    vel.vx = (dx / len) * vel.speed;
    vel.vy = (dy / len) * vel.speed;
  }
}
