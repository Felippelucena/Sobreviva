# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Browser game ("Sobreviva") in the Vampire Survivors vein, built as a portfolio piece with an in-game editor and a mod pipeline. Stack: **TypeScript + Vite + PixiJS v8 + Zod + Vitest**. User-facing strings are pt-BR; code identifiers and comments are English. See `ROADMAP.md` for milestone planning (M1–M8) — treat it as authoritative for scope decisions.

## Commands

- `npm run dev` — Vite dev server on :5173.
- `npm run build` — `tsc --noEmit` then `vite build`. The typecheck gate runs first; a TS error fails the build.
- `npm run typecheck` — strict TS check only.
- `npm test` — Vitest (one-shot). `npm run test:watch` for watch mode.
- Run a single test: `npx vitest run src/content/__tests__/merge.test.ts` (or pass `-t "partial name"` to filter by test name).

TS config is maximally strict (`noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax`). Type-only imports must use `import type`.

## Architecture

### Entry and routing

`src/main.ts` creates a `Router` (`src/app/Router.ts`) that does hash-based routing between `#/play` and `#/editor`. On each route change the current `App` (play mode) or `Editor` (authoring mode) is disposed and a fresh one is constructed — they do not coexist. Both receive the same `#app` host element.

### App shell (`src/app/App.ts`)

`App` is the play-mode coordinator. It owns long-lived singletons (`MetaManager`, `ModManager`, `JsRuntime`, overlay UIs) and transitions between three screens: `menu` → `playing` → `summary`. The `Game` instance is created per run and disposed on exit. `App` also owns the global Escape key handler (pause/close-mods logic) and re-runs `reloadMods()` whenever mods change so the next run sees a fresh `ContentRegistry`.

### Game loop and ECS (`src/app/Game.ts` + `src/engine/`)

- **Fixed timestep**: `Loop` (`src/engine/Loop.ts`) runs update at `FIXED_DT` (60 Hz) with a bounded catch-up (`MAX_CATCH_UP_TICKS`), and render at rAF with an `alpha` interpolation factor. `Position` carries `prevX/prevY` for `renderSyncSystem` to interpolate between.
- **ECS**: `World` (`src/engine/World.ts`) stores components in `Map<Symbol, Map<EntityId, unknown>>`, keyed by branded `ComponentKey<T>` created via `defineComponent`. Queries iterate the smallest store. Destruction is deferred — `world.flushDestroyed()` runs at the end of each tick. All component types live in `src/game/components/index.ts`.
- **Systems** (`src/game/systems/`) are plain functions that take `world`, plus whatever context they need (state, renderer, registry, rng, bus, dt). Execution order in `Game.update` matters: input → AI → movement → collision → weapon → pickup → lifetime → spawn → tick event.
- **Renderer** (`src/engine/Renderer.ts`) wraps Pixi's `Application` with three stacked containers: `background` (tiling sprite), `world` (entities, transformed by `Camera`), `hud` (screen-space). The HUD overlay in `src/ui/Hud.ts` is plain DOM, not Pixi.
- **Events**: `EventBus` (`src/engine/events/EventBus.ts`) is typed (`GameEvents`). Handlers that throw increment an error count and get auto-disabled after 3 throws — **do not remove this quarantine**, it's what keeps a buggy mod from killing the run. Always pass a `source` string when registering so `clearBySource` can detach cleanly.

### Content pipeline (`src/content/`)

The hot path from JSON on disk to live gameplay:

1. **Zod schemas** (`src/content/schema/`) define every `*Def` (`weapon`, `enemy`, `pickup`, `wave`, `character`, `map`). All carry `schemaVersion: 1`. `AnyDef` is the discriminated union.
2. **`PackLoader.ts`** fetches a manifest + its files, validates via `PackFile.parse`, and returns a `LoadedPack` (manifest + flat `defs[]`). Duplicate `kind:id` within one pack is an error.
3. **`MergePolicy.ts`** — **read this before touching merge semantics**. The contract is deliberately dumb: scalars and arrays replace; plain objects (sprite/hitbox/projectile) get one level of shallow merge; nothing else is "smart". Mod authors only have this doc, so keep it predictable.
4. **`ContentRegistry.ts`** takes all packs, sorts by `manifest.priority` ascending, merges collisions via `mergeDef`, and **deep-freezes every def**. Gameplay code reads defs via `registry.get(kind, id)` and relies on them being immutable.

Base content lives in `public/packs/base/*.json`. Adding content to a JSON file under `public/packs/base/` is the intended authoring path — no TS changes needed.

### Mods (`src/mods/`)

Two-layer: JSON packs (always safe) and optional JS scripts (consent-gated).

