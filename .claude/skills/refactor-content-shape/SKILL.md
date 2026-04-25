---
name: refactor-content-shape
description: Coordena refactor que muda shape de dados (renomear field, reformar schema, mover responsabilidade). Use quando o usuário disser "vou renomear X", "vou separar Y em Z", "vou mudar o formato de W". Não executa sozinha — invoca refactor-coordinator e guia o usuário pelo plano.
argument-hint: "<descrição da mudança>"
allowed-tools: Read, Grep, Glob, Bash
---

Coordenar mudança de shape de dados. Pedido: "$ARGUMENTS".

## Quando esta skill faz sentido

Use quando a mudança proposta toca **shape**, não conteúdo:
- "Renomear `shots` para `volleys`."
- "Separar `enemy.baseHp` em `enemy.stats.hp`."
- "Mover `cooldownMs` da arma para cada shot."
- "Adicionar `tier` obrigatório a weapons existentes."

NÃO use quando:
- Mudança é só conteúdo (criar arma nova) → `/new-weapon`.
- Mudança é só código (renomear função interna) → não exige coordenação cross-area.

## Processo

### 1. Invocar `refactor-coordinator`

Forneça contexto:
- Descrição da mudança ("$ARGUMENTS").
- Tipo de refactor (rename, retype, move, add, remove, reshape).
- Escopo (1 kind ou cross-kind).
- Compatibilidade desejada (breaking ou backwards-compatible).

O agente retorna um **plano** com:
- Lista de lugares afetados (TS-checked vs TS-blind).
- Ordem proposta de aplicação.
- Riscos.

### 2. Apresentar plano ao usuário

Mostre o plano completo. **Pause** para aprovação. Não comece a executar sem o usuário dizer "ok, executa" ou similar.

Pergunte:
- O plano está completo? Algum lugar faltou?
- A ordem está OK? Tem dependência que sugere reordenar?
- Alguma etapa é arriscada e quer fazer manualmente?

### 3. Executar passo a passo (se aprovado)

Para cada passo do plano:
1. Aplique o passo (edits, scripts, etc.).
2. Rode validação local relevante (`npm run typecheck`, `npm test`, ou subset).
3. Mostre o diff resumido ao usuário.
4. **Pause** antes do próximo passo.

Não encadeie todos os passos silenciosamente — refactor é exatamente onde a pausa importa.

### 4. Validar fim

Depois do último passo:

```bash
npm run typecheck
npm test
npm run build
```

Todos verdes = refactor estruturalmente OK. Se algum falhar, pare imediatamente — não tente "consertar e seguir".

### 5. Limpeza pós-refactor

Lembre o usuário de:
- Atualizar `.claude/rules/` se mencionar shape antiga.
- Atualizar `docs/AI_WORKFLOW.md` se referenciar shape antiga.
- Atualizar `CLAUDE.md` se contiver exemplo antigo.
- Atualizar mensagens de PR/changelog descrevendo o impacto (especialmente se breaking).

Executar o agente `coherence-auditor` ao fim para confirmar que não sobrou drift.

## Limites

- Não pula a etapa de plano. Refactor "rapidinho" sem mapeamento sempre deixa lixo.
- Não força breaking change quando backwards-compat é possível.
- Se o usuário pediu mudança que seu instinto diz "isso não deveria ser refactor, deveria ser feature nova", flag isso antes de gerar o plano.
