import type { Input } from "../../engine/Input";
import type { World } from "../../engine/World";
import { PlayerTag, Velocity } from "../components";

export function inputSystem(world: World, input: Input): void {
  const dir = input.moveVector();
  for (const [id, vel] of world.query(Velocity)) {
    if (!world.has(id, PlayerTag)) continue;
    vel.vx = dir.x * vel.speed;
    vel.vy = dir.y * vel.speed;
  }
}
