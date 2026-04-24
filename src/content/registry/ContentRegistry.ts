import { mergeDef } from "../MergePolicy";
import type { LoadedPack } from "../PackLoader";
import type {
  AnyDef,
  CharacterDef,
  EnemyDef,
  MapDef,
  PickupDef,
  WaveDef,
  WeaponDef,
} from "../schema";

export type DefByKind = {
  weapon: WeaponDef;
  enemy: EnemyDef;
  pickup: PickupDef;
  wave: WaveDef;
  character: CharacterDef;
  map: MapDef;
};

export type DefKind = keyof DefByKind;

export class ContentRegistry {
  private readonly byKind = new Map<DefKind, Map<string, AnyDef>>();
  readonly packOrder: readonly string[];

  constructor(packs: readonly LoadedPack[]) {
    this.packOrder = packs.map((p) => p.manifest.id);
    const sorted = [...packs].sort((a, b) => a.manifest.priority - b.manifest.priority);
    for (const pack of sorted) {
      for (const def of pack.defs) {
        const bucket = this.bucket(def.kind);
        const prev = bucket.get(def.id);
        bucket.set(def.id, prev ? mergeDef(prev, def) : def);
      }
    }
    for (const bucket of this.byKind.values()) {
      for (const [id, def] of bucket) {
        bucket.set(id, deepFreeze(def));
      }
    }
  }

  get<K extends DefKind>(kind: K, id: string): DefByKind[K] {
    const def = this.byKind.get(kind)?.get(id);
    if (!def) throw new Error(`ContentRegistry: missing ${kind} "${id}"`);
    return def as DefByKind[K];
  }

  find<K extends DefKind>(kind: K, id: string): DefByKind[K] | undefined {
    return this.byKind.get(kind)?.get(id) as DefByKind[K] | undefined;
  }

  list<K extends DefKind>(kind: K): readonly DefByKind[K][] {
    const bucket = this.byKind.get(kind);
    if (!bucket) return [];
    return [...bucket.values()] as DefByKind[K][];
  }

  private bucket(kind: DefKind): Map<string, AnyDef> {
    let b = this.byKind.get(kind);
    if (!b) {
      b = new Map();
      this.byKind.set(kind, b);
    }
    return b;
  }
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const key of Object.keys(value as object)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(value);
}
