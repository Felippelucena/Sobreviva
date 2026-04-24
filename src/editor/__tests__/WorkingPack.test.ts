import { beforeEach, describe, expect, it, vi } from "vitest";
import { SaveStore } from "../../persistence/SaveStore";
import { blankEnemy, blankWeapon, WorkingPack } from "../WorkingPack";

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

describe("WorkingPack", () => {
  let store: SaveStore;
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
    store = new SaveStore(storage);
    vi.useFakeTimers();
  });

  it("starts empty when no draft exists", () => {
    const wp = new WorkingPack(store);
    expect(wp.bundle.defs).toHaveLength(0);
    expect(wp.manifest.id).toBe("my-pack");
  });

  it("upserts new and replaces existing", () => {
    const wp = new WorkingPack(store);
    wp.upsert(blankWeapon("spark"));
    expect(wp.list("weapon")).toHaveLength(1);
    wp.upsert({ ...blankWeapon("spark"), damage: 999 });
    expect(wp.list("weapon")[0]!.damage).toBe(999);
  });

  it("renames via previousId without duplicating", () => {
    const wp = new WorkingPack(store);
    wp.upsert(blankWeapon("spark"));
    wp.upsert({ ...blankWeapon("lightning") }, "spark");
    expect(wp.list("weapon").map((w) => w.id)).toEqual(["lightning"]);
  });

  it("rejects upsert with duplicate id on rename target", () => {
    const wp = new WorkingPack(store);
    wp.upsert(blankWeapon("spark"));
    wp.upsert(blankWeapon("hammer"));
    expect(() => wp.upsert({ ...blankWeapon("hammer") }, "spark")).toThrow(/in use/);
  });

  it("duplicate creates a new id with _copy suffix", () => {
    const wp = new WorkingPack(store);
    wp.upsert(blankWeapon("spark"));
    const clone = wp.duplicate("weapon", "spark")!;
    expect(clone.id).toBe("spark_copy");
    expect(wp.list("weapon")).toHaveLength(2);
    const clone2 = wp.duplicate("weapon", "spark")!;
    expect(clone2.id).toBe("spark_copy_2");
  });

  it("delete removes only the matching def", () => {
    const wp = new WorkingPack(store);
    wp.upsert(blankWeapon("spark"));
    wp.upsert(blankEnemy("runner"));
    wp.delete("weapon", "spark");
    expect(wp.list("weapon")).toHaveLength(0);
    expect(wp.list("enemy")).toHaveLength(1);
  });

  it("autosaves to the store after debounce", () => {
    const wp = new WorkingPack(store);
    wp.upsert(blankWeapon("spark"));
    expect(storage.getItem("correril.editor.draft.v1")).toBeNull();
    vi.runAllTimers();
    expect(storage.getItem("correril.editor.draft.v1")).not.toBeNull();
    const reloaded = new WorkingPack(new SaveStore(storage));
    expect(reloaded.list("weapon").map((w) => w.id)).toEqual(["spark"]);
  });

  it("subscribe notifies on any change", () => {
    const wp = new WorkingPack(store);
    const fn = vi.fn();
    wp.subscribe(fn);
    wp.upsert(blankWeapon("spark"));
    wp.updateManifest({ name: "New" });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
