import type { EntityId } from "../engine/World";

export class GameState {
  playerId: EntityId | null = null;
  runTimeMs = 0;
  kills = 0;
  gameOver = false;
  paused = false;
  shakeAmount = 0;
}
