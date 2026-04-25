---
name: pr-checklist
description: Roda checklist de validação antes de abrir PR. Verifica typecheck, testes, build, convenções de commit e regras específicas do projeto (4-place rule para def kind, source em events, mod boundary). Use antes de git push ou gh pr create.
allowed-tools: Read, Glob, Grep, Bash
---

Checklist obrigatório antes de abrir PR no Sobreviva.

## Passo 1 — Gates objetivos

Rode (em sequência, parar no primeiro que falhar):

```bash
npm run typecheck
npm test                 # inclui packs-valid + coherence
npm run build
```

Reporte:
- ✅ ou ❌ por gate.
- Se `npm test` reportou falha em `packs-valid.test.ts` ou `coherence.test.ts`, **destaque separadamente** — significa drift estrutural (não bug funcional). Esses gates protegem cross-area; falha geralmente exige `coherence-auditor` ou `refactor-coordinator`.
- Se algum gate falhou, pare aqui e mostre output. Não passe para o passo 2.

## Passo 2 — Diff overview

```bash
git status --short
git log $(git merge-base HEAD develop)..HEAD --oneline
git diff $(git merge-base HEAD develop)..HEAD --stat
```

Reporte:
- N commits, M arquivos, +adds/-dels.
- Áreas tocadas (engine, content, mods, editor, ui, testes, config).

## Passo 3 — Convenção de commits

Para cada commit listado, verifique:

- [ ] Formato `tipo(escopo): descrição` (minúsculo, sem ponto final).
- [ ] Tipos válidos: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `style`, `perf`.
- [ ] Mensagem é clara sobre o "porquê", não só "o quê".
- [ ] Sem commits "wip", "asd", "sada" (já tem 1 — `ef6270a`; evitar mais).

## Passo 4 — Regras específicas do projeto

Para cada arquivo modificado, verifique abaixo:

### Tocou `src/game/components/index.ts`?
- [ ] Toda `interface X` nova tem `defineComponent<X>("X")` pareado?
- [ ] Sem dado ou método dentro de interface?

### Tocou `src/engine/events/EventBus.ts`?
- [ ] Toda chave nova de `GameEvents` está no initializer de `handlers`?

### Tocou `src/content/schema/`?
- [ ] `schemaVersion` ainda 1 (mudança compatível) OU bump justificado + migração?
- [ ] Adicionou def kind? Verificou os 4 lugares (schema + AnyDef + DefByKind + editor tabs)?

### Tocou `src/content/MergePolicy.ts` ou `src/content/registry/ContentRegistry.ts`?
- [ ] Recomende: rodar agente `architect-reviewer` antes de merge.

### Tocou `src/mods/` ou `src/engine/events/EventBus.ts` (quarentena)?
- [ ] Recomende: rodar agente `mod-security-reviewer` antes de merge (não opcional).

### Tocou ordem de sistemas em `src/app/Game.ts`?
- [ ] Recomende: rodar agente `architect-reviewer` antes de merge.

### Mudou shape de dados (renomeou field, reestruturou schema, moveu responsabilidade entre kinds)?
- [ ] Recomende: rodar `refactor-coordinator` (se ainda não rodou) e `coherence-auditor` ao fim.
- [ ] Atualizou `.claude/rules/` se mencionavam shape antiga?
- [ ] Atualizou `docs/AI_WORKFLOW.md` ou `CLAUDE.md` se referenciam shape antiga?

### Tocou `src/game/systems/`?
- [ ] System ainda é função pura `(world, ctx) => void`? Sem class, sem state interno?

### Adicionou arquivo `.ts` novo em `src/<area>/`?
- [ ] Existe `src/<area>/__tests__/<nome>.test.ts` correspondente OU justificativa explícita pra não ter (UI, tipos puros)?

## Passo 5 — Veredito

Emita:

```
📋 PR CHECKLIST — <branch>

Gates objetivos:
- typecheck: ✅
- test:      ✅ (N tests)
- build:     ✅

Commits: <N> seguindo convenção: ✅ | <lista de divergentes>

Regras de projeto:
- <cada item verificado com ✅ ou ⚠️ ou ❌>

Escalações recomendadas:
- <agentes a invocar antes de merge>

Veredito: PRONTO PARA PR | CORRIJA ANTES | NEEDS DISCUSSION
```

## Limites

- Não abre o PR — só relata. `gh pr create` é decisão consciente do usuário.
- Não force-pushes — só revisa.
- Se algum agente recomendado ainda não foi rodado, recomende fortemente mas não bloqueia.
