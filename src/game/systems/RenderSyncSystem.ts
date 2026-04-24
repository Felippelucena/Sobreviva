import type { World } from "../../engine/World";
import { FadeOverLife, FlashTint, Lifetime, Position, SpriteRef } from "../components";

export function renderSyncSystem(world: World, alpha: number, nowMs: number): void {
  for (const [id, pos, sprite] of world.query(Position, SpriteRef)) {
    const x = pos.prevX + (pos.x - pos.prevX) * alpha;
    const y = pos.prevY + (pos.y - pos.prevY) * alpha;
    sprite.display.position.set(x, y);

    const flash = world.get(id, FlashTint);
    if (flash) {
      if (nowMs < flash.until) {
        flash.graphics.tint = flash.color;
      } else if (flash.graphics.tint !== flash.base) {
        flash.graphics.tint = 0xffffff;
      }
    }

    const fade = world.get(id, FadeOverLife);
    const lt = world.get(id, Lifetime);
    if (fade && lt) {
      const t = Math.max(0, Math.min(1, lt.remainingMs / fade.durationMs));
      sprite.display.alpha = t;
    }
  }
}
