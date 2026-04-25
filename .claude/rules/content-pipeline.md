---
description: Convenções estruturais da content pipeline. Invariantes do contrato schema↔packs↔registry↔consumidores. NÃO duplica a forma específica de cada def — leia o schema.
paths:
  - "src/content/**"
  - "public/packs/**"
---

# Content Pipeline — Sobreviva

> Para a forma exata de um def (`weapon`, `enemy`, `pickup`, `wave`, `character`, `map`), leia `src/content/schema/<kind>.ts`. Esta rule descreve invariantes do **contrato**, não da forma. Schema evolui; invariantes não.

## Hot path

```
JSON em disco
  → PackLoader (fetch + Zod parse + duplicate check + wave validation)
  → MergePolicy (sort priority, merge defs)
  → ContentRegistry (deep freeze, indexed por kind+id)
  → Gameplay code (registry.get, readonly)
```

Cada camada protege uma invariante distinta. Não pular camada (ex.: ler JSON direto sem Zod).

## Invariante 1 — Schema é fonte da verdade

Antes de inventar campo em pack JSON ou ler campo em factory/system, **leia o schema atual** em `src/content/schema/<kind>.ts`. O schema declara:

- Campos obrigatórios e opcionais.
- Defaults.
- Tipos discriminados (ex.: discriminated union por `type`).
- Constraints (`positive`, `kebab-case`, etc., via helpers de `common.ts`).

Se o schema diverge do que você precisa, escale para `schema-guardian` — não invente field no JSON.

## Invariante 2 — `MergePolicy` é deliberadamente raso

Em `src/content/MergePolicy.ts`:

- Escalares e arrays **substituem** (override total).
- Objetos planos mergem em **depth 1** (shallow).
- Sem deep merge "inteligente".
- Sem condicional por kind ou por field.

Mod authors dependem desse contrato previsível para overrides. Adicionar branching aqui quebra mods existentes silenciosamente. Mudar `MergePolicy` exige `architect-reviewer`.

## Invariante 3 — `ContentRegistry` faz freeze recursivo

Defs retornados por `registry.get(kind, id)` estão `Object.freeze` recursivamente. Gameplay code DEVE tratar como readonly.

```ts
// ❌ NUNCA — mutar def direto
const w = registry.get("weapon", "spark");
w.cooldownMs = 100;

// ✅ Cópia explícita se precisa runtime state
const state = { ...w, cooldownLeft: w.cooldownMs };
```

Componentes ECS que espelham defs (ex.: `WeaponState` espelha `WeaponDef.shots`) carregam **cópia mutável** deliberadamente — runtime state vive ali, não no def. A cópia é responsabilidade da factory.

## Invariante 4 — Adicionar def kind toca um conjunto fechado de lugares

A regra cross-area atual está validada por testes em `src/content/__tests__/coherence.test.ts`. Em alto nível, um def kind novo precisa estar visível em:

- Schema Zod com literal `kind` matching.
- Discriminated union exportada como `AnyDef`.
- Map de tipos consumido pelo registry (`DefByKind`).
- Editor: tab + form (ou editor customizado).
- Pelo menos 1 def no pack base (senão jogo arrebenta na inicialização).

Os arquivos exatos dessas peças mudam — confie no teste de coerência para detectar drift, não numa lista hardcoded aqui.

## Invariante 5 — Packs JSON em `public/packs/`

- Arquivo por kind dentro do pack (`weapons.json`, `enemies.json`, ...).
- Manifest com `id`, `name`, `version`, `priority`, `files`.
- IDs em `kebab-case` ou `snake_case`, conforme regex em `common.ts`.
- Duplicatas de `kind:id` dentro do mesmo pack são erro de PackLoader.
- Entre packs, conflito por id é resolvido por `priority` ascendente em MergePolicy.

Adicionar conteúdo é **sem código** quando o def kind já existe — só JSON. Skill `/new-weapon`, `/new-enemy`, etc. acelera.

## Invariante 6 — `schemaVersion` é gate de migração

`SCHEMA_VERSION` em `src/content/schema/common.ts` é a versão **do formato de pack**, não a versão do projeto. Bumpar implica:

- Mudança breaking (renomear, remover, mudar type, estreitar união).
- Migração escrita em `src/content/migrations/v<from>_to_v<to>.ts`.
- Migração registrada na cadeia em `PackLoader.ts`.
- Teste com pack antigo passando pela cadeia.
- Update em packs base + fixtures de teste.

NÃO bumpar para adição de field opcional com default — é compatível.

Refactor que tocaria `schemaVersion` exige `refactor-coordinator` antes para mapear todos os lugares.
