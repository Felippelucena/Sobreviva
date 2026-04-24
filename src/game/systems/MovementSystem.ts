import type { World } from "../../engine/World";
import { Position, Velocity } from "../components";

export function movementSystem(world: World, dt: number): void {
  for (const [_id, pos, vel] of world.query(Position, Velocity)) {
    pos.prevX = pos.x;
    pos.prevY = pos.y;
    pos.x += vel.vx * dt;
    pos.y += vel.vy * dt;
  }
}
