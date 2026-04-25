import { beforeEach, describe, expect, it } from "vitest";
import { MODS_KEY } from "../../persistence/Keys";
import { SaveStore } from "../../persistence/SaveStore";
import { ModManager } from "../ModManager";

class InMemoryStorage implements Storage {
  private readonly data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  key(i: number): string | null {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
  clear(): void {
    this.data.clear();
  }
}

function buildBundle(id: string, damage = 50, priority = 50): unknown {
  return {
    schemaVersion: 1,
    manifest: { id, name: `Mod ${id}`, version: "0.1.0", priority },
    defs: [
      {
        kind: "weapon",
        id: "spark",
        name: "Spark",
        cooldownMs: 500,
        shots: [
          {
            type: "projectile",
            startMs: 0,
            projectileCount: 1,
            projectileIntervalMs: 0,
            angleOffsetDeg: 0,
            damage,
            projectile: { speed: 300, radius: 4, lifetimeMs: 800 },
          },
        ],
      },
    ],
  };
}

describe("ModManager", () => {
  let storage: InMemoryStorage;
  let store: SaveStore;

  beforeEach(() => {
    storage = new InMemoryStorage();
    store = new SaveStore(storage);
  });

  it("imports a new mod with default enabled=true", () => {
    const m = new ModManager(store);
    const { mod, replaced } = m.import(buildBundle("a"));
    expect(replaced).toBe(false);
    expect(mod.enabled).toBe(true);
    expect(m.list()).toHaveLength(1);
  });

  it("replaces on same id but preserves enabled/priority", () => {
    const m = new ModManager(store);
    m.import(buildBundle("a", 50, 10));
    m.setEnabled("a", false);
    m.setPriority("a", 200);
    const { replaced } = m.import(buildBundle("a", 99));
    expect(replaced).toBe(true);
    const mod = m.get("a")!;
    expect(mod.enabled).toBe(false);
    expect(mod.priority).toBe(200);
    const w = mod.bundle.defs[0] as { shots: { damage: number }[] };
    expect(w.shots[0]!.damage).toBe(99);
  });

  it("persists across instances through the save store", () => {
    const a = new ModManager(store);
    a.import(buildBundle("a"));
    a.import(buildBundle("b"));
    a.setEnabled("b", false);

    const b = new ModManager(new SaveStore(storage));
    expect(b.list()).toHaveLength(2);
    expect(b.get("b")!.enabled).toBe(false);
  });

  it("removes a mod", () => {
    const m = new ModManager(store);
    m.import(buildBundle("a"));
    m.remove("a");
    expect(m.list()).toHaveLength(0);
  });

  it("lists sorted by priority ascending", () => {
    const m = new ModManager(store);
    m.import(buildBundle("a", 1, 100));
    m.import(buildBundle("b", 1, 10));
    m.import(buildBundle("c", 1, 50));
    expect(m.list().map((x) => x.bundle.manifest.id)).toEqual(["b", "c", "a"]);
  });

  it("enabledLoadedPacks omits disabled mods and applies stored priority", () => {
    const m = new ModManager(store);
    m.import(buildBundle("a", 1, 100));
    m.import(buildBundle("b", 1, 50));
    m.setEnabled("b", false);
    const packs = m.enabledLoadedPacks();
    expect(packs).toHaveLength(1);
    expect(packs[0]!.manifest.id).toBe("a");
    expect(packs[0]!.manifest.priority).toBe(100);
  });

  it("ignores corrupt stored data", () => {
    storage.setItem(MODS_KEY, JSON.stringify({ v: 1, data: { mods: "garbage" } }));
    const m = new ModManager(store);
    expect(m.list()).toHaveLength(0);
  });
});