- `ModManager` persists the installed-mod list to `localStorage` via `SaveStore`. A pack is a `BundledPack` (manifest + inline defs + optional scripts). `enabledLoadedPacks()` feeds the registry; `enabledJsMods()` feeds `JsRuntime`.
- **JS consent is versioned**: `jsConsentVersion` must equal the bundle's current `manifest.version`. Re-importing a new version revokes consent automatically. Treat this as a security boundary.
- `JsRuntime` runs each mod script once with a frozen `ModApi` (`src/mods/ModApi.ts`): `registerWeapon/Enemy/Pickup` push into `runtime.dynamicDefs` (exposed as a synthetic high-priority `LoadedPack` to the registry), and `on(event, handler)` subscribes on the `EventBus` with `source = mod:<packId>` so handlers get disabled individually on throw.

### Editor (`src/editor/`)

`Editor` mirrors the pack structure with tabs per kind. `PropertyGrid.ts` auto-generates a form from the Zod schema for that kind. `LivePreview.ts` instantiates a `Renderer` with a minimal sim (dummy enemy + edited weapon) so stat tweaks are visible immediately. Export writes a `.sobrevivapack.json` bundle via `content/bundle.ts`.

### Persistence (`src/persistence/`)

All localStorage keys are centralized in `Keys.ts` and are versioned (`sobreviva.meta.v1`, etc.). `SaveStore` is a thin typed wrapper. `MetaManager` handles unlock rules and run history.

## Conventions worth knowing

- **Do not use `import type` for runtime values** — `verbatimModuleSyntax` is on, the TS compiler will refuse.
- Components are declared in two halves in `src/game/components/index.ts`: the `interface` at top, the `defineComponent<Interface>("Name")` export at bottom. Keep the two in sync.
- Time units: `dt` in seconds inside systems; `*Ms` fields in ms (cooldowns, lifetimes, timestamps). Don't mix — the difference is load-bearing for the fixed-step loop.
- When adding a new event, extend `GameEvents` in `EventBus.ts` and also add the entry to the `handlers` initializer object (the code relies on every key existing).
- When adding a new def kind, you must touch: schema file in `src/content/schema/`, the discriminated `AnyDef` union, `DefByKind` in `ContentRegistry.ts`, and the editor tabs list in `src/editor/Editor.ts`.
- Pixi v8 API (not v7): use `new Graphics().circle(...).fill(...)`, not `.beginFill/.drawCircle/.endFill`.

## AI workflow

This project uses Claude Code with specialized agents, skills and path-scoped rules. Full plan: `docs/AI_WORKFLOW.md`.

- **Agents** (`.claude/agents/`): `architect-reviewer`, `mod-security-reviewer`, `schema-guardian`, `content-engineer`, `code-reviewer`, `qa-engineer`, `performance-analyst`, `coherence-auditor`, `refactor-coordinator`. Auto-disparam pela descrição ou são invocáveis manualmente.
- **Skills** (`.claude/skills/`): `/new-weapon`, `/new-enemy`, `/new-pickup`, `/new-wave`, `/add-component`, `/add-event`, `/pr-checklist`, `/milestone-status`, `/refactor-content-shape`. Procedimentos repetíveis que sempre leem o schema antes de gerar (resilientes a evolução).
- **Path-scoped rules** (`.claude/rules/`): descrevem **invariantes** (não a forma atual de cada def). Cobrem ECS, content pipeline, mod boundary, editor e Pixi v8.
- **Testes de coerência** (`src/content/__tests__/coherence.test.ts`, `src/content/__tests__/packs-valid.test.ts`): rodam em todo `npm test`. Detectam drift entre schema, packs JSON, editor, e components — falham em CI antes de merge.

### Pontos onde humano sempre confirma antes de executar
- Push para `main`, criação de tag, release.
- Mudança em `src/content/MergePolicy.ts` ou no freeze recursivo de `ContentRegistry`.
- Mudança em `src/mods/JsRuntime.ts` ou no contrato `ModApi`.
- Bump de `schemaVersion` em qualquer Zod schema.
- Modificação da ordem de sistemas em `Game.update`.

### Quando escalar para agentes especializados
- Tocou `src/mods/` ou `EventBus.ts` (quarentena) → invocar `mod-security-reviewer` (não opcional).
- Tocou `MergePolicy.ts`, `ContentRegistry.ts` ou ordem de systems → invocar `architect-reviewer`.
- Adicionou def kind ou alterou schema Zod → invocar `schema-guardian`.
- Tocou hot path (Loop, queries, SpatialGrid, render) com risco de regressão → invocar `performance-analyst`.
