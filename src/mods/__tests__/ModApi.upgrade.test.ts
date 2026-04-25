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
      scope: "weapon",
      maxLevel: 2,
      target: { path: "cooldownMs", op: "mul" },
      values: [0.9, 0.8],
    };
    api.registerUpgrade(ok);
    expect(runtime.dynamicDefs).toHaveLength(1);
  });

  it("rejects upgrades where values.length !== maxLevel", () => {
    const runtime = freshRuntime();
    const api = createModApi(runtime, ctxRef);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const bad: UpgradeDef = {
      kind: "upgrade",
      id: "bad",
      name: "Bad",
      desc: "",
      scope: "weapon",
      maxLevel: 3,
      target: { path: "cooldownMs", op: "mul" },
      values: [0.9, 0.8],
    };
    api.registerUpgrade(bad);
    expect(runtime.dynamicDefs).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("rejects mul/add/set with non-numeric values", () => {
    const runtime = freshRuntime();
    const api = createModApi(runtime, ctxRef);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const bad = {
      kind: "upgrade",
      id: "bad2",
      name: "Bad2",
      desc: "",
      scope: "weapon",
      maxLevel: 1,
      target: { path: "cooldownMs", op: "mul" },
      values: ["not-a-number"],
    } as unknown as UpgradeDef;
    api.registerUpgrade(bad);
    expect(runtime.dynamicDefs).toHaveLength(0);
    warn.mockRestore();
  });
});
