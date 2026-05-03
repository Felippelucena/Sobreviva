import { describe, expect, it, vi } from "vitest";
import { Rng } from "../../engine/Rng";
import type { UpgradeDef } from "../../content/schema/upgrade";
import { createModApi, type GameContext, type ModRuntime } from "../ModApi";

function freshRuntime(): ModRuntime {
  return {
    packId: "test",
    packName: "Test",
    version: "0.1.0",
    dynamicDefs: [],
    handlers: new Map(),
    disabled: false,
    rng: new Rng(1),
  };
}

const ctxRef: { value: GameContext | null } = { value: null };

describe("ModApi.registerUpgrade — runtime validation", () => {
  it("accepts a well-formed upgrade and pushes to dynamicDefs", () => {
    const runtime = freshRuntime();
    const api = createModApi(runtime, ctxRef);
    const ok: UpgradeDef = {
      kind: "upgrade",
      id: "ok",
      name: "OK",
      desc: "",
      scope: { kind: "weapon" },
      levels: [
        { name: "L1", description: "", improvements: [{ type: "attr", path: "cooldownMs", op: "mul", value: 0.9 }] },
        { name: "L2", description: "", improvements: [{ type: "attr", path: "cooldownMs", op: "mul", value: 0.8 }] },
      ],
    };
    api.registerUpgrade(ok);
    expect(runtime.dynamicDefs).toHaveLength(1);
  });

  it("rejects path with __proto__ segment (prototype pollution attempt)", () => {
    const runtime = freshRuntime();
    const api = createModApi(runtime, ctxRef);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const evil: UpgradeDef = {
      kind: "upgrade",
      id: "evil",
      name: "Evil",
      desc: "",
      scope: { kind: "weapon" },
      levels: [
        { name: "L1", description: "", improvements: [{ type: "attr", path: "__proto__.polluted", op: "set", value: 1 }] },
      ],
    };
    api.registerUpgrade(evil);
    expect(runtime.dynamicDefs).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("stores a parsed copy — mutating the caller's def after register cannot bypass validation", () => {
    const runtime = freshRuntime();
    const api = createModApi(runtime, ctxRef);
    const def: UpgradeDef = {
      kind: "upgrade",
      id: "toctou",
      name: "TOCTOU",
      desc: "",
      scope: { kind: "weapon" },
      levels: [
        { name: "L1", description: "", improvements: [{ type: "attr", path: "cooldownMs", op: "mul", value: 0.9 }] },
      ],
    };
    api.registerUpgrade(def);
    expect(runtime.dynamicDefs).toHaveLength(1);
    // Mutate caller's reference to a forbidden path. The stored def must not be the
    // same object — otherwise the mod would have post-validation injection.
    (def.levels[0]!.improvements[0] as { path: string }).path = "__proto__.polluted";
    const stored = runtime.dynamicDefs[0] as UpgradeDef;
    expect(stored.levels[0]!.improvements[0]).not.toBe(def.levels[0]!.improvements[0]);
    expect((stored.levels[0]!.improvements[0] as { path: string }).path).toBe("cooldownMs");
  });

  it("rejects shotSelect on a path that does not start with shots", () => {
    const runtime = freshRuntime();
    const api = createModApi(runtime, ctxRef);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const bad: UpgradeDef = {
      kind: "upgrade",
      id: "bad",
      name: "Bad",
      desc: "",
      scope: { kind: "weapon" },
      levels: [
        {
          name: "L1",
          description: "",
          improvements: [
            { type: "attr", path: "cooldownMs", op: "mul", value: 0.9, shotSelect: { select: "all" } },
          ],
        },
      ],
    };
    api.registerUpgrade(bad);
    expect(runtime.dynamicDefs).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
