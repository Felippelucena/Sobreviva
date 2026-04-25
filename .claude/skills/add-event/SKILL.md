---
name: add-event
description: Estende GameEvents em src/engine/events/EventBus.ts adicionando o tipo + a entrada no initializer de handlers (o código depende de toda chave existir). Use quando o usuário pedir "novo evento X", "adicionar event", "estender EventBus".
argument-hint: "<NomeDoEvento> <PayloadType>"
allowed-tools: Read, Edit, Bash
---

Adicionar evento "$1" com payload "$2" ao EventBus.

## Por que isso é frágil sem cuidado

`src/engine/events/EventBus.ts` declara:

```ts
private readonly handlers: { [K in EventName]: HandlerEntry<K>[] } = {
  tick: [],
  weaponFire: [],
  ...
};
```

O initializer **precisa** ter toda chave de `GameEvents`, senão TS erra. Se você só estender o tipo e esquecer do initializer, código quebra na primeira `emit` do evento novo. Esse skill garante que ambos sejam tocados.

## Passos

1. **Ler `src/engine/events/EventBus.ts` inteiro.** Identifique:
   - `interface GameEvents { ... }` — onde vai o type novo.
   - O initializer object literal `{ tick: [], ... }` — onde vai a entrada array vazia.

2. **Adicionar entrada em `GameEvents`** com o payload "$2":

   ```ts
   $1: $2;
   ```

   Coloque alfabético OU agrupado por domínio (ver convenção atual: `tick`, `weaponFire`, `enemySpawn`, `enemyDeath`, `playerHit`, `levelUp`).

3. **Adicionar entrada no initializer**:

   ```ts
   $1: [],
   ```

   Mesma posição relativa.

4. **Rodar typecheck e teste do bus**:

   ```
   npm run typecheck
   npm test src/engine/__tests__/EventBus.test.ts
   ```

5. **Reportar**:
   - Diff aplicado (2 lugares, 1 commit).
   - Sugestão de 1 emit() candidato (qual system vai disparar) — sem implementar.
   - Sugestão de 1 handler candidato — sem implementar.
   - Lembrete: handlers que registrarem este evento DEVEM passar `source: "..."` para suportar `clearBySource` em mod unload.

## Constraints sobre o payload type

- Use objeto `{ ... }` mesmo para payload simples — facilita evolução.
- Não use `any` ou `unknown` no payload.
- Campos numéricos com unidade no nome (`durationMs`, `damageAmount`).
- Não inclua referências a entities por objeto (use `entityId: EntityId` para ser serializável).

## Limites

- NÃO modifique handlers existentes nesse skill.
- NÃO emita o evento — apenas declare. Emit é decisão de quem chamou o skill.
- Se o evento proposto é similar a um existente (`weaponFire` vs `projectileFire`), pause e proponha reusar.
