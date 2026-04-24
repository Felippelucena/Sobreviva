import { bundleToLoadedPack, parseBundle } from "../content/bundle";
import type { LoadedPack } from "../content/PackLoader";
import type { BundledPack } from "../content/schema";
import { MODS_KEY } from "../persistence/Keys";
import { SaveStore } from "../persistence/SaveStore";

export interface StoredMod {
  bundle: BundledPack;
  enabled: boolean;
  priority: number;
  /** Version for which the user has explicitly allowed JS execution. */
  jsConsentVersion?: string;
}

interface ModsStoreShape {
  mods: StoredMod[];
}

const DEFAULT_STATE: ModsStoreShape = { mods: [] };
const DEFAULT_MOD_PRIORITY = 100;

export class ModManager {
  private state: ModsStoreShape;

  constructor(private readonly store: SaveStore = new SaveStore()) {
    const loaded = store.get<ModsStoreShape>(MODS_KEY, DEFAULT_STATE);
    this.state = sanitize(loaded);
  }

  list(): readonly StoredMod[] {
    return [...this.state.mods].sort((a, b) => a.priority - b.priority);
  }

  get(id: string): StoredMod | undefined {
    return this.state.mods.find((m) => m.bundle.manifest.id === id);
  }

  import(raw: unknown): { mod: StoredMod; replaced: boolean } {
    const bundle = parseBundle(raw);
    const existingIdx = this.state.mods.findIndex(
      (m) => m.bundle.manifest.id === bundle.manifest.id,
    );
    let mod: StoredMod;
    let replaced = false;
    if (existingIdx >= 0) {
      const prev = this.state.mods[existingIdx]!;
      mod = {
        bundle,
        enabled: prev.enabled,
        priority: prev.priority,
        jsConsentVersion:
          prev.jsConsentVersion === bundle.manifest.version ? prev.jsConsentVersion : undefined,
      };
      this.state.mods[existingIdx] = mod;
      replaced = true;
    } else {
      mod = {
        bundle,
        enabled: true,
        priority: bundle.manifest.priority || DEFAULT_MOD_PRIORITY,
      };
      this.state.mods.push(mod);
    }
    this.persist();
    return { mod, replaced };
  }

  async importFromUrl(url: string): Promise<{ mod: StoredMod; replaced: boolean }> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return this.import(await res.json());
  }

  remove(id: string): void {
    this.state.mods = this.state.mods.filter((m) => m.bundle.manifest.id !== id);
    this.persist();
  }

  setEnabled(id: string, enabled: boolean): void {
    const mod = this.get(id);
    if (!mod) return;
    mod.enabled = enabled;
    this.persist();
  }

  setPriority(id: string, priority: number): void {
    const mod = this.get(id);
    if (!mod) return;
    if (!Number.isFinite(priority)) return;
    mod.priority = Math.round(priority);
    this.persist();
  }

  hasJsScripts(id: string): boolean {
    const mod = this.get(id);
    return !!mod && mod.bundle.scripts.length > 0;
  }

  hasJsConsent(id: string): boolean {
    const mod = this.get(id);
    if (!mod) return false;
    return mod.jsConsentVersion === mod.bundle.manifest.version;
  }

  grantJsConsent(id: string): void {
    const mod = this.get(id);
    if (!mod) return;
    mod.jsConsentVersion = mod.bundle.manifest.version;
    this.persist();
  }

  revokeJsConsent(id: string): void {
    const mod = this.get(id);
    if (!mod) return;
    mod.jsConsentVersion = undefined;
    this.persist();
  }

  enabledLoadedPacks(): LoadedPack[] {
    return this.list()
      .filter((m) => m.enabled)
      .map((m) => {
        const pack = bundleToLoadedPack(m.bundle);
        pack.manifest = { ...pack.manifest, priority: m.priority };
        return pack;
      });
  }

  /** Mods that are enabled, have JS scripts, and have been granted consent for the current version. */
  enabledJsMods(): StoredMod[] {
    return this.list().filter(
      (m) => m.enabled && m.bundle.scripts.length > 0 && m.jsConsentVersion === m.bundle.manifest.version,
    );
  }

  private persist(): void {
    this.store.set<ModsStoreShape>(MODS_KEY, this.state);
  }
}

function sanitize(state: ModsStoreShape): ModsStoreShape {
  if (!state || !Array.isArray(state.mods)) return { mods: [] };
  const seen = new Set<string>();
  const clean: StoredMod[] = [];
  for (const m of state.mods) {
    if (!m || !m.bundle || !m.bundle.manifest) continue;
    const id = m.bundle.manifest.id;
    if (typeof id !== "string" || seen.has(id)) continue;
    seen.add(id);
    clean.push({
      bundle: m.bundle,
      enabled: Boolean(m.enabled),
      priority: Number.isFinite(m.priority) ? Math.round(m.priority) : DEFAULT_MOD_PRIORITY,
      jsConsentVersion: typeof m.jsConsentVersion === "string" ? m.jsConsentVersion : undefined,
    });
  }
  return { mods: clean };
}
