export type EventHandler<T> = (payload: T) => void;

export interface GameEvents {
  tick: { dt: number; elapsedMs: number };
  weaponFire: { weaponId: string; ownerId: number; x: number; y: number; dx: number; dy: number };
  enemySpawn: { enemyId: string; entityId: number; x: number; y: number };
  enemyDeath: { enemyId: string; entityId: number; x: number; y: number };
  playerHit: { damage: number; hpLeft: number };
  levelUp: { level: number };
  upgradeApplied: { upgradeId: string; level: number; targetEntityId: number };
  weaponEquipped: { weaponId: string; weaponEntityId: number; ownerId: number };
}

type EventName = keyof GameEvents;

interface HandlerEntry<K extends EventName> {
  fn: EventHandler<GameEvents[K]>;
  source: string;
  errorCount: number;
  disabled: boolean;
}

const MAX_ERRORS_BEFORE_DISABLE = 3;

export class EventBus {
  private readonly handlers: { [K in EventName]: HandlerEntry<K>[] } = {
    tick: [],
    weaponFire: [],
    enemySpawn: [],
    enemyDeath: [],
    playerHit: [],
    levelUp: [],
    upgradeApplied: [],
    weaponEquipped: [],
  };

  on<K extends EventName>(
    event: K,
    fn: EventHandler<GameEvents[K]>,
    source = "internal",
  ): () => void {
    const entry: HandlerEntry<K> = { fn, source, errorCount: 0, disabled: false };
    this.handlers[event].push(entry);
    return () => {
      const list = this.handlers[event];
      const idx = list.indexOf(entry);
      if (idx >= 0) list.splice(idx, 1);
    };
  }

  emit<K extends EventName>(event: K, payload: GameEvents[K]): void {
    const list = this.handlers[event];
    for (const entry of list) {
      if (entry.disabled) continue;
      try {
        entry.fn(payload);
      } catch (err) {
        entry.errorCount += 1;
        console.error(`[EventBus] handler ${entry.source} threw on "${event}":`, err);
        if (entry.errorCount >= MAX_ERRORS_BEFORE_DISABLE) {
          entry.disabled = true;
          console.warn(`[EventBus] disabling ${entry.source} after ${entry.errorCount} errors`);
        }
      }
    }
  }

  clearBySource(source: string): void {
    for (const key of Object.keys(this.handlers) as EventName[]) {
      this.handlers[key] = this.handlers[key].filter((h) => h.source !== source) as never;
    }
  }
}
