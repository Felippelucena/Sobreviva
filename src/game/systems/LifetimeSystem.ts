import type { World } from "../../engine/World";
import { Lifetime } from "../components";
import { destroyEntityWithDisplay } from "./CollisionSystem";

export function lifetimeSystem(world: World, dt: number): void {
  const dtMs = dt * 1000;
  for (const [id, life] of world.query(Lifetime)) {
    life.remainingMs -= dtMs;
    if (life.remainingMs <= 0) {
      destroyEntityWithDisplay(world, id);
    }
  }
}
