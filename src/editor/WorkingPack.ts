import { parseBundle } from "../content/bundle";
import type {
  AnyDef,
  BundledManifest,
  BundledPack,
  CharacterDef,
  EnemyDef,
  MapDef,
  PickupDef,
  UpgradeDef,
  WaveDef,
  WeaponDef,
} from "../content/schema";
import { EDITOR_DRAFT_KEY } from "../persistence/Keys";
import { SaveStore } from "../persistence/SaveStore";

export type DefKindOf<K extends AnyDef["kind"]> = Extract<AnyDef, { kind: K }>;

const EMPTY_MANIFEST: BundledManifest = {
  id: "my-pack",
  name: "Meu pack",
  version: "0.1.0",
  priority: 100,
  dependsOn: [],
};

export function emptyBundle(): BundledPack {
  return { schemaVersion: 1, manifest: { ...EMPTY_MANIFEST }, defs: [], scripts: [] };
}

export class WorkingPack {
  private state: BundledPack;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly store: SaveStore = new SaveStore()) {
    const loaded = store.get<BundledPack | null>(EDITOR_DRAFT_KEY, null);
    this.state = loaded && isValidBundle(loaded) ? loaded : emptyBundle();
  }

  get manifest(): BundledManifest {
    return this.state.manifest;
  }

  get bundle(): BundledPack {
    return this.state;
  }

  replaceBundle(bundle: BundledPack): void {
    this.state = { ...bundle, defs: [...bundle.defs] };
    this.emit();
  }

  reset(): void {
    this.state = emptyBundle();
    this.emit();
  }

  updateManifest(patch: Partial<BundledManifest>): void {
    this.state.manifest = { ...this.state.manifest, ...patch };
    this.emit();
  }

  list<K extends AnyDef["kind"]>(kind: K): DefKindOf<K>[] {
    return this.state.defs.filter((d): d is DefKindOf<K> => d.kind === kind);
  }

  get<K extends AnyDef["kind"]>(kind: K, id: string): DefKindOf<K> | undefined {
    return this.state.defs.find(
      (d): d is DefKindOf<K> => d.kind === kind && d.id === id,
    );
  }

  upsert(def: AnyDef, previousId?: string): void {
    const targetId = previousId ?? def.id;
    const idx = this.state.defs.findIndex(
      (d) => d.kind === def.kind && d.id === targetId,
    );
    if (idx === -1) {
      if (this.isDuplicate(def.kind, def.id)) {
        throw new Error(`Already exists: ${def.kind} "${def.id}"`);
      }
      this.state.defs.push(def);
    } else {
      if (previousId && previousId !== def.id && this.isDuplicate(def.kind, def.id)) {
        throw new Error(`Id already in use: ${def.kind} "${def.id}"`);
      }
      this.state.defs[idx] = def;
    }
    this.emit();
  }

  delete(kind: AnyDef["kind"], id: string): void {
    const idx = this.state.defs.findIndex((d) => d.kind === kind && d.id === id);
    if (idx >= 0) {
      this.state.defs.splice(idx, 1);
      this.emit();
    }
  }

  duplicate(kind: AnyDef["kind"], id: string): AnyDef | null {
    const def = this.state.defs.find((d) => d.kind === kind && d.id === id);
    if (!def) return null;
    const newId = this.makeUniqueId(kind, `${id}_copy`);
    const clone = structuredClone(def);
    clone.id = newId;
    this.state.defs.push(clone);
    this.emit();
    return clone;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.scheduleSave();
    for (const l of this.listeners) l();
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.store.set<BundledPack>(EDITOR_DRAFT_KEY, this.state);
      this.saveTimer = null;
    }, 250);
  }

  private isDuplicate(kind: AnyDef["kind"], id: string): boolean {
    return this.state.defs.some((d) => d.kind === kind && d.id === id);
  }

  private makeUniqueId(kind: AnyDef["kind"], base: string): string {
    if (!this.isDuplicate(kind, base)) return base;
    let i = 2;
    while (this.isDuplicate(kind, `${base}_${i}`)) i += 1;
    return `${base}_${i}`;
  }
}

function isValidBundle(raw: unknown): raw is BundledPack {
  try {
    parseBundle(raw);
    return true;
  } catch {
    return false;
  }
}

// Factory helpers for creating blank defs for the "New" button.

export function blankWeapon(id: string): WeaponDef {
  return {
    kind: "weapon",
    id,
    name: id,
    cooldownMs: 500,
    upgradeIds: [],
    shots: [
      {
        type: "projectile",
        startMs: 0,
        projectileCount: 1,
        projectileIntervalMs: 0,
        angleOffsetDeg: 0,
        damage: 10,
        projectile: { speed: 300, radius: 4, lifetimeMs: 800, pierce: 0, color: 0xffd166 },
      },
    ],
  };
}

export function blankEnemy(id: string): EnemyDef {
  return {
    kind: "enemy",
    id,
    name: id,
    hp: 20,
    speed: 60,
    contactDamage: 8,
    xpDrop: 1,
    hitbox: { radius: 10 },
    sprite: { color: 0xef476f, radius: 10 },
  };
}

export function blankPickup(id: string): PickupDef {
  return {
    kind: "pickup",
    id,
    effect: "xp",
    value: 1,
    magnetizable: true,
    sprite: { color: 0x06d6a0, radius: 4 },
  };
}

export function blankCharacter(id: string, startWeaponId: string): CharacterDef {
  return {
    kind: "character",
    id,
    name: id,
    startWeaponId,
    baseHp: 100,
    baseSpeed: 180,
    pickupRadius: 90,
    sprite: { color: 0x4cc9f0, radius: 12 },
    upgradeIds: [],
    maxWeapons: 4,
  };
}

export function blankMap(id: string, waveId: string): MapDef {
  return {
    kind: "map",
    id,
    name: id,
    waveId,
    backgroundColor: 0x0e1118,
    spawnRingMin: 380,
    spawnRingMax: 560,
    unlock: { kind: "always" },
  };
}

export function blankWave(id: string): WaveDef {
  return {
    kind: "wave",
    id,
    entries: [{ enemyId: "runner", startSec: 0, endSec: 600, ratePerSec: 1, burst: 0, cap: 0 }],
  };
}

export function blankUpgrade(id: string): UpgradeDef {
  return {
    kind: "upgrade",
    id,
    name: id,
    desc: "",
    scope: "weapon",
    maxLevel: 3,
    target: { path: "cooldownMs", op: "mul" },
    values: [0.95, 0.9, 0.85],
  };
}
