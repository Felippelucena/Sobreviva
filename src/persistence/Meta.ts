import type { MapDef } from "../content/schema/map";
import { META_KEY } from "./Keys";
import { SaveStore } from "./SaveStore";

export interface MetaState {
  unlockedCharacters: string[];
  bestRun: { timeMs: number; kills: number; level: number };
  runs: number;
}

export interface RunResult {
  characterId: string;
  timeMs: number;
  kills: number;
  level: number;
}

const DEFAULT_META: MetaState = {
  unlockedCharacters: ["runner_hero"],
  bestRun: { timeMs: 0, kills: 0, level: 1 },
  runs: 0,
};

export interface UnlockRule {
  characterId: string;
  label: string;
  test: (result: RunResult) => boolean;
}

export const UNLOCK_RULES: readonly UnlockRule[] = [
  {
    characterId: "bruiser_hero",
    label: "Sobreviva 2 minutos para desbloquear Bruiser",
    test: (r) => r.timeMs >= 120_000,
  },
  {
    characterId: "swarmer_hero",
    label: "Alcance o nível 8 para desbloquear Swarmer",
    test: (r) => r.level >= 8,
  },
];

export class MetaManager {
  private current: MetaState;

  constructor(private readonly store: SaveStore = new SaveStore()) {
    this.current = { ...DEFAULT_META, ...store.get<MetaState>(META_KEY, DEFAULT_META) };
    if (!this.current.unlockedCharacters.includes("runner_hero")) {
      this.current.unlockedCharacters = ["runner_hero", ...this.current.unlockedCharacters];
    }
  }

  get state(): MetaState {
    return this.current;
  }

  isUnlocked(characterId: string): boolean {
    return this.current.unlockedCharacters.includes(characterId);
  }

  isMapUnlocked(map: MapDef): boolean {
    const u = map.unlock;
    if (!u) return true;
    switch (u.kind) {
      case "always":
        return true;
      case "kills":
        return this.current.bestRun.kills >= u.count;
      case "runs":
        return this.current.runs >= u.count;
      case "time":
        return this.current.bestRun.timeMs >= u.ms;
    }
  }

  mapLockHint(map: MapDef): string | null {
    const u = map.unlock;
    if (!u) return null;
    switch (u.kind) {
      case "always":
        return null;
      case "kills":
        return `Acumule ${u.count} kills em uma run`;
      case "runs":
        return `Complete ${u.count} runs`;
      case "time":
        return `Sobreviva ${Math.floor(u.ms / 1000)}s em uma run`;
    }
  }

  recordRun(result: RunResult): { newlyUnlocked: UnlockRule[] } {
    this.current.runs += 1;
    if (result.timeMs > this.current.bestRun.timeMs) this.current.bestRun.timeMs = result.timeMs;
    if (result.kills > this.current.bestRun.kills) this.current.bestRun.kills = result.kills;
    if (result.level > this.current.bestRun.level) this.current.bestRun.level = result.level;

    const newlyUnlocked: UnlockRule[] = [];
    for (const rule of UNLOCK_RULES) {
      if (!this.isUnlocked(rule.characterId) && rule.test(result)) {
        this.current.unlockedCharacters.push(rule.characterId);
        newlyUnlocked.push(rule);
      }
    }

    this.store.set(META_KEY, this.current);
    return { newlyUnlocked };
  }
}
