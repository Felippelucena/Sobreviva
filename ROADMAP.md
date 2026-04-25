# SOBREVIVA — Roadmap

Jogo estilo Vampire Survivors, open source, jogável em navegador, com editor in-game e suporte a mods. Portfólio de desenvolvimento web. Stack: **TypeScript + Vite + PixiJS v8 + Zod**.

---

## Status atual

### Concluído

- **M1 — Bootstrap.** Vite + TS + Pixi + Zod configurados. `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`. Hash router stub (`#/play` / `#/editor`).
- **M2 — Core loop + ECS + gameplay base.** Fixed timestep (60Hz, render interpolado). ECS custom (`src/engine/World.ts`). Input WASD, MovementSystem, AISystem, RenderSyncSystem, SpawnSystem em anel. Câmera com smoothing. Spawn acelera com o tempo da run.
- **M3 — Combate.** Health, Hitbox, SpatialGrid, CollisionSystem (player×inimigo com i-frames, projétil×inimigo com pierce), WeaponSystem auto-fire mira no inimigo mais próximo, LifetimeSystem para projéteis, flash de dano, HUD (HP, timer, kills, overlay de game-over).
- **Fundo tilável.** `TilingSprite` 64×64 atrás do mundo, rola com a câmera para transmitir movimento.

### Pendências imediatas

- Validar o jogo rodando no browser (ainda não testei visualmente).
- Nenhum asset de arte ainda — formas coloridas via `Graphics`.

---

## M4 — Data layer

**Objetivo:** extrair conteúdo hardcoded para JSON validado, preparando terreno para editor e mods.

**Entregáveis**

- `src/content/schema/` com schemas Zod para `WeaponDef`, `EnemyDef`, `PickupDef`, `WaveDef`, `CharacterDef`, `MapDef`, `PackManifest`. Todo schema carrega `schemaVersion: 1`.
- `src/content/PackLoader.ts` — fetch + parse + validate.
- `src/content/registry/ContentRegistry.ts` — defs resolvidas, `freeze()`adas, indexadas por id/kind.
- `src/content/MergePolicy.ts` — later-loaded overrides earlier. Scalars/arrays substituem; objetos aninhados deep-merge 1 nível.
- `src/content/packs/base/manifest.json` + arquivos JSON com as stats atuais hardcoded.
- Refatorar `spawnPlayer/spawnEnemy/spawnProjectile` para aceitar `id` e ler do registry em vez de parâmetros literais.
- `SpawnSystem` dirigido por `WaveDef` (`[{ enemyId, startSec, endSec, ratePerSec, burst?, cap? }]`).
- XP orbs (`PickupTag`, `XPOrb`, PickupSystem com magnetização a partir de um raio).
- Level-up queue + modal de escolha (3 upgrades random via `Rng.pick`).
- Vitest + primeiros testes: validação de schema + merge policy.

**Critério de aceite:** adicionar um inimigo novo em `enemies.json` faz ele aparecer no jogo sem recompilar TS.

---

## M5 — Menus + persistência

**Objetivo:** jogo ganha casca de produto.

**Entregáveis**

- `src/ui/MainMenu.ts` — botão começar run, escolher personagem, abrir editor, abrir mods.
- `src/ui/PauseMenu.ts` — ESC pausa, continua/sai.
- `src/ui/RunSummary.ts` — overlay pós-morte com kills, tempo sobrevivido, XP ganho.
- `src/persistence/SaveStore.ts` + `Keys.ts` — localStorage versionado (`sobreviva.meta.v1`, `sobreviva.settings.v1`).
- Seleção de personagem via `CharacterDef` (2–3 personagens com arma inicial distinta).
- Meta-progression simples: unlocks de personagem/arma conforme milestones in-run.
- Conteúdo: 2–3 armas, 3–4 inimigos, 1 mapa.

**Critério de aceite:** player abre o jogo, escolhe personagem, morre, vê summary, volta ao menu, e meta-progression persiste após F5.

---

## M6 — Pipeline de mods (JSON)

**Objetivo:** usuário consegue instalar um pack JSON e ver o conteúdo no jogo.

**Entregáveis**

