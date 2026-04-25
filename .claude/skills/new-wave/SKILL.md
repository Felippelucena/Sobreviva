---
name: new-wave
description: Cria uma nova definição de wave no pack base seguindo o schema atual. Use quando o usuário pedir "criar wave X", "nova onda", "wave de boss".
argument-hint: "<id> [tema]"
allowed-tools: Read, Edit, Bash
---

Cria wave "$1" (tema opcional: $2 — ex.: "tutorial", "swarm", "elite-rush", "boss").

## Passos

### 1. Ler

- `src/content/schema/wave.ts` — schema atual com `entries` ou estrutura equivalente.
- `public/packs/base/manifest.json` → arquivos de waves e enemies.
- Arquivo de inimigos do pack — para descobrir IDs disponíveis (você só pode referenciar inimigos que existem).
- Arquivo de waves — 2+ waves existentes para imitar curva.

### 2. Mapear tema → curva

- "tutorial": entries esparsas, inimigos fáceis, build-up gradual.
- "swarm": muitos inimigos baratos sobrepostos.
- "elite-rush": poucos inimigos fortes em janela curta.
- "boss": entry única com inimigo forte (precisa existir).

### 3. Compor entries

- Cada entry referencia `enemyId` que **existe** no pack base ou em um pack do qual você depende.
- Timing (em ms desde início da wave) progressivo, sem buracos sem motivo.
- Densidade calibrada — comparar com waves existentes.

### 4. Validar

```bash
npm run typecheck
npx vitest run src/content/__tests__/packs-valid.test.ts
```

O teste de packs-valid já verifica que todo `entry.enemyId` aponta a inimigo existente — ele falha se você referenciou enemy que não existe.

### 5. Reportar

Diff + curva (entries × tempo, picos identificados), sugestão de map que pode usar a wave como `defaultWaveId`.

## Limites

- Não cria inimigos. Se o tema exige inimigo que não existe, escale para `/new-enemy` antes.
- Não modifica schema de wave.
