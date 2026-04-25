---
name: new-pickup
description: Cria uma nova definição de pickup no pack base seguindo o schema atual. Use quando o usuário pedir "criar pickup X", "novo item dropável".
argument-hint: "<id> [effect]"
allowed-tools: Read, Edit, Bash
---

Cria pickup "$1" (effect opcional: $2 — ex.: "xp", "heal", "magnet").

## Passos

### 1. Ler

- `src/content/schema/pickup.ts` — schema atual.
- `public/packs/base/manifest.json` → arquivo de pickups no pack base.
- Esse arquivo — 2+ entries existentes.

### 2. Validar effect

Schema declara que effects são uma união enumerada. Se "$2" não está nessa união, PARE — não invente effect novo (exige schema change e suporte em system de pickup).

### 3. Compor e validar

- `kind` correto.
- `id` único.
- `effect` da união do schema.
- `value` em escala coerente (XP normalmente em dezenas, heal em 10-30% de HP típico).
- `magnetizable` se faz sentido no contexto (XP geralmente sim, heal geralmente não).

### 4. Validar

```bash
npm run typecheck
npx vitest run src/content/__tests__/packs-valid.test.ts
```

### 5. Reportar

Diff + lembrete de que pickups só dropam se enemies/waves derrubarem (configurar separadamente).

## Limites

- Não adicione effect novo no schema. Se pediu effect inexistente, escale para `schema-guardian`.
- Não toca system de pickup.
