import { beforeEach, describe, expect, it } from "vitest";
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

function buildJsMod(id: string, version = "1.0.0"): unknown {
  return {
    schemaVersion: 2,
    manifest: { id, name: `JS ${id}`, version, priority: 100 },
    defs: [],
    scripts: [{ name: "main.js", code: "export default function register(api){ api.log('x'); }" }],
  };
}

describe("ModManager — JS consent", () => {
  let store: SaveStore;
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
    store = new SaveStore(storage);
  });

  it("starts without consent even if scripts exist", () => {
    const m = new ModManager(store);
    m.import(buildJsMod("a"));
    expect(m.hasJsScripts("a")).toBe(true);
    expect(m.hasJsConsent("a")).toBe(false);
    expect(m.enabledJsMods()).toHaveLength(0);
  });

  it("grantJsConsent enables the mod for the current version", () => {
    const m = new ModManager(store);
    m.import(buildJsMod("a", "1.0.0"));
    m.grantJsConsent("a");
    expect(m.hasJsConsent("a")).toBe(true);
    expect(m.enabledJsMods().map((x) => x.bundle.manifest.id)).toEqual(["a"]);
  });

  it("reimport with a different version revokes consent", () => {
    const m = new ModManager(store);
    m.import(buildJsMod("a", "1.0.0"));
    m.grantJsConsent("a");
    m.import(buildJsMod("a", "2.0.0"));
    expect(m.hasJsConsent("a")).toBe(false);
    expect(m.enabledJsMods()).toHaveLength(0);
  });

  it("reimport with same version keeps consent", () => {
    const m = new ModManager(store);
    m.import(buildJsMod("a", "1.0.0"));
    m.grantJsConsent("a");
    m.import(buildJsMod("a", "1.0.0"));
    expect(m.hasJsConsent("a")).toBe(true);
  });

  it("disabling mod excludes from enabledJsMods even with consent", () => {
    const m = new ModManager(store);
    m.import(buildJsMod("a"));
    m.grantJsConsent("a");
    m.setEnabled("a", false);
    expect(m.enabledJsMods()).toHaveLength(0);
  });

  it("consent persists across ModManager instances", () => {
    const a = new ModManager(store);
    a.import(buildJsMod("a"));
    a.grantJsConsent("a");
    const b = new ModManager(new SaveStore(storage));
    expect(b.hasJsConsent("a")).toBe(true);
  });

  it("revokeJsConsent clears allowance", () => {
    const m = new ModManager(store);
    m.import(buildJsMod("a"));
    m.grantJsConsent("a");
    m.revokeJsConsent("a");
    expect(m.hasJsConsent("a")).toBe(false);
  });
});
