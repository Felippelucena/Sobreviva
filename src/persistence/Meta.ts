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
