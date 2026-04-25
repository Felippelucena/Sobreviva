---
description: Convenções estruturais de ECS, fixed timestep e ordem de sistemas (invariantes — não a forma específica de cada component)
paths:
  - "src/engine/**"
  - "src/game/**"
---

# ECS — Sobreviva

> Esta rule descreve **invariantes que não devem mudar**. Para a forma atual de um component ou sistema específico, leia o arquivo correspondente em `src/game/components/index.ts` ou `src/game/systems/`. Documentação aqui é estrutural; código é fonte da verdade dos detalhes.

## Components: padrão pareado

Um component completo (com dados) ocupa **duas posições** em `src/game/components/index.ts`:

```ts
// (em algum lugar do arquivo) — interface só com dados
export interface <Nome> {
  // campos
}

// (em outro lugar do arquivo) — bind runtime
export const <Nome> = defineComponent<<Nome>>("<Nome>");
```

**Invariante**: o nome do tipo genérico `<X>`, o literal string `"X"`, e o `export const X` precisam ser **idênticos**. Tag puros (sem dados) usam `defineComponent<true>("XTag")` — o nome do literal carrega o significado.

Os testes de coerência (`src/content/__tests__/coherence.test.ts`) validam isso automaticamente. Se um teste de coerência reclamar de drift, **conserte o pareamento**, não silencie o teste.

## Systems: funções puras

Sistemas em `src/game/systems/` seguem assinatura `(world, ctx) => void`. Sem class. Sem estado interno entre chamadas. Estado vai em components; ctx é injetado.

Exceção pré-existente: `EnemySpawner` é classe (histórico). **Não criar mais classes** — funções, sempre.

## Unidades de tempo (load-bearing para fixed-step)

| Origem | Unidade | Exemplos canônicos |
|---|---|---|
| Parâmetro `dt` em system | **segundos** | `dt = 1/60` |
| Campo terminado em `Ms` | **milissegundos** | `cooldownMs`, `lifetimeMs`, `runTimeMs` |
| `performance.now()` | **milissegundos** | `nowMs` |

Mistura silenciosa = bug latente. Se converter, isole numa variável e comente:

```ts
// state.runTimeMs += dt * 1000  ← conversão única, intencional
```

## Loop fixed-step

`src/engine/Loop.ts` roda update a frequência fixa com bounded catch-up. Render é rAF com interpolação via `alpha`. Componentes que precisam de smooth render carregam `prev*` para o renderSyncSystem interpolar.

**Invariante**: render NUNCA escreve em estado de simulação. Render é leitura.

## Ordem de execução em `Game.update`

A ordem dos systems é **load-bearing**. A ordem canônica está em `src/app/Game.ts` — confirme lá antes de mexer. Cada par adjacente tem uma invariante, por exemplo:
- Detectar colisão antes de processar dano garante que armas vejam hits do tick.
- Limpar lifetimes antes de spawnar libera ids.
- Emitir `tick` por último garante que handlers veem estado consolidado.

Reordenar systems exige escalar para `architect-reviewer` — não é decisão local.

## Destruição deferida

`world.destroy(id)` marca para destruição. A limpeza efetiva acontece em `world.flushDestroyed()` no fim do tick. **Invariante**: nenhum system assume entidade existe entre ticks — sempre checa retorno de `world.get(...)`.

## Queries

`world.query(...)` itera o menor store dos components solicitados. Para queries geográficas (raio), use `SpatialGrid` — query+distance check em loop é O(N²) latente.
