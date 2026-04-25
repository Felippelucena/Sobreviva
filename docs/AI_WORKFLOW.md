# Plano de Implementação — Workflow com IA (Sobreviva)

> Documento de referência para evoluir o projeto **Sobreviva** com Claude Code e práticas de engenharia profissional. Customizado para a stack `TypeScript + Vite + PixiJS v8 + Zod + Vitest` e para o estado atual do repositório (M5 do `ROADMAP.md`).
>
> **Última atualização:** 2026-04-25
> **Modelo recomendado para o time:** `claude-sonnet-4-6` (codificação) + `claude-opus-4-7` (revisão arquitetural / mods).

---

## Sumário

1. [Diagnóstico atual](#1-diagnóstico-atual)
2. [Princípios do workflow](#2-princípios-do-workflow)
3. [Estrutura de diretórios alvo](#3-estrutura-de-diretórios-alvo)
4. [Fase 1 — Fundação](#fase-1--fundação-semana-1)
5. [Fase 2 — Agentes especializados](#fase-2--agentes-especializados-semana-12)
6. [Fase 3 — Skills e slash commands](#fase-3--skills-e-slash-commands-semana-2)
7. [Fase 4 — Path-scoped rules](#fase-4--path-scoped-rules-semana-23)
8. [Fase 5 — Hooks de automação](#fase-5--hooks-de-automação-semana-3)
9. [Fase 6 — MCP servers](#fase-6--mcp-servers-semana-3)
10. [Fase 7 — CI/CD com GitHub Actions](#fase-7--cicd-com-github-actions-semana-4)
11. [Fase 8 — Documentação pública](#fase-8--documentação-pública-semana-4)
12. [Versionamento e releases](#12-versionamento-e-releases)
13. [Estratégia de QA](#13-estratégia-de-qa)
14. [Code review com IA](#14-code-review-com-ia)
15. [Cronograma e métricas](#15-cronograma-e-métricas-de-sucesso)
16. [Riscos e mitigações](#16-riscos-e-mitigações)
17. [Apêndices](#17-apêndices) — templates prontos de agentes, skills, hooks, CI

---

## 1. Diagnóstico atual

### O que já existe

- **Arquitetura sólida e documentada** — `CLAUDE.md` já cobre routing, ECS, content pipeline, mods, editor e convenções TS estritas.
- **Roadmap claro** — `ROADMAP.md` com M1–M8; M1–M4 concluídos, M5 (menus + persistência) em progresso, M6–M8 pendentes.
- **Stack moderna e estrita** — `tsconfig` com `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `noUnusedLocals/Parameters`.
- **Cobertura de testes inicial** — 9 arquivos `.test.ts`, ~90 casos cobrindo `content/merge`, `content/schema`, `content/bundle`, `engine/EventBus`, `game/AreaDamage`, `game/WeaponSystem`, `mods/Consent`, `mods/ModManager`, `editor/WorkingPack`.
- **Convenção de commits coerente** — formato `tipo(escopo): descrição` (ex.: `refactor(weapon): achata weapon → shots[]`).
- **Foco atual claro** — últimos 7 commits são refactor do sistema de armas (`shots[]`, cadência por shot, AOE instantâneo).

### Lacunas que o workflow vai preencher

| Lacuna | Impacto | Fase |
|---|---|---|
| `.claude/` quase vazio (só `settings.local.json` mínimo) | Cada sessão começa do zero, sem skills/agents/hooks | F1, F2, F3 |
| Sem CI/CD | Regressão não detectada; build pode quebrar em main | F7 |
| Sem `README.md` público | Portfólio invisível; mods/contribuidores sem ponto de entrada | F8 |
| Sem ESLint/Prettier | Estilo divergindo silenciosamente | F1 (opcional) |
| Sem CHANGELOG ou tags semânticas | Sem rastreabilidade de versões | §12 |
| Sem hook que valide pareamento `interface ↔ defineComponent` | Convenção de `components/index.ts` é frágil | F5 |
| Sem validação automática de packs JSON após edição | Erro de schema só aparece em runtime | F5 |
| Sem revisor automatizado para mods JS (boundary de segurança) | Risco crescente conforme M8 se aproxima | F2 |

### Riscos arquiteturais que o workflow precisa proteger

1. **Imutabilidade do `ContentRegistry`** — defs são `Object.freeze` recursivos; gameplay assume isso. Workflow deve impedir mutações.
2. **Ordem de sistemas no `Game.update`** — `input → AI → movement → collision → weapon → pickup → lifetime → spawn`. Reordenar quebra invariantes.
3. **`MergePolicy` deliberadamente "burra"** — escalares/arrays substituem, objetos rasos mergem. Mod authors dependem desse contrato. Mudanças aqui exigem revisão dupla.
4. **Quarentena de handlers** — `EventBus` desabilita handler após 3 throws. Nunca remover essa proteção.
5. **Versionamento de consent JS** — `jsConsentVersion` precisa ser revogado a cada nova versão do bundle. É fronteira de segurança.

---

## 2. Princípios do workflow

### 2.1 Três camadas de IA

```
┌─────────────────────────────────────────────────────────┐
│  CAMADA 1 — PERSISTENTE  (sempre carregada)              │
│  • CLAUDE.md (raiz + path-scoped em .claude/rules/)      │
│  • settings.json (permissões, modelo, hooks)             │
│  → Define como Claude pensa neste projeto                │
├─────────────────────────────────────────────────────────┤
│  CAMADA 2 — SOB DEMANDA  (invocada por contexto)         │
│  • Subagents (.claude/agents/) — contexto isolado        │
│  • Skills / slash commands (.claude/skills/)             │
│  → Procedimentos repetíveis e expertise focada           │
├─────────────────────────────────────────────────────────┤
│  CAMADA 3 — AUTOMAÇÃO  (sem intervenção humana)          │
│  • Hooks (validação local em PreToolUse/PostToolUse)     │
│  • CI (validação remota em PR)                           │
│  → Garante invariantes que não dependem de IA            │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Confiança escalonada por área

Nem todo código tem o mesmo risco. O workflow trata isso explicitamente:

| Área | Autonomia da IA | Mecanismo |
|---|---|---|
| `src/game/factories/`, `public/packs/base/` | **Alta** — IA edita livremente | Permissões abertas, Zod valida em hook |
| `src/game/systems/`, `src/engine/` | **Média** — sugere, humano confirma | Plan mode preferido; revisor obrigatório |
| `src/content/MergePolicy.ts`, `src/content/ContentRegistry.ts` | **Baixa** — mudanças exigem revisão dupla | Path-scoped rule + agente `architect-reviewer` |
| `src/mods/`, `JsRuntime` | **Mínima** — fronteira de segurança | Agente `mod-security-reviewer` obrigatório |

### 2.3 Princípio "humano no loop em pontos críticos"

A IA é assistente, não dono. Cinco pontos onde humano sempre confirma:

1. Push para `main` ou criação de tag/release.
2. Mudança em `MergePolicy.ts` ou na lógica de freeze do registry.
3. Mudança em `JsRuntime.ts` ou no contrato `ModApi`.
4. Bump de `schemaVersion` em qualquer Zod schema.
5. Modificação na ordem de execução de sistemas em `Game.update`.

---

## 3. Estrutura de diretórios alvo

Estado-alvo após todas as fases:

```
D:\2026\Sobreviva\
├── .claude/
│   ├── settings.json                    ← compartilhado (commitado)
│   ├── settings.local.json              ← pessoal (gitignored — já existe)
│   ├── agents/
│   │   ├── architect-reviewer.md
│   │   ├── content-engineer.md
│   │   ├── schema-guardian.md
│   │   ├── mod-security-reviewer.md
│   │   ├── code-reviewer.md
│   │   ├── qa-engineer.md
│   │   └── performance-analyst.md
│   ├── skills/
│   │   ├── new-weapon/SKILL.md
│   │   ├── new-enemy/SKILL.md
│   │   ├── new-pickup/SKILL.md
│   │   ├── new-wave/SKILL.md
│   │   ├── add-component/SKILL.md
│   │   ├── add-event/SKILL.md
│   │   ├── add-system/SKILL.md
│   │   ├── tests-for/SKILL.md
│   │   ├── pr-checklist/SKILL.md
│   │   └── milestone-status/SKILL.md
│   ├── rules/
│   │   ├── ecs-patterns.md              ← paths: src/engine/**, src/game/**
│   │   ├── content-pipeline.md          ← paths: src/content/**
│   │   ├── mod-boundary.md              ← paths: src/mods/**
│   │   ├── editor-conventions.md        ← paths: src/editor/**
│   │   └── pixi-v8.md                   ← paths: src/engine/Renderer.ts, src/ui/**
│   └── hooks/
│       ├── validate-schema.sh
│       ├── validate-component-pair.mjs
│       ├── validate-pack-json.mjs
│       ├── pre-commit-typecheck.sh
│       └── block-destructive.sh
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                       ← typecheck + test + build
│   │   └── deploy-preview.yml           ← opcional: GitHub Pages preview
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
├── docs/
│   ├── AI_WORKFLOW.md                   ← este documento
│   ├── ARCHITECTURE.md                  ← extraído/expandido de CLAUDE.md
│   ├── CONTENT_AUTHORING.md             ← guia de criação de packs
│   ├── MOD_SECURITY.md                  ← consent, boundary, regras
│   └── DEVELOPMENT.md                   ← setup local, debugging
├── CLAUDE.md                            ← já existe (atualizar com @ links)
├── ROADMAP.md                           ← já existe
├── README.md                            ← criar (Fase 8)
├── CONTRIBUTING.md                      ← criar (Fase 8)
├── CHANGELOG.md                         ← criar (Fase 8)
└── (resto do projeto)
```

---

## Fase 1 — Fundação (Semana 1)

**Objetivo:** Claude Code passa a entender o projeto profundamente desde o primeiro turno de cada sessão.

### 1.1 Atualizar `CLAUDE.md`

O `CLAUDE.md` atual já é bom. Adições recomendadas:

```markdown
## Path-scoped rules

Para detalhes que só importam em arquivos específicos, ver:
@.claude/rules/ecs-patterns.md
@.claude/rules/content-pipeline.md
@.claude/rules/mod-boundary.md
@.claude/rules/editor-conventions.md
@.claude/rules/pixi-v8.md

## Workflow com IA

Este projeto usa Claude Code com agentes especializados (`.claude/agents/`),
skills (`.claude/skills/`) e hooks (`.claude/hooks/`).
Plano completo: @docs/AI_WORKFLOW.md

Pontos onde humano sempre confirma antes de executar:
- Push para `main`, criação de tag, release
- Mudança em `src/content/MergePolicy.ts` ou freeze do registry
- Mudança em `src/mods/JsRuntime.ts` ou contrato `ModApi`
- Bump de `schemaVersion` em qualquer Zod schema
- Modificação da ordem de sistemas em `Game.update`
```

### 1.2 Criar `.claude/settings.json` (compartilhado)

Ver template completo em [Apêndice D](#apêndice-d--settingsjson-compartilhado). Pontos-chave:

- **Permissões `allow`** liberais para comandos seguros (`npm run *`, `git status`, `Read(./src/**)`).
- **Permissões `ask`** para `git push *`, `Edit(.env*)`, `Bash(rm *)`.
- **Permissões `deny`** para `Bash(rm -rf *)`, `Read(.env.local)`, leitura de `~/.ssh/**`.
- **`includeCoAuthoredBy: true`** para rastreabilidade.
- **Hooks** referenciando scripts em `.claude/hooks/` (Fase 5).

### 1.3 Manter `.claude/settings.local.json` para overrides pessoais

O arquivo já existe e está correto (gitignored). Use-o para:

- Habilitar modos experimentais (`"defaultMode": "acceptEdits"`).
- Permissões temporárias (ex.: `Bash(npx vitest *)` durante debugging).
- Tokens locais de MCP servers.

### 1.4 Status line custom

Mostra branch, contagem de tokens e custo da sessão. Útil porque o projeto está em fase de muitas iterações curtas.

```bash
# .claude/scripts/status-line.sh
#!/bin/bash
read json
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "—")
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
MODEL=$(echo "$json" | jq -r '.model.display_name // "?"')
COST=$(echo "$json" | jq -r '.cost.total_cost_usd // 0')
printf "🎮 %s [%s±%s] · 💰 \$%.2f\n" "$MODEL" "$BRANCH" "$DIRTY" "$COST"
```

Em `.claude/settings.json`:
```json
{
  "statusLine": {
    "type": "command",
    "command": "$CLAUDE_PROJECT_DIR/.claude/scripts/status-line.sh"
  }
}
```

---

## Fase 2 — Agentes especializados (Semana 1–2)

Sete agentes cobrindo os domínios críticos do projeto. Templates completos em [Apêndice A](#apêndice-a--templates-de-agentes).

### 2.1 Mapa de agentes

| Agente | Modelo | Tools | Quando dispara |
|---|---|---|---|
| **architect-reviewer** | `opus-4-7` | `Read, Grep, Glob` | Mudanças em `src/engine/`, `src/content/Merge*`, `Registry*`, ordem de sistemas |
| **content-engineer** | `sonnet-4-6` | `Read, Edit, Write, Bash(npm run typecheck)` | Criar/editar JSONs em `public/packs/**`, `src/content/schema/` |
| **schema-guardian** | `sonnet-4-6` | `Read, Grep, Edit, Bash(npm test *)` | Adicionar def kind, alterar `AnyDef`, `DefByKind`, schemas Zod |
| **mod-security-reviewer** | `opus-4-7` | `Read, Grep` | Qualquer mudança em `src/mods/`, `JsRuntime.ts`, `ModApi.ts` |
| **code-reviewer** | `sonnet-4-6` | `Read, Grep, Glob, Bash(git diff *)` | Antes de commit/PR; manualmente via `/review` |
| **qa-engineer** | `sonnet-4-6` | `Read, Edit, Write, Bash(npm test *)` | Criar testes para arquivo novo, gerar cenários edge case |
| **performance-analyst** | `opus-4-7` | `Read, Grep, Bash(node --inspect *)` | Loop, queries ECS, `SpatialGrid`, render hot paths |

### 2.2 Princípios de design dos agentes

- **Descrição com gatilho explícito.** Em vez de `"Reviews architecture"`, escrever `"Use proactively when changes touch src/engine/, src/content/MergePolicy.ts, or modify system execution order in Game.update"`.
- **Tools restritas ao mínimo.** `mod-security-reviewer` é read-only — não pode editar código que está auditando.
- **Modelo por criticidade.** Decisões arquiteturais e segurança → `opus-4-7`. Implementação rotineira → `sonnet-4-6`.
- **System prompt com checklist verificável.** O agente deve emitir relatório, não opinião livre.

### 2.3 Exemplo curto: `mod-security-reviewer`

```yaml
---
name: mod-security-reviewer
description: |
  Audits changes in src/mods/, JsRuntime.ts, and ModApi.ts to ensure
  the JS mod boundary stays intact. Use proactively whenever any file
  in src/mods/ is modified, when JS consent versioning changes, or
  when new methods are added to the frozen ModApi surface.
model: claude-opus-4-7
tools: Read, Grep, Glob
---

You audit the mod boundary. Sobreviva treats JS mods as untrusted code
running with versioned user consent. Your job is to verify five invariants
on every change:

1. `ModApi` returned by `createModApi()` MUST be deep-frozen before exposure.
2. `jsConsentVersion` MUST be checked against `manifest.version`; mismatch
   revokes consent silently.
3. Each handler registered via `on(event, fn)` MUST carry `source: mod:<id>`
   so `EventBus.clearBySource` can detach it.
4. The 3-throws-and-quarantine logic in `EventBus` MUST remain intact.
5. No new method on `ModApi` may give mods access to: `localStorage`,
   `window`, `document`, `fetch`, `import()`, or other engine internals
   beyond what is already exposed.

Return a structured report:
- ✅ / ⚠️ / ❌ per invariant with file:line evidence
- Recommended changes (file:line, exact diff sketch)
- Confidence (high / medium / low)

Do not edit files. Read-only audit.
```

---

## Fase 3 — Skills e slash commands (Semana 2)

Dez skills cobrindo as operações repetitivas. Templates em [Apêndice B](#apêndice-b--templates-de-skills).

### 3.1 Mapa de skills

| Skill | Tipo | Função |
|---|---|---|
| `/new-weapon` | Geração | Cria entry em `public/packs/base/weapons.json` seguindo schema atual (`shots[]`) |
| `/new-enemy` | Geração | Cria entry em `enemies.json` |
| `/new-pickup` | Geração | Cria entry em `pickups.json` |
| `/new-wave` | Geração | Cria entry em `waves.json` |
| `/add-component` | Workflow | Adiciona component em `src/game/components/index.ts` (interface + `defineComponent` pareados) |
| `/add-event` | Workflow | Estende `GameEvents` em `EventBus.ts` + adiciona à inicialização de `handlers` |
| `/add-system` | Workflow | Cria novo system em `src/game/systems/`, registra em `Game.update` no slot correto |
| `/tests-for <arquivo>` | QA | Gera testes Vitest para arquivo dado, no padrão `__tests__/` |
| `/pr-checklist` | Revisão | Roda lista de checagens antes de abrir PR |
| `/milestone-status` | Status | Compara último mês de commits contra `ROADMAP.md` e reporta progresso |

### 3.2 Por que skill em vez de agente?

| Critério | Skill | Subagent |
|---|---|---|
| Procedimento curto, com passos claros | ✅ | ❌ (overkill) |
| Tem template/exemplos para reutilizar | ✅ | depende |
| Precisa contexto isolado da conversa | ❌ | ✅ |
| Output longo que polui contexto principal | ❌ | ✅ |
| Quer invocação manual (`/comando`) | ✅ | parcial |

`/new-weapon` é skill (template + 5 passos). `mod-security-reviewer` é agente (audita, retorna relatório, não polui contexto).

### 3.3 Exemplo curto: `/new-weapon`

```yaml
---
name: new-weapon
description: Cria uma nova definição de arma em public/packs/base/weapons.json seguindo o schema atual (shots[], cadência por shot, cooldown na arma)
argument-hint: "<id> [archetype]"
allowed-tools:
  - Read
  - Edit
  - Bash(npm run typecheck)
---

Você vai criar uma arma "$1" (archetype: $2 — opcional, ex.: "shotgun", "smg", "nova").

Passos:

1. **Ler schema atual** — `src/content/schema/weapon.ts` para entender campos exatos.
2. **Ler exemplos** — `public/packs/base/weapons.json` para imitar estilo (Spark, Bacamarte, Metralha).
3. **Criar entry** — adicionar ao array `defs` do arquivo, seguindo:
   - `id: "$1"`, `kind: "weapon"`, `schemaVersion: 1`.
   - `shots[]` (não `volley` — essa camada foi removida em `2cb6531`).
   - `cooldownMs` na arma; cadência (`offsetMs`) por shot dentro de `shots[]`.
   - Sprite via `Graphics` v8 (cor + raio), sem assets.
4. **Validar** — rodar `npm run typecheck`. Se falhar, corrigir antes de prosseguir.
5. **Reportar** — diff resumido + sugerir teste em `src/game/__tests__/WeaponSystem.test.ts`.

Não invente campos novos. Se algo do archetype pedido não cabe no schema,
pare e descreva o gap — o usuário decide se estende o schema ou ajusta o pedido.
```

---

## Fase 4 — Path-scoped rules (Semana 2–3)

Regras curtas (50–150 linhas cada) que carregam **só quando Claude abre arquivos do path correspondente**. Economiza contexto e mantém regras precisas.

### 4.1 `ecs-patterns.md` — paths: `src/engine/**`, `src/game/**`

```markdown
---
description: Convenções de ECS, fixed timestep e ordem de sistemas
---

# ECS — Sobreviva

## Componentes (src/game/components/index.ts)

DOIS BLOCOS por componente, OBRIGATÓRIO sincronizados:

```ts
// Bloco 1 (topo): interface
export interface Position { x: number; y: number; prevX: number; prevY: number }

// Bloco 2 (final): defineComponent<Interface>
export const Position = defineComponent<Position>("Position")
```

Mudar um sem o outro = bug silencioso. Hook `validate-component-pair.mjs`
detecta divergência. Não confiar nele cegamente — confirmar manualmente.

## Sistemas

Plain functions: `(world, ctx) => void`. Sem classes, sem estado interno.
Estado vai em components, ctx é lido (renderer, registry, rng, bus, dt).

`dt` SEMPRE em segundos. Campos `*Ms` em milissegundos. Mistura quebra
fixed-step.

## Ordem em Game.update

```
input → AI → movement → collision → weapon → pickup → lifetime → spawn
```

Esta ordem é load-bearing. `collision` antes de `weapon` garante que
weapon vê hits do tick. `lifetime` antes de `spawn` libera ids antes
de reusar. Mudar = revisão obrigatória pelo agente architect-reviewer.

## Destruição

`world.destroy(id)` é deferida. `world.flushDestroyed()` roda no fim
do tick em `Game.update`. Sistema NUNCA deve assumir que entidade
existe entre ticks sem checar.
```

### 4.2 `content-pipeline.md` — paths: `src/content/**`

Regras críticas:
- Schemas SEMPRE incluem `schemaVersion: 1` literal.
- `MergePolicy` é deliberadamente burra — não adicionar lógica condicional.
- `ContentRegistry` chama `Object.freeze` recursivo; nunca retornar def mutável.
- Adicionar def kind exige tocar 4 lugares (schema, `AnyDef`, `DefByKind`, editor tabs).

### 4.3 `mod-boundary.md` — paths: `src/mods/**`

Regras críticas:
- `ModApi` retornado por `createModApi()` é congelado antes de expor.
- Cada handler registrado tem `source: mod:<packId>`.
- Quarentena de 3 throws no `EventBus` é intocável.
- `jsConsentVersion` revoga consent quando muda.

### 4.4 `editor-conventions.md` — paths: `src/editor/**`

- `PropertyGrid` lê schema Zod e renderiza forms; não duplicar campos manualmente.
- `LivePreview` instancia `Renderer` com sim mínima — não pode usar systems pesados.
- Export é via `content/bundle.ts` (`.sobrevivapack.json`).

### 4.5 `pixi-v8.md` — paths: `src/engine/Renderer.ts`, `src/ui/**`

- API v8: `new Graphics().circle(x,y,r).fill(color)` (chainable).
- NÃO usar v7 API: `beginFill/drawCircle/endFill` são erros silenciosos.
- HUD em DOM (`src/ui/Hud.ts`), não Pixi. Não misturar.

---

## Fase 5 — Hooks de automação (Semana 3)

Hooks rodam localmente e bloqueiam ações antes de causar dano. Cinco hooks essenciais.

### 5.1 `validate-component-pair.mjs` — `PostToolUse` em `Edit(src/game/components/index.ts)`

Verifica que para toda `interface X { ... }` exportada existe um `export const X = defineComponent<X>("X")` correspondente.

```js
#!/usr/bin/env node
// .claude/hooks/validate-component-pair.mjs
import { readFileSync } from 'node:fs'

const input = JSON.parse(readFileSync(0, 'utf8'))
const file = input.tool_input?.file_path
if (!file?.endsWith('components/index.ts')) process.exit(0)

const src = readFileSync(file, 'utf8')
const interfaces = [...src.matchAll(/^export interface (\w+)/gm)].map(m => m[1])
const components = [...src.matchAll(/defineComponent<(\w+)>\("(\w+)"\)/g))].map(m => ({type: m[1], name: m[2]}))

const missing = interfaces.filter(i => !components.find(c => c.type === i && c.name === i))
const mismatched = components.filter(c => c.type !== c.name)

if (missing.length || mismatched.length) {
  const lines = []
  if (missing.length) lines.push(`Interfaces sem defineComponent pareado: ${missing.join(', ')}`)
  if (mismatched.length) lines.push(`defineComponent com nome != tipo: ${mismatched.map(c => `${c.type}/${c.name}`).join(', ')}`)
  console.error(lines.join('\n'))
  process.exit(2) // bloqueia
}
process.exit(0)
```

### 5.2 `validate-pack-json.mjs` — `PostToolUse` em `Edit(public/packs/**/*.json)`

Carrega Zod schema e valida o JSON inteiro. Rejeita commits de packs quebrados.

### 5.3 `validate-schema.sh` — `PostToolUse` em `Edit(src/content/schema/**)`

Roda `npm run typecheck`. Se falhar, bloqueia (exit 2) com mensagem clara.

### 5.4 `pre-commit-typecheck.sh` — `PreToolUse` em `Bash(git commit *)`

```bash
#!/bin/bash
npm run typecheck > /tmp/sobreviva-tc.log 2>&1
if [ $? -ne 0 ]; then
  echo "TypeScript falhou. Não commitar com type errors. Veja:" >&2
  tail -30 /tmp/sobreviva-tc.log >&2
  exit 2
fi
```

### 5.5 `block-destructive.sh` — `PreToolUse` em `Bash`

Bloqueia `rm -rf`, `git push --force` (a menos que prefixado com `safe-push`), `git reset --hard` em branches protegidas. Defesa em profundidade junto com `permissions.deny`.

### 5.6 Hook opcional: `SessionStart` mostrando status do roadmap

```bash
#!/bin/bash
# .claude/hooks/session-context.sh
# Apenas printa contexto, não bloqueia.
echo "📋 Branch: $(git rev-parse --abbrev-ref HEAD)"
echo "🎯 Marco atual: M5 (menus + persistência) — ver ROADMAP.md"
echo "🔥 Foco recente: refactor weapon system → shots[]"
```

---

## Fase 6 — MCP servers (Semana 3)

### 6.1 GitHub MCP

Permite operar PRs, issues e releases sem sair do Claude Code:

```bash
claude mcp add github --scope project
```

Em `.mcp.json` (commitado):

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}" }
    }
  }
}
```

Em `.claude/settings.local.json` (pessoal):
```json
{ "env": { "GITHUB_TOKEN": "ghp_..." } }
```

Casos de uso reais para Sobreviva:
- Abrir issue a partir de bug detectado durante teste manual.
- Criar PR a partir de branch de feature, com descrição preenchida pelo agente `code-reviewer`.
- Listar PRs antigos para limpar.

### 6.2 MCP futuros (M8+)

- **Playwright MCP** — para testes E2E quando a UI ganhar mais profundidade.
- **Sentry MCP** — quando o jogo for publicado, para monitorar erros em prod.

---

## Fase 7 — CI/CD com GitHub Actions (Semana 4)

Resolve a lacuna mais crítica de qualidade. Template completo em [Apêndice E](#apêndice-e--github-actions-workflows).

### 7.1 Workflow principal: `.github/workflows/ci.yml`

Roda em todo PR e push para `develop`/`main`:

1. `npm ci` (cache de `node_modules`).
2. `npm run typecheck`.
3. `npm test` (Vitest one-shot, todos os ~90 cases).
4. `npm run build` (Vite + tsc).
5. Upload de bundle como artefato (debugging).

Tempo esperado: ~2 min para o repo atual.

### 7.2 Workflow opcional: deploy preview

Quando merge em `develop`, publica em GitHub Pages na URL `https://felippelucena.github.io/Sobreviva/`. Permite validar visualmente sem npm run dev local.

### 7.3 Branch protection rules

Configurar no GitHub:
- `main` exige PR + status check `ci.yml` passando.
- `develop` exige status check (PR opcional para velocidade).
- Merge bloqueado se há commit não verificado.

### 7.4 Integração com workflow IA

O `code-reviewer` agent rodando localmente complementa o CI:
- Local: revisão semântica (lógica, arquitetura, convenções).
- CI: gates objetivos (typecheck, testes, build).

Se ambos passam, PR pronto para merge.

---

## Fase 8 — Documentação pública (Semana 4)

### 8.1 `README.md`

Conteúdo mínimo (criar quando houver pelo menos uma screenshot animada):

```markdown
# Sobreviva

Jogo de browser estilo Vampire Survivors, com **editor in-game** e **pipeline de mods**.

[GIF/screenshot]

## Stack
TypeScript · Vite · PixiJS v8 · Zod · Vitest

## Rodar local
\`\`\`bash
npm install
npm run dev   # :5173
\`\`\`

## Documentação
- [Arquitetura](docs/ARCHITECTURE.md)
- [Criando packs de conteúdo](docs/CONTENT_AUTHORING.md)
- [Mods JS — segurança](docs/MOD_SECURITY.md)
- [Roadmap](ROADMAP.md)

## Contribuir
Ver [CONTRIBUTING.md](CONTRIBUTING.md).
```

### 8.2 `CONTRIBUTING.md`

Cobrir:
- Setup local (node version, scripts).
- Convenções de commit (`tipo(escopo): descrição`).
- Branches: `develop` é integração; PR vai pra `develop`; `main` recebe via merge controlado.
- Como rodar agentes/skills (`/new-weapon`, `/pr-checklist`).
- Como adicionar def kind (4 lugares).

### 8.3 `docs/ARCHITECTURE.md`

Versão expandida do `CLAUDE.md`, com:
- Diagrama do loop fixed-step + interpolation.
- Diagrama do content pipeline (JSON → Zod → Registry → gameplay).
- Diagrama da boundary de mods.
- Decisões registradas (por que MergePolicy é burra, por que freeze recursivo).

### 8.4 `docs/CONTENT_AUTHORING.md`

Para autores de packs (humanos ou via `/new-weapon`):
- Formato de manifest.
- Cada def kind com schema completo e exemplo.
- `MergePolicy`: como override funciona (já que isso é o que mod authors precisam saber).
- Como testar pack localmente via Editor (`#/editor`).
- Como exportar `.sobrevivapack.json`.

### 8.5 `docs/MOD_SECURITY.md`

Para autores de mods JS:
- O que `ModApi` expõe (lista exaustiva).
- O que NÃO expõe (e por quê).
- `jsConsentVersion`: quando troca, consent revoga.
- Quarentena de 3 throws.
- Como debugar mod.

---

## 12. Versionamento e releases

### 12.1 SemVer + Conventional Commits

Já está usando conventional commits (`refactor(weapon):`, `fix(weapon):`). Formalizar:

| Tipo | Bump | Exemplo |
|---|---|---|
| `feat(*)` | minor | `feat(weapon): rajadas configuráveis` |
| `fix(*)` | patch | `fix(weapon): AOE instantâneo` |
| `refactor(*)` | patch (em geral) | `refactor(weapon): achata weapon → shots[]` |
| `feat!:` ou `BREAKING CHANGE:` no body | major | quebra de schema |

### 12.2 `CHANGELOG.md`

Mantido manualmente ou gerado por `conventional-changelog`. Sugestão: gerar via skill `/release-notes` que lê `git log` desde a última tag.

### 12.3 Tags e releases no GitHub

```
v0.1.0  ← bootstrap (M1)
v0.4.0  ← M4 done (data layer)
v0.5.0  ← M5 done (menus + persistência)
...
v1.0.0  ← M8 done (mods JS + polish)
```

Cada tag dispara release no GitHub com:
- Notas extraídas do CHANGELOG.
- Bundle de produção (Vite build) anexado.
- Demo player jogável publicada em GitHub Pages.

### 12.4 `schemaVersion` ≠ versão do projeto

Pacote do projeto pode ir para `v0.5.0` sem mexer em `schemaVersion: 1` dos defs. Schema só sobe quando muda formato do JSON de pack — e isso exige migração de packs antigos (importante quando houver mods da comunidade).

---

## 13. Estratégia de QA

### 13.1 Pirâmide de testes para Sobreviva

```
        E2E (1-2 cenários)         ← M8
       /                  \
   Integration (5-10)            ← M5-M6 (pack loader, registry, mod load)
  /                       \
 Unit (~90 atual + crescer)     ← contínuo
```

### 13.2 Cobertura por camada

| Camada | Cobertura alvo | Estratégia |
|---|---|---|
| `src/content/` | 90%+ | Testes de schema, merge, bundle (já tem ~60%) |
| `src/engine/EventBus.ts` | 100% | Já coberto; manter |
| `src/engine/World.ts` | 80%+ | Adicionar testes de query, destruction deferida |
| `src/game/systems/` | 70%+ | Cada sistema com pelo menos 1 happy + 1 edge |
| `src/mods/` | 90%+ | Consent, freeze, source tagging — fronteira de segurança |
| `src/editor/` | 50%+ | Smoke tests; UI varia |
| `src/ui/` | baixa | Smoke; dependem de DOM real |

### 13.3 Tipos de teste por situação

- **Unit**: lógica pura (`MergePolicy`, factories, schemas). 80% dos testes.
- **Integration**: `PackLoader → Registry → query`, `ModManager → JsRuntime → handler`. 15%.
- **Property-based** (com `fast-check`): `MergePolicy` é candidato perfeito — propriedade "merge é associativo dentro de mesmo kind". 5%.
- **E2E** (Playwright, M8+): rodar uma run completa, verificar screen `summary`. Apenas 1–2 cenários.

### 13.4 Skill `/tests-for <arquivo>`

Gera scaffold de teste seguindo o padrão `__tests__/`. Inclui:
- Imports corretos do Vitest.
- `describe` + `it` no estilo do projeto.
- Mocks mínimos (não usar `vi.mock` para módulos do projeto — preferir injeção via parâmetro).
- 1 happy path + 2 edge cases sugeridos.

### 13.5 Cobertura via Vitest

Adicionar a `package.json`:
```json
"test:coverage": "vitest run --coverage"
```

Configurar threshold em `vite.config.ts`:
```ts
test: {
  coverage: {
    provider: 'v8',
    thresholds: { lines: 70, functions: 70, branches: 60, statements: 70 }
  }
}
```

---

## 14. Code review com IA

### 14.1 Três níveis de review

| Nível | Quando | Quem |
|---|---|---|
| **Self-review** | Antes de cada commit | Skill `/pr-checklist` (lista) |
| **Local AI review** | Antes de `git push` | Agente `code-reviewer` (semântico) |
| **CI review** | No PR | GitHub Actions (objetivo) |

Mudanças críticas (mod boundary, MergePolicy, system order) também passam por agentes especializados (`mod-security-reviewer`, `architect-reviewer`).

### 14.2 Skill `/pr-checklist`

```markdown
## Antes de abrir PR

- [ ] `npm run typecheck` passa
- [ ] `npm test` passa
- [ ] `npm run build` passa
- [ ] Commits seguem `tipo(escopo): descrição`
- [ ] Se tocou em `src/content/schema/` → bumped `schemaVersion`? (ou justificou no PR body)
- [ ] Se adicionou def kind → editou os 4 lugares (schema, AnyDef, DefByKind, editor tabs)?
- [ ] Se adicionou event → estendeu `GameEvents` E adicionou ao initializer de `handlers`?
- [ ] Se adicionou system → registrou em `Game.update` no slot correto?
- [ ] Tocou em `src/mods/`? → rodou agente `mod-security-reviewer`?
- [ ] Tocou em `src/content/MergePolicy.ts`? → rodou `architect-reviewer`?
- [ ] Mudança quebra packs antigos? → bumped major OU adicionou migração?
```

### 14.3 Agente `code-reviewer`

Roda `git diff main...HEAD` e revisa:
- Convenções (import type, time units, `source:` em events).
- Padrões do projeto (factories vs systems, DOM vs Pixi).
- Riscos detectados (mutação de def, ordem de systems, novos campos sem schema).
- Sugestões de teste (qual arquivo `__tests__/` precisa entry).

Output: relatório markdown com 🟢/🟡/🔴 por categoria.

### 14.4 `/ultrareview` para mudanças grandes

Comando nativo do Claude Code (multi-agente cloud). Use para:
- Refactor que toca >5 arquivos em domínios diferentes.
- Mudança em `MergePolicy` ou `ContentRegistry`.
- Bump de `schemaVersion`.
- Antes de cortar release tag.

---

## 15. Cronograma e métricas de sucesso

### 15.1 Cronograma sugerido (4 semanas)

| Semana | Fases | Saída concreta |
|---|---|---|
| **1** | F1 (fundação) + início F2 | `.claude/settings.json` + `CLAUDE.md` atualizado + 3 agentes (architect, content-engineer, schema-guardian) |
| **2** | F2 conclusão + F3 + F4 | 7 agentes + 10 skills + 5 rules path-scoped |
| **3** | F5 (hooks) + F6 (MCP) | 5 hooks ativos + GitHub MCP integrado |
| **4** | F7 (CI) + F8 (docs) | `ci.yml` rodando em PRs + README + CONTRIBUTING + 3 docs em `docs/` |

Não é linear — F2/F3 podem ser feitos em paralelo. F8 pode esperar até ter primeira screenshot de gameplay.

### 15.2 Métricas de sucesso

| Métrica | Baseline (hoje) | 1 mês |
|---|---|---|
| Tempo do "intent → PR aberto" | manual, ~30min | ~10min com `/new-weapon` + `/pr-checklist` |
| Bugs introduzidos por refactor | depende | →0 com agente architect-reviewer + hooks |
| Cobertura de testes | ~? | 70%+ em camadas críticas |
| PRs com CI verde no primeiro push | n/a | 80%+ |
| Mudanças em `src/mods/` revisadas pelo agente | 0% | 100% |
| Tempo médio de onboarding (novo contribuidor → primeiro PR) | n/a | <1h com README + CONTRIBUTING |

### 15.3 Como saber se está dando certo

- Você consegue criar uma arma nova em <5min via `/new-weapon`.
- PR descritivo é gerado pelo `code-reviewer` em vez de escrito à mão.
- Hook bloqueou pelo menos um bug real (component sem par, schema quebrado).
- CI flagrou pelo menos um typecheck que escapou local.
- Qualquer outro humano consegue clonar, rodar `npm install && npm run dev` e ver o jogo.

---

## 16. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| **Sobreengenharia** — implementar tudo antes de validar valor | Cronograma faseado; cada fase entrega valor isolado. Pular F6/F8 se não há retorno. |
| **Hooks lentos** quebrando flow (typecheck a cada edit) | Hooks só em paths específicos; typecheck pesado fica em `pre-commit`, não `post-edit`. |
| **Agente sugerindo mudança fora de escopo** | System prompt restritivo (`Do not edit files. Audit only.`); revisor humano antes de aplicar. |
| **Skills divergindo do schema real** quando schema evolui | Skill referencia `@src/content/schema/<kind>.ts`; sempre lê schema antes de gerar. |
| **`settings.json` compartilhado quebra para outro dev** | Tudo específico de máquina vai em `settings.local.json`; CI valida que `.claude/settings.json` é portável. |
| **Auditoria de mod virando teatro** | `mod-security-reviewer` retorna relatório estruturado; checklist verificável, não opinião livre. |
| **Documentação envelhecendo** | Skills são fonte da verdade para procedures; docs apenas links. CLAUDE.md inline com `@` imports. |
| **CI falso-positivo bloqueando merge** | Branch protection começa permissiva; aperta após 2 semanas de baseline estável. |

---

## 17. Apêndices

### Apêndice A — Templates de agentes

#### A.1 `architect-reviewer`

```yaml
---
name: architect-reviewer
description: |
  Reviews architectural changes for invariant violations. Use proactively
  whenever changes touch src/engine/, src/content/MergePolicy.ts,
  src/content/ContentRegistry.ts, the order of systems in Game.update,
  or any *.ts file that exports schemaVersion.
model: claude-opus-4-7
tools: Read, Grep, Glob
---

You are the architect of Sobreviva. Your job is NOT to write code — it is
to detect when a proposed change violates an architectural invariant.

## Invariants you must protect

1. **Loop integrity** — `Loop` runs update at FIXED_DT (60Hz) with bounded
   catch-up. Any change to `Loop.ts`, `Game.update`, or system signatures
   that affects timing must preserve fixed-step semantics.

2. **System order** — `input → AI → movement → collision → weapon →
   pickup → lifetime → spawn`. Reordering breaks invariants (collision
   before weapon, lifetime before spawn). Flag any reorder.

3. **Component immutability shape** — every component declared as
   `interface X` at top of components/index.ts MUST have matching
   `defineComponent<X>("X")` at bottom. No partial declarations.

4. **Time unit purity** — `dt` in seconds, `*Ms` in milliseconds. Mixing
   = silent fixed-step bug. Flag any `dt * 1000` or `ms / 1000` outside
   of explicit conversion utility.

5. **Registry freeze** — `ContentRegistry` deep-freezes defs. Gameplay
   code MUST treat defs as readonly. Flag any `def.x = ...` or shallow
   freeze that bypasses recursion.

6. **MergePolicy contract** — scalars/arrays REPLACE; plain objects merge
   shallow at depth 1. No conditional logic, no smart deep merge. Flag
   any change to MergePolicy that adds branching beyond this contract.

7. **EventBus quarantine** — handler that throws 3 times is auto-disabled.
   This protects mods from killing the run. Flag any change that removes
   or weakens this.

## Output format

Return a structured report:

```
🏛️ ARCHITECT REVIEW — <branch> @ <hash>

✅ Invariants preserved: [list]
⚠️ Concerns: [list with file:line + suggested fix]
❌ Violations: [list with file:line + required fix]

Verdict: SAFE TO MERGE | NEEDS CHANGES | MUST DISCUSS
Confidence: high | medium | low
```

You do NOT edit files. You audit and report.
```

#### A.2 `content-engineer`

```yaml
---
name: content-engineer
description: |
  Authors and edits content definitions (weapons, enemies, pickups, waves,
  characters, maps) in public/packs/base/*.json following the active Zod
  schemas. Use when the user asks to add or modify game content.
model: claude-sonnet-4-6
tools: Read, Edit, Write, Bash(npm run typecheck)
---

You author content. Your output is JSON that survives `Zod.parse` and
`MergePolicy.merge` without surprises.

## Process for any new def

1. Read the relevant schema in src/content/schema/<kind>.ts. If you don't
   read it first, you'll invent fields that don't exist.
2. Read at least 2 existing entries in public/packs/base/<kind>s.json to
   match style (id format, sprite shape, default values).
3. Compose the entry. Required: id, kind, schemaVersion: 1.
4. Validate: run `npm run typecheck`. If it fails, fix before reporting.
5. Suggest one test in src/<area>/__tests__/ that exercises the new content.

## Constraints

- Never invent schema fields. If the user asks for behavior the schema
  doesn't support, STOP and report the gap. The user decides whether to
  extend the schema (which triggers schema-guardian agent).
- Sprites are Pixi v8 Graphics (color + radius/shape). No texture paths
  yet — assets come in M8.
- Match existing naming: ids in kebab-case, single-word preferred.
- Time fields named *Ms are milliseconds. dt-related fields are seconds.

## When to defer

- New def kind needed → defer to schema-guardian.
- Behavior requires new component or system → defer to user (ECS work,
  not content work).
- Mod bundle export → defer to /export-bundle skill.
```

#### A.3 `schema-guardian`

```yaml
---
name: schema-guardian
description: |
  Owns Zod schemas in src/content/schema/. Use when adding a new def kind,
  extending an existing schema, or bumping schemaVersion. Coordinates the
  4-place change (schema, AnyDef union, DefByKind map, editor tabs).
model: claude-sonnet-4-6
tools: Read, Edit, Grep, Glob, Bash(npm run typecheck), Bash(npm test *)
---

You evolve the type system that protects the content pipeline.

## When schema changes are safe

- Adding optional field with default → patch (no migration needed).
- Adding new def kind → minor (touches 4 places below, no migration).
- Removing a field, renaming a field, changing required/optional →
  major (bump schemaVersion AND write migration in src/content/migrations/).

## The 4-place rule for new def kinds

1. `src/content/schema/<kind>.ts` — Zod schema with `schemaVersion: z.literal(1)`.
2. `src/content/schema/index.ts` — add to `AnyDef` discriminated union.
3. `src/content/ContentRegistry.ts` — add to `DefByKind` map.
4. `src/editor/Editor.ts` — add tab for the new kind.

Touch all 4 in the same commit. Run `npm run typecheck && npm test` to
verify.

## Output

Diff sketch for each of the 4 files + test plan + verdict on whether
schemaVersion needs bumping.
```

#### A.4 `mod-security-reviewer` — ver §2.3 acima.

#### A.5 `code-reviewer`

```yaml
---
name: code-reviewer
description: |
  Reviews the diff between current branch and main before commit/push.
  Use proactively before opening PR, or manually via /review.
model: claude-sonnet-4-6
tools: Read, Grep, Glob, Bash(git diff *), Bash(git log *)
---

You review code like a senior teammate who has read CLAUDE.md and
ROADMAP.md and cares about not breaking invariants.

## Process

1. Run `git diff main...HEAD` to see all changes on the branch.
2. Group changes by area (engine, content, mods, editor, ui, tests).
3. For each area, check against the rules in .claude/rules/<area>.md.
4. Detect:
   - `import type` violations (verbatimModuleSyntax)
   - Time unit mixing (dt vs *Ms)
   - Missing `source:` in event registration
   - Defs being mutated (must be readonly)
   - System order changes
   - New schemaVersion without migration
   - Test files missing for new modules

## Output

```
🔍 CODE REVIEW — <branch>

🟢 Strengths: [things done well, brief]
🟡 Suggestions: [non-blocking improvements]
🔴 Blockers: [must fix before merge]
🧪 Test gaps: [files that need __tests__/]

Verdict: APPROVE | REQUEST CHANGES | NEEDS DISCUSSION
```
```

#### A.6 `qa-engineer`

```yaml
---
name: qa-engineer
description: |
  Designs and writes Vitest tests. Use when adding tests for a new module,
  improving coverage of an existing one, or designing edge cases for a
  refactor. Invokable manually or via /tests-for skill.
model: claude-sonnet-4-6
tools: Read, Edit, Write, Bash(npm test *), Glob, Grep
---

You write tests that catch real bugs. You don't write tests that just
hit lines.

## Test design heuristics

- 1 happy path test per public function.
- Edge cases that matter: empty inputs, single element, boundary values
  (0, -1, MAX), null/undefined where allowed, concurrency (events
  during destruction, etc.).
- For systems: spawn a minimal world, run system, assert state change.
  Don't mock world — use real `World` from src/engine/World.ts.
- For schemas: parse valid + invalid examples, snapshot when stable.
- For MergePolicy: pure-functional, property-based candidate (associativity
  within kind, identity with empty pack).

## Anti-patterns

- Don't `vi.mock()` project modules — pass dependencies as params.
- Don't test private state — test observable behavior.
- Don't write `expect(x).toBe(x)` — verify your assertion is non-trivial.
- One concept per test. If the it() title has "and", split it.

## Output

Edit/create file in src/<area>/__tests__/, run `npm test`, report:
- Tests added: count
- Tests passing: count
- Coverage delta if visible
```

#### A.7 `performance-analyst`

```yaml
---
name: performance-analyst
description: |
  Profiles hot paths in the game loop, ECS queries, SpatialGrid, and Pixi
  rendering. Use when frame time spikes, when adding entity-heavy systems,
  or before milestones (M5/M8) to ensure 60fps with N enemies.
model: claude-opus-4-7
tools: Read, Grep, Glob, Bash(npm run dev), Bash(node --inspect *)
---

You are the performance conscience. Sobreviva targets 60fps with hundreds
of entities. You catch O(n²) patterns, allocations in hot paths, and Pixi
draw call explosions before they become regressions.

## Hot paths to watch

- `Loop.tick` — runs at 60Hz. Anything called per-tick is hot.
- `World.query` — iterates smallest store; should be O(matching entities).
- `collisionSystem` + `SpatialGrid` — pairs check is the classic pitfall.
- `weaponSystem` — fires projectiles; allocation per shot adds up.
- `renderSyncSystem` — runs at rAF; touches every visible entity.
- Pixi `Graphics` rebuild — recreating Graphics each frame = GC pressure.

## What to look for

- Allocations in inner loops (`new Vec2`, array literals, object literals).
- Hidden O(n²): nested `for` over same query, `array.find` inside loop.
- Pixi `removeChild` + `addChild` thrash; prefer setVisible.
- EventBus emits inside tight loops without buffer.
- `spatialGrid.rebuild()` more than once per tick.

## Output

```
⚡ PERFORMANCE REPORT

Hot path: <name>
Issue: <O(n²) pair check on collisionSystem:42>
Cost estimate: ~N enemies × M projectiles per tick = ~N*M ops
Suggested fix: <use SpatialGrid.queryNeighbors at line X>
Confidence: high (measured) | medium (heuristic) | low (suspicion)
```
```

### Apêndice B — Templates de skills

#### B.1 `/new-weapon` — ver §3.3 acima.

#### B.2 `/add-component`

```yaml
---
name: add-component
description: Adiciona um novo component em src/game/components/index.ts no padrão duplo (interface + defineComponent), de forma consistente.
argument-hint: "<NomeDoComponent>"
allowed-tools:
  - Read
  - Edit
  - Bash(npm run typecheck)
---

Adicionar component "$1" a src/game/components/index.ts.

Passos:

1. Ler `src/game/components/index.ts` inteiro para entender ordem (interfaces no topo, defineComponent no fim).
2. Adicionar interface no bloco superior, ordenado alfabeticamente:
   ```ts
   export interface $1 {
     // campos sugeridos pelo usuário
   }
   ```
3. Adicionar defineComponent no bloco inferior, mesma posição alfabética:
   ```ts
   export const $1 = defineComponent<$1>("$1")
   ```
4. Rodar `npm run typecheck`.
5. Reportar: confirmar que hook `validate-component-pair.mjs` aprovou; sugerir 1 sistema candidato a consumir o component.

NÃO adicione lógica nos sistemas — apenas o component. Lógica é decisão separada.
```

#### B.3 `/add-event`

```yaml
---
name: add-event
description: Estende GameEvents em src/engine/events/EventBus.ts (tipo + entrada no initializer de handlers), seguindo o contrato do bus.
argument-hint: "<NomeDoEvento> <PayloadType>"
allowed-tools:
  - Read
  - Edit
  - Bash(npm run typecheck)
  - Bash(npm test src/engine/__tests__/EventBus.test.ts)
---

Adicionar evento "$1" com payload "$2" a EventBus.

Passos:

1. Ler `src/engine/events/EventBus.ts` para ver `GameEvents` e o initializer de `handlers`.
2. Adicionar entrada em `GameEvents`:
   ```ts
   $1: $2
   ```
3. Adicionar entrada em handlers initializer (o código depende de toda chave existir):
   ```ts
   $1: [],
   ```
4. Rodar `npm run typecheck` + `npm test src/engine/__tests__/EventBus.test.ts`.
5. Sugerir 1 emit() candidato e 1 handler candidato (mas NÃO implementar — fica para o usuário).

Lembre que handlers que registrarem este evento DEVEM passar `source: ...` para permitir clearBySource em mod unload.
```

#### B.4 `/pr-checklist` — ver §14.2.

#### B.5 `/milestone-status`

```yaml
---
name: milestone-status
description: Compara últimos 30 dias de commits contra ROADMAP.md e reporta progresso por milestone (M1-M8).
allowed-tools:
  - Read
  - Bash(git log --since=*)
  - Bash(git diff --stat *)
---

Análise de progresso de roadmap.

Passos:

1. Ler ROADMAP.md para extrair lista de milestones e sub-itens.
2. Executar `git log --since="30 days ago" --oneline` para listar commits recentes.
3. Executar `git diff --stat $(git log --since="30 days ago" --reverse --pretty=format:"%H" | head -1)..HEAD` para ver arquivos tocados.
4. Mapear cada commit a um sub-item do ROADMAP (best-effort por escopo do commit: weapon → M3/M4/M5; menu → M5; mod → M6/M8).
5. Reportar:
   ```
   📊 PROGRESSO ÚLTIMOS 30 DIAS

   M5 (menus + persistência) — em progresso
   ✅ Concluído: ...
   🔄 Em andamento: ...
   ⏳ Pendente: ...

   Marcos não tocados: M6, M7, M8

   Sugestão de próximo foco: <item mais maduro do M5>
   ```

Não modifica nenhum arquivo.
```

### Apêndice C — Hooks scripts

#### C.1 `validate-component-pair.mjs` — ver §5.1.

#### C.2 `validate-pack-json.mjs`

```js
#!/usr/bin/env node
// .claude/hooks/validate-pack-json.mjs
// PostToolUse hook: valida JSON de pack contra schema Zod após edição.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const input = JSON.parse(readFileSync(0, 'utf8'))
const file = input.tool_input?.file_path ?? input.tool_input?.path
if (!file?.match(/public\/packs\/.+\.json$/)) process.exit(0)

// Roda script Node minimo que importa Zod e valida o arquivo.
// (Em projeto real, ter um src/scripts/validate-pack.ts e chamar via tsx.)
const result = spawnSync('npx', ['tsx', 'src/scripts/validate-pack.ts', file], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
})

if (result.status !== 0) {
  console.error(`Pack JSON inválido em ${file}:\n${result.stderr || result.stdout}`)
  process.exit(2)
}
process.exit(0)
```

> Requer criar `src/scripts/validate-pack.ts` que faz `PackFile.parse(JSON.parse(readFileSync(file)))`.

#### C.3 `pre-commit-typecheck.sh` — ver §5.4.

#### C.4 `block-destructive.sh`

```bash
#!/bin/bash
# .claude/hooks/block-destructive.sh
# PreToolUse on Bash. Bloqueia comandos com alto blast radius.
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

case "$COMMAND" in
  *"rm -rf "*|*"rm -fr "*)
    echo "Comando rm -rf bloqueado por hook. Para limpar artefatos, use scripts npm ou aprove via permissions.local." >&2
    exit 2 ;;
  *"git push --force "*|*"git push -f "*)
    if [[ "$COMMAND" != *"safe-push"* ]]; then
      echo "git push --force bloqueado. Use --force-with-lease ou prefixe com 'safe-push' (custom)." >&2
      exit 2
    fi ;;
  *"git reset --hard "*"main"*|*"git reset --hard "*"develop"*)
    echo "git reset --hard em branch protegida bloqueado." >&2
    exit 2 ;;
esac
exit 0
```

### Apêndice D — `settings.json` compartilhado

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",

  "model": "claude-sonnet-4-6",
  "includeCoAuthoredBy": true,

  "permissions": {
    "allow": [
      "Bash(npm install)",
      "Bash(npm ci)",
      "Bash(npm run dev)",
      "Bash(npm run build)",
      "Bash(npm run typecheck)",
      "Bash(npm run preview)",
      "Bash(npm test *)",
      "Bash(npm run test:watch)",
      "Bash(npx vitest *)",
      "Bash(npx tsc --noEmit)",
      "Bash(git status)",
      "Bash(git status *)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(git add *)",
      "Bash(git commit -m *)",
      "Bash(git checkout *)",
      "Bash(git switch *)",
      "Bash(git branch *)",
      "Bash(git stash *)",
      "Bash(git merge *)",
      "Bash(git rebase --continue)",
      "Bash(node *)",
      "Read(./src/**)",
      "Read(./public/**)",
      "Read(./docs/**)",
      "Read(./.claude/**)",
      "Read(./.github/**)",
      "Read(./*.md)",
      "Read(./*.json)",
      "Read(./*.ts)",
      "Edit(./src/**)",
      "Edit(./public/packs/**)",
      "Edit(./docs/**)",
      "Edit(./.claude/agents/**)",
      "Edit(./.claude/skills/**)",
      "Edit(./.claude/rules/**)",
      "WebFetch(domain:github.com)",
      "WebFetch(domain:pixijs.com)",
      "WebFetch(domain:vitest.dev)",
      "WebFetch(domain:vitejs.dev)",
      "WebFetch(domain:zod.dev)"
    ],
    "ask": [
      "Bash(git push *)",
      "Bash(git tag *)",
      "Bash(npm publish *)",
      "Edit(.env)",
      "Edit(.env.local)",
      "Edit(./.claude/settings.json)",
      "Edit(./.claude/hooks/**)",
      "Edit(./CLAUDE.md)",
      "Edit(./ROADMAP.md)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(rm -fr *)",
      "Bash(curl * | sh)",
      "Bash(curl * | bash)",
      "Bash(:(){ :|:& };:)",
      "Read(./.env)",
      "Read(./.env.local)",
      "Read(~/.ssh/**)",
      "Read(~/.aws/**)"
    ]
  },

  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/block-destructive.sh" }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/pre-commit-typecheck.sh" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/validate-component-pair.mjs" }
        ]
      },
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/validate-pack-json.mjs" }
        ]
      }
    ]
  },

  "statusLine": {
    "type": "command",
    "command": "$CLAUDE_PROJECT_DIR/.claude/scripts/status-line.sh"
  }
}
```

### Apêndice E — GitHub Actions workflows

#### E.1 `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Test
        run: npm test

      - name: Build
        run: npm run build

      - name: Upload bundle artifact
        if: github.event_name == 'pull_request'
        uses: actions/upload-artifact@v4
        with:
          name: dist-${{ github.sha }}
          path: dist/
          retention-days: 7
```

#### E.2 `.github/workflows/deploy-preview.yml` (opcional, M5+)

```yaml
name: Deploy Preview to GitHub Pages

on:
  push:
    branches: [develop]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

> Requer adicionar a `vite.config.ts`: `base: process.env.GITHUB_ACTIONS ? '/Sobreviva/' : '/'`

#### E.3 `.github/PULL_REQUEST_TEMPLATE.md`

```markdown
## O que muda
<!-- Resumo em 2-3 linhas, focado no porquê. -->

## Tipo
- [ ] feat
- [ ] fix
- [ ] refactor
- [ ] docs
- [ ] chore
- [ ] BREAKING (bump major / schemaVersion)

## Áreas tocadas
- [ ] engine
- [ ] content (schemas / packs)
- [ ] mods (boundary — exige review extra)
- [ ] editor
- [ ] ui
- [ ] testes
- [ ] CI / config

## Checklist
- [ ] `npm run typecheck` passa
- [ ] `npm test` passa
- [ ] `npm run build` passa
- [ ] Convenções de commit (`tipo(escopo): descrição`)
- [ ] Se tocou `src/content/schema/` → schemaVersion bumped (ou justificado)
- [ ] Se adicionou def kind → 4 lugares atualizados (schema, AnyDef, DefByKind, editor tabs)
- [ ] Se adicionou event → estendi GameEvents E o initializer de handlers
- [ ] Se tocou mods/JsRuntime → rodei agente `mod-security-reviewer`
- [ ] Se tocou MergePolicy/ContentRegistry → rodei agente `architect-reviewer`

## Como testar
<!-- Passos para validar localmente. -->

## Screenshots/GIF
<!-- Para mudanças visuais. -->
```

---

## Próximos passos imediatos

Se quiser começar agora, a ordem mínima de valor é:

1. **Criar `.claude/settings.json`** (Apêndice D) — habilita permissões e hooks.
2. **Criar agente `code-reviewer`** (Apêndice A.5) — passa a revisar PRs locais.
3. **Criar skill `/new-weapon`** (§3.3) — acelera o trabalho atual em weapon system.
4. **Criar `.github/workflows/ci.yml`** (Apêndice E.1) — fecha a maior lacuna de qualidade.

Esses quatro entregam ~70% do valor do plano em meio dia de trabalho. As outras fases incrementam a partir daí.

---

**Documento mantido por:** Felippe Lucena · **Stack:** TypeScript · Vite · PixiJS v8 · Zod · Vitest · **Licença:** mesmo do projeto
