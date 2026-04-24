import type { LoadedPack } from "../content/PackLoader";
import type { Renderer } from "../engine/Renderer";
import { Rng } from "../engine/Rng";
import type { World } from "../engine/World";
import type { EventBus, EventHandler, GameEvents } from "../engine/events/EventBus";
import type { ContentRegistry } from "../content/registry/ContentRegistry";
import type { GameState } from "../game/GameState";
import { createModApi, type GameContext, type ModRuntime } from "./ModApi";
import type { ModManager } from "./ModManager";

export class JsRuntime {
  private readonly mods = new Map<string, ModRuntime>();
  private readonly ctxRef: { value: GameContext | null } = { value: null };

  async loadMods(manager: ModManager): Promise<{ loaded: string[]; errors: { packId: string; error: string }[] }> {
    this.mods.clear();
    const loaded: string[] = [];
    const errors: { packId: string; error: string }[] = [];
    for (const stored of manager.enabledJsMods()) {
      const runtime: ModRuntime = {
        packId: stored.bundle.manifest.id,
        packName: stored.bundle.manifest.name,
        version: stored.bundle.manifest.version,
        dynamicDefs: [],
        handlers: new Map(),
        disabled: false,
        rng: new Rng(hashString(stored.bundle.manifest.id)),
      };
      const api = createModApi(runtime, this.ctxRef);
      try {
        for (const script of stored.bundle.scripts) {
          await runScript(script.name, script.code, api);
        }
        this.mods.set(runtime.packId, runtime);
        loaded.push(runtime.packId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        runtime.disabled = true;
        errors.push({ packId: runtime.packId, error: msg });
        console.error(`[JsRuntime] failed to load mod "${runtime.packId}":`, err);
      }
    }
    return { loaded, errors };
  }

  syntheticPacks(): LoadedPack[] {
    const out: LoadedPack[] = [];
    for (const mod of this.mods.values()) {
      if (mod.disabled || mod.dynamicDefs.length === 0) continue;
      out.push({
        manifest: {
          schemaVersion: 1,
          id: `${mod.packId}.js`,
          name: `${mod.packName} (JS)`,
          version: mod.version,
          priority: 200,
          dependsOn: [],
          files: [],
          js: [],
        },
        defs: [...mod.dynamicDefs],
      });
    }
    return out;
  }

  hasMods(): boolean {
    return this.mods.size > 0;
  }

  attachToGame(
    bus: EventBus,
    world: World,
    renderer: Renderer,
    registry: ContentRegistry,
    state: GameState,
  ): () => void {
    this.ctxRef.value = { bus, world, renderer, registry, state };
    const detaches: (() => void)[] = [];
    for (const runtime of this.mods.values()) {
      if (runtime.disabled) continue;
      for (const [event, handlers] of runtime.handlers) {
        for (const h of handlers) {
          detaches.push(bus.on(event as keyof GameEvents, h as EventHandler<GameEvents[keyof GameEvents]>, runtime.packId));
        }
      }
    }
    return () => {
      for (const d of detaches) d();
      this.ctxRef.value = null;
    };
  }
}

async function runScript(name: string, code: string, api: import("./ModApi").ModApi): Promise<void> {
  const blob = new Blob([code], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  try {
    const mod = (await import(/* @vite-ignore */ url)) as { default?: unknown };
    if (typeof mod.default !== "function") {
      throw new Error(`Script "${name}" must export a default function that receives the mod api.`);
    }
    (mod.default as (api: unknown) => void)(api);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