- `src/mods/ModManager.ts` — lista packs instalados, toggle enable/disable.
- Import de pack via `<input type="file" accept=".sobrevivapack.json,application/json">` ou URL.
- Packs do usuário salvos em `localStorage` (ou IndexedDB se blob > ~1 MB).
- `src/ui/ModsMenu.ts` — lista packs, mostra versão/conflitos, drag-reorder pra prioridade.
- Overlay de packs sobre o base no `ContentRegistry` — merge respeita `priority` + ordem de carregamento.
- Botão "export pack ativo" serializa JSON.

**Critério de aceite:** exportar o base pack, editar um valor no JSON, reimportar como pack de usuário, valor overridado aparece no jogo.

---

## M7 — Editor in-game

**Objetivo:** criar/editar conteúdo sem sair do jogo.

**Entregáveis**

- Rota `#/editor` com `EditorShell.ts` (tabs: weapons, enemies, waves, map).
- `src/editor/PropertyGrid.ts` — form genérico gerado a partir do schema Zod de cada kind.
- `src/editor/routes/WeaponEditor.ts`, `EnemyEditor.ts` — CRUD via PropertyGrid.
- `src/editor/LivePreview.ts` — painel reusando `Renderer` com sim mínima: um dummy enemy + arma editada, tweaks refletem em tempo real.
- Autosave de draft em `localStorage` (`sobreviva.editor.draft.v1`).
- `src/editor/ExportImport.ts` — export do pack em `.sobrevivapack.json` via `Blob + a[download]`.
- `WaveEditor` — timeline de spawns com drag.
- `MapEditor` (último) — grid paint de tiles + marcação de zonas de spawn.

**Critério de aceite:** criar uma arma nova no editor, ajustar stats vendo o preview, exportar o pack, fechar o browser, reimportar, jogar usando a arma.

---

## M8 — Mods JS + polish (MVP portfolio-ready)

**Objetivo:** superfície pública de modding completa e acabamento audiovisual.

**Entregáveis**

- `src/mods/ModApi.ts` — objeto frozen: `registerWeapon/Enemy/Pickup`, `defineBehavior(name, fn)` (referenciável por `behaviorMod` em JSON), `on("tick"|"enemySpawn"|"enemyDeath"|"playerHit"|"levelUp"|"weaponFire", handler)`, `rng`, `world` (só queries + spawn facade), `log`.
- `src/mods/sandbox/LoaderWarning.ts` — modal de consentimento antes de executar JS; consent guardado por pack em `SaveStore`.
- Import dinâmico via `Blob URL` (`import(/* @vite-ignore */ blobUrl)`).
- Error boundary por hook — exceção num mod desliga esse mod até o fim da run, sem quebrar outros.
- `src/content/packs/examples/` — um mod JS demo (ex.: "homing projectile").
- Áudio: `engine/Audio.ts` com `howler` ou Web Audio puro — SFX de tiro, hit, level-up, morte.
- Screen shake, damage numbers, partículas de morte.
- About screen com instruções de distribuição (baixar `dist/`, `npx serve`).
- CI (GitHub Actions): typecheck + test + build em PR.

**Critério de aceite:** repo público tem README coeso, mod JS de exemplo, build de produção rodando em itch.io ou GitHub Pages, gameplay estável por 10 min de run.

---

## Pós-MVP (quando e se fizer sentido)

- **Tauri/Electron wrapper** — bundle desktop com auto-update. Ataca a limitação de ES modules em `file://`.
- **Workshop de mods online** — hosting simples de packs (Supabase/Cloudflare Workers), rating, comentários. Requer backend mínimo; boa peça de fullstack pra portfólio.
- **Multiplayer coop** — rollback netcode ou lockstep simples. Bem ambicioso; bom para vídeo de demo.
- **Achievements + meta-unlock tree** — amplia retenção.
- **Localização** (pt-BR ↔ en).
- **Assets de arte reais** — trocar formas por sprites (free assets ou contratados). Paralaxe de fundo também.
- **Replays + compartilhamento de seed** — requer input determinístico; `Rng` já é seedado, falta persistir a seed da run.

---

## Notas de execução

- Cada milestone termina com build jogável (`npm run build` gera `dist/` limpo).
- Testes chegam no M4 (schemas + merge policy são a primeira lógica que vale testar).
- Plano de arquitetura detalhado fica em `C:\Users\felip\.claude\plans\buzzing-wandering-rabin.md`.
- Próximo passo imediato: validar M1–M3 no navegador; se tudo ok, iniciar M4.
