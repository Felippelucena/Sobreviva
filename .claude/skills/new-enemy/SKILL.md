---
name: new-enemy
description: Cria uma nova definição de inimigo no pack base seguindo o schema atual. Use quando o usuário pedir "criar inimigo X", "adicionar enemy", "novo monstro com Y comportamento".
argument-hint: "<id> [archetype]"
allowed-tools: Read, Edit, Bash
---

Você vai criar um inimigo com id "$1" (archetype opcional: $2 — ex.: "tank", "swarm", "ranged", "elite").

## Princípio

Schema é fonte da verdade. Sempre leia `src/content/schema/enemy.ts` antes de gerar.

## Passos

### 1. Ler

- `src/content/schema/enemy.ts` — schema atual.
- `public/packs/base/manifest.json` → arquivo de inimigos no pack base.
- Esse arquivo — 2+ entries existentes para detectar convenções (sprite, hp/speed, scaling).

### 2. Mapear archetype → stats

Conceitualmente:
- **tank**: HP alto, speed baixo, damage médio.
- **swarm**: HP baixo, speed alto, damage baixo, spawn em quantidade (configurado em wave, não no enemy).
- **elite**: HP médio-alto, speed médio, damage alto.
- **ranged**: depende do schema atual — se enemies têm `attack` ou similar, usar; senão, archetype não cabe e PARE.

Confronte com o schema. Não assuma fields.

### 3. Compor

- `kind` literal correto (ler).
- `id` único no pack.
- Stats em ordens de grandeza coerentes com inimigos existentes.
- Sprite (color + radius) — se o schema atual usa Pixi Graphics, color em hex decimal.
- `xpDrop` em proporção a hp (mais difícil → mais XP). Imitar curva existente.

### 4. Validar

```bash
npm run typecheck
npx vitest run src/content/__tests__/packs-valid.test.ts src/content/__tests__/coherence.test.ts
```

### 5. Reportar

Diff aplicado, stats relativos a inimigos existentes (% mais HP, % mais speed), sugestão de em qual wave introduzir.

## Limites

- JSON only. Não toca schema, system, factory.
- Inimigo novo não aparece automaticamente em waves — adicionar entrada em `<arquivo>.json` de waves separadamente (ou usar skill `/new-wave`).
- Se archetype exige comportamento inexistente (ranged sem suporte em system, boss com fases), PARE e reporte gap.
