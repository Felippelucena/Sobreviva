---
description: Convenções estruturais do editor in-game. Invariantes; a forma de cada feature está no código.
paths:
  - "src/editor/**"
---

# Editor — Sobreviva

> Para a estrutura atual do editor (tabs, blank factories, custom forms), leia `src/editor/Editor.ts`. Esta rule descreve invariantes; código é fonte da verdade dos detalhes.

## Propósito

`Editor` (rota `#/editor`) permite ao autor de pack:
1. Criar/editar defs em memória.
2. Ver mudanças em tempo real.
3. Exportar pack como bundle aplicável.

Editor mora no mesmo bundle do jogo, ativado por hash routing. Não é dev tool separada.

## Invariante 1 — Form é gerado do schema

`PropertyGrid` lê o Zod schema do kind e gera form **automaticamente**. Não duplicar campos manualmente:

- ❌ Hardcode de `<input name="cooldownMs">`.
- ✅ Iterar sobre o schema, gerar inputs por type detection.

Quando um campo precisa controle especial (color picker, tabela), estender o `PropertyGrid` genericamente — não bypassa para hardcode. Excepcionalmente, kinds com estrutura muito específica (ex.: wave entries) podem ter editor custom (`WaveEditor`) — mas a tab continua no fluxo padrão.

## Invariante 2 — Mutação no editor não toca defs do registry

Defs vindos de `ContentRegistry` são frozen. O editor trabalha em `WorkingPack` (cópia mutável separada). Operações:

- Carregar do base → deep-clone do `LoadedPack` para WorkingPack.
- Editar → patch no WorkingPack, registry intocado.
- Exportar → serializa WorkingPack como bundle.
- Aplicar como mod → vira mod instalado, ContentRegistry recarrega na próxima run.

Nunca tentar mutar def vindo do registry. Compila com `as` cast, mas frozen em runtime.

## Invariante 3 — LivePreview é simulação mínima

`LivePreview` instancia um `Renderer` com:
- Player dummy parado.
- 1 inimigo dummy.
- Arma sendo editada disparando.

NÃO usar systems pesados (spawn dinâmico, collision com grid completo). É preview, não simulação. Quando o def muda, LivePreview **recicla** (não recria Pixi App inteira).

## Invariante 4 — Editor cobre todos os def kinds

Toda kind em `AnyDef` tem tab no editor. Validado pelo teste de coerência (`src/content/__tests__/coherence.test.ts`).

Quando `schema-guardian` adiciona kind novo, lista de tabs é atualizada **no mesmo commit**. Sem tab = bug latente (mod author não consegue editar pelo editor).

## Invariante 5 — Export é via `content/bundle.ts`

`content/bundle.ts` é o único caminho de serialização de pack. Não duplicar lógica de "salvar JSON" em outros lugares — usar a função canônica.

Quando muda formato de bundle (raro), bumpar `BundleFile` schema e atualizar import path.
