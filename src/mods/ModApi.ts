import type { Renderer } from "../engine/Renderer";
import type { Rng } from "../engine/Rng";
import type { World } from "../engine/World";
import type { EventBus, EventHandler, GameEvents } from "../engine/events/EventBus";
import type { ContentRegistry } from "../content/registry/ContentRegistry";
import type {
  AnyDef,
  EnemyDef,
  PickupDef,
  WeaponDef,
} from "../content/schema";
import { EnemyTag, Position } from "../game/components";
import { spawnPickup } from "../game/factories";
import type { GameState } from "../game/GameState";

export interface WorldFacade {
  getPlayerPosition(): { x: number; y: number } | null;
  countEnemies(): number;
  spawnPickup(x: number, y: number, pickupId: string): boolean;
}

export interface ModApiRng {
  next(): number;
  range(min: number, max: number): number;
  pick<T>(xs: readonly T[]): T;
}

export interface ModApi {
  packId: string;
  packName: string;
  registerWeapon(def: WeaponDef): void;
  registerEnemy(def: EnemyDef): void;
  registerPickup(def: PickupDef): void;
  on<K extends keyof GameEvents>(event: K, handler: EventHandler<GameEvents[K]>): void;
  rng: ModApiRng;
  world: WorldFacade;
  log(...args: unknown[]): void;
}

export interface ModRuntime {
  packId: string;
  packName: string;
  version: string;
  dynamicDefs: AnyDef[];
  handlers: Map<keyof GameEvents, EventHandler<GameEvents[keyof GameEvents]>[]>;
  disabled: boolean;
  rng: Rng;
}

export interface GameContext {
  bus: EventBus;
  world: World;
  renderer: Renderer;
  registry: ContentRegistry;
  state: GameState;
}

export function createModApi(runtime: ModRuntime, ctxRef: { value: GameContext | null }): ModApi {
  const world: WorldFacade = {
    getPlayerPosition: () => {
      const ctx = ctxRef.value;
      if (!ctx || ctx.state.playerId === null) return null;
      const pos = ctx.world.get(ctx.state.playerId, Position);
      return pos ? { x: pos.x, y: pos.y } : null;
    },
    countEnemies: () => {
      const ctx = ctxRef.value;
      if (!ctx) return 0;
      return ctx.world.count(EnemyTag);
    },
    spawnPickup: (x, y, pickupId) => {
      const ctx = ctxRef.value;
      if (!ctx) return false;
      const def = ctx.registry.find("pickup", pickupId);
      if (!def) return false;
      spawnPickup(ctx.world, ctx.renderer, x, y, def);
      return true;
    },
  };

  const api: ModApi = {
    packId: runtime.packId,
    packName: runtime.packName,
    registerWeapon: (def) => runtime.dynamicDefs.push(def),
    registerEnemy: (def) => runtime.dynamicDefs.push(def),
    registerPickup: (def) => runtime.dynamicDefs.push(def),
    on: (event, handler) => {
      let list = runtime.handlers.get(event);
      if (!list) {
        list = [];
        runtime.handlers.set(event, list);
      }
      list.push(handler as EventHandler<GameEvents[keyof GameEvents]>);
    },
    rng: {
      next: () => runtime.rng.next(),
      range: (a, b) => runtime.rng.range(a, b),
      pick: (xs) => runtime.rng.pick(xs),
    },
    world,
    log: (...args) => console.log(`[mod:${runtime.packId}]`, ...args),
  };

  return Object.freeze(api);
}
