<!--
  Antes de abrir, rode `/pr-checklist` no Claude Code para validação rápida.
  Se tocou em src/mods/, src/content/MergePolicy.ts ou ordem de sistemas,
  rode também os agentes especializados (mod-security-reviewer, architect-reviewer).
-->

## O que muda
<!-- Resumo em 2-3 linhas, focado no porquê (não no quê — o diff já mostra). -->

## Tipo
- [ ] feat
- [ ] fix
- [ ] refactor
- [ ] docs
- [ ] chore
- [ ] test
- [ ] perf
- [ ] BREAKING (bump major / schemaVersion)

## Áreas tocadas
- [ ] engine (`src/engine/`)
- [ ] content (schemas / packs / registry / merge)
- [ ] game (systems / components / factories)
- [ ] mods (boundary — exige `mod-security-reviewer`)
- [ ] editor
- [ ] ui
- [ ] persistência
- [ ] testes
- [ ] CI / config / docs

## Checklist
- [ ] `npm run typecheck` passa
- [ ] `npm test` passa (todos os testes)
- [ ] `npm run build` passa
- [ ] Convenções de commit (`tipo(escopo): descrição`)
- [ ] Adicionei/atualizei testes onde fazia sentido
- [ ] Se tocou `src/content/schema/` → `schemaVersion` bumped (ou justificado abaixo)
- [ ] Se adicionei def kind → 4 lugares atualizados (schema, AnyDef, DefByKind, editor tabs)
- [ ] Se adicionei event → estendi `GameEvents` E o initializer de `handlers`
- [ ] Se tocou `src/mods/` ou `EventBus.ts` → rodei `mod-security-reviewer`
- [ ] Se tocou `MergePolicy.ts`, `ContentRegistry.ts`, ordem de systems → rodei `architect-reviewer`
- [ ] Atualizei `ROADMAP.md` se fechei um sub-item

## Como testar
<!-- Passos para validar localmente. -->
1.
2.

## Screenshots / GIF
<!-- Para mudanças visuais. -->

## Notas
<!-- Decisões de trade-off, escolhas conscientes que possam parecer estranhas. -->
