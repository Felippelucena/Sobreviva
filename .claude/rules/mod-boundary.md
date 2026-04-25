---
description: Fronteira de segurança entre código do jogo e mods JS de terceiros (invariantes; não a API atual)
paths:
  - "src/mods/**"
  - "src/engine/events/EventBus.ts"
---

# Mod Boundary — Sobreviva

> Para a API atual exposta a mods, leia `src/mods/ModApi.ts`. Esta rule descreve **invariantes que protegem a fronteira**, não a forma específica da API.

Mods JS em Sobreviva rodam **sem sandbox real** (sem iframe, sem worker isolado). A defesa é em camadas cooperativas. Cada uma pode ser quebrada por uma única mudança descuidada.

Qualquer alteração nesses arquivos é **fronteira de segurança** — escalar para `mod-security-reviewer` ANTES de merge, não depois.

## Invariantes (ordem de prioridade)

### I-1. API exposta a mods é deep-frozen

A função que cria a API entregue a mods **deve** retornar objeto onde toda propriedade aninhada está `Object.freeze`d. Não basta congelar o root — sub-objetos e arrays precisam ser congelados individualmente, ou mod consegue mutá-los para subverter.

### I-2. Consent JS é versionado por bundle

A fronteira de aprovação do usuário não é "mod permitido em geral" — é "mod permitido nesta versão específica". Quando o bundle muda de versão, consent revoga automaticamente.

Não permitir:
- Comparação que passa quando versions divergem.
- Fallback "any version is OK".
- Cache de consent que sobrevive a bump.

### I-3. Source tagging em handlers de mod

Toda chamada de `bus.on(event, fn, source)` originada de mod usa `source` no formato `mod:<packId>`. Sem isso, `bus.clearBySource` não detacha handler ao desativar mod → leak + handlers órfãos rodando após uninstall.

### I-4. Quarentena automática no `EventBus`

Em `src/engine/events/EventBus.ts`, handler que joga N vezes (constante `MAX_ERRORS_BEFORE_DISABLE`) é desabilitado. Esta é a defesa principal contra mod buggy matando run.

NUNCA aceitar:
- Aumentar a constante para "ser mais tolerante".
- Branch "if mod, mais tolerante" — mod tem que ser **menos** tolerante, não mais.
- Try/catch externo que come o throw antes de chegar ao bus.
- Reset automático de `errorCount` durante run.

### I-5. Whitelist explícita de capabilities

A API de mod expõe **apenas** o que está na whitelist. Adicionar capability nova **requer justificativa explícita** e review por `mod-security-reviewer`.

Formato whitelist (alto nível, não exaustivo): registrar conteúdo, escutar eventos do bus, ler defs do registry (já frozen), helpers puros sem side effect.

NUNCA expor (mesmo indiretamente):
- `window`, `document`, `globalThis`.
- Storage browser (`localStorage`, `IndexedDB`, etc.).
- Network (`fetch`, `XMLHttpRequest`, `WebSocket`).
- Code injection (`eval`, `Function`, `import()`).
- Acesso a outros packs.
- `SaveStore` cru.

## Convenções de teste

A fronteira tem cobertura em `src/mods/__tests__/`. Adicionar teste sempre que tocar boundary, mesmo refactor "seguro". Teste é parte da defesa, não overhead.
