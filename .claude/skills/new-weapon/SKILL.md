---
name: new-weapon
description: Cria uma nova definição de arma no pack base seguindo o schema atual. Use quando o usuário pedir "criar arma X", "adicionar weapon", "nova arma com Y comportamento". Sempre lê o schema antes de gerar — resiste a evolução do formato.
argument-hint: "<id> [archetype]"
allowed-tools: Read, Edit, Bash
---

Você vai criar uma arma com id "$1" (archetype opcional: $2 — descrição livre como "shotgun", "smg", "nova", "burst", etc.).

## Princípio (não ignore)

Schema é fonte da verdade. Antes de gerar JSON, **leia o schema atual** — não confie no que esta skill diz sobre o formato. O formato muda; o processo abaixo não.

## Passos

### 1. Ler o estado atual

- `src/content/schema/weapon.ts` — schema Zod atual com fields, types, defaults, discriminadores.
- `public/packs/base/manifest.json` — manifest do pack base, descobrir nome do arquivo de armas.
- O arquivo de armas listado no manifest (geralmente `weapons.json`) — pelo menos 2 entries para imitar estilo e detectar convenções vivas (ex.: ids em kebab vs snake).

### 2. Mapear archetype → estrutura

Se o usuário pediu archetype "$2" (ex.: "shotgun"), entenda **conceitualmente** o que ele quer:

- "shotgun" → múltiplos projéteis em spread por disparo, dano por bala baixo.
- "smg/metralha" → rajada interna rápida, dano por bala baixo.
- "burst" → N tiros consecutivos em janela curta, depois cooldown.
- "nova/aoe" → dano em área, tipo discriminado se houver.
- "rifle" → projétil único, dano alto, cooldown longo.
- "ricochete/seek/orbital" → comportamento que pode NÃO existir no schema atual.

Confronte essas conceitos com o schema. Os mecanismos exatos (campo "shots" vs outro nome, discriminado por "type" vs outro discriminator) **descobrem-se lendo o schema**, não assumindo.

Se o conceito não cabe no schema atual, **pare**. Não invente field. Reporte o gap e sugira:
- Reformular o pedido para caber no schema (mantendo a essência).
- Estender o schema antes (escalando para `schema-guardian`).

### 3. Compor a entry

Use os campos exatos do schema. Use defaults do schema deixando fora opcionais (JSON limpo). Garanta:

- `kind` é o literal correto (ler do schema).
- `id` único no pack (`grep` antes de salvar).
- IDs em formato matching o regex de `Id` (em `src/content/schema/common.ts`).
- Cores como `number` decimal hex (ex.: `0xff6b6b` = `16737126`); imitar valores existentes para estilo coerente.
- Damage / cooldown / speed em ordens de magnitude que batem com armas existentes (não 10× mais forte que tudo existente sem motivo).

### 4. Validar

Rode em sequência:

```bash
npm run typecheck
npx vitest run src/content/__tests__/packs-valid.test.ts
```

`packs-valid.test.ts` parseia todo arquivo JSON de pack via Zod — pega erro estrutural que TS não pega. Se falhar, **conserte antes de reportar pronto**.

### 5. Reportar

```
🔫 NOVA ARMA — "$1"
Archetype: $2

Mudanças:
- public/packs/base/<arquivo>: +1 entry

Stats:
- DPS estimado: <calc baseado nos campos atuais>
- Janela de cadência: <calc>

Validação:
- typecheck: ✅
- packs-valid: ✅
- coherence: ✅

Sugestões:
- Teste em src/game/__tests__/<arquivo> cobrindo <comportamento crítico>
- Seed em <character> usando esta arma como startWeaponId, se quiser jogá-la direto
```

## Limites

- Não modifique `src/content/schema/weapon.ts` aqui — `schema-guardian` é o agente correto.
- Não edite sistemas, factories ou editor — JSON only.
- Se o archetype pedido exige feature inexistente (ricochete, target tracking, charging), **pare e reporte** — não improvise no JSON nem no código.
- Não duplique id existente.
