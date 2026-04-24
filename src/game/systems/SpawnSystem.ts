import type { Renderer } from "../../engine/Renderer";
import type { Rng } from "../../engine/Rng";
import type { World } from "../../engine/World";
import type { EventBus } from "../../engine/events/EventBus";
import type { ContentRegistry } from "../../content/registry/ContentRegistry";
import type { MapDef, WaveDef } from "../../content/schema";
import type { GameState } from "../GameState";
import { EnemyTag, Position } from "../components";
import { spawnEnemy } from "../factories";

interface EntryAccumulator {
  accumulator: number;
  burstDone: boolean;
}

export class EnemySpawner {
  private readonly accumulators: EntryAccumulator[];

  constructor(
    private readonly world: World,
    private readonly renderer: Renderer,
    private readonly rng: Rng,
    private readonly state: GameState,
    private readonly registry: ContentRegistry,
    private readonly wave: WaveDef,
    private readonly map: MapDef,
    private readonly bus: EventBus,
  ) {
    this.accumulators = wave.entries.map(() => ({ accumulator: 0, burstDone: false }));
  }

  update(dt: number): void {
    if (this.state.gameOver || this.state.playerId === null) return;
    const nowSec = this.state.runTimeMs / 1000;

    for (let i = 0; i < this.wave.entries.length; i++) {
      const entry = this.wave.entries[i]!;
      const acc = this.accumulators[i]!;
      if (nowSec < entry.startSec || nowSec >= entry.endSec) continue;

      if (!acc.burstDone && entry.burst > 0) {
        acc.burstDone = true;
        for (let b = 0; b < entry.burst; b++) {
          if (this.respectsCap(entry.cap)) this.spawnOne(entry.enemyId);
        }
      }

      acc.accumulator += dt * entry.ratePerSec;
      while (acc.accumulator >= 1) {
        acc.accumulator -= 1;
        if (!this.respectsCap(entry.cap)) continue;
        this.spawnOne(entry.enemyId);
      }
    }
  }

  private respectsCap(cap: number): boolean {
    if (cap <= 0) return true;
    return this.world.count(EnemyTag) < cap;
  }

  private spawnOne(enemyId: string): void {
    if (this.state.playerId === null) return;
    const playerPos = this.world.get(this.state.playerId, Position);
    if (!playerPos) return;
    const def = this.registry.find("enemy", enemyId);
    if (!def) return;
    const angle = this.rng.range(0, Math.PI * 2);
    const dist = this.rng.range(this.map.spawnRingMin, this.map.spawnRingMax);
    const x = playerPos.x + Math.cos(angle) * dist;
    const y = playerPos.y + Math.sin(angle) * dist;
    const entityId = spawnEnemy(this.world, this.renderer, x, y, def);
    this.bus.emit("enemySpawn", { enemyId, entityId, x, y });
  }
}
