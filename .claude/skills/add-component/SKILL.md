---
name: add-component
description: Adiciona um component novo em src/game/components/index.ts no padrão pareado (interface no topo + defineComponent no fim). Use quando o usuário pedir "novo component", "adicionar componente X", "criar component". Mantém ordem alfabética e roda typecheck.
argument-hint: "<NomeDoComponent> [campo:tipo, campo:tipo, ...]"
allowed-tools: Read, Edit, Bash
---

Adicionar component "$1" a `src/game/components/index.ts`. Campos opcionais via $2 (ex.: `radius:number, color:number`).

## Convenção do projeto (não negocie)

Components em `src/game/components/index.ts` ficam em DOIS BLOCOS pareados:

- **Bloco 1 (topo):** `export interface X { ... }` — só dados, sem métodos.
- **Bloco 2 (fim):** `export const X = defineComponent<X>("X")` — literal === type.

Mudar um sem o outro = bug silencioso. O hook `validate-component-pair.mjs` (quando ativado) detecta divergência, mas você confere primeiro.

## Tags vs Components

- Component com dados: usa interface + `defineComponent<X>("X")`.
- Tag puro (true/false): usa `defineComponent<true>("XTag")` direto, sem interface (ver `PlayerTag`, `EnemyTag`).

Pergunte ao usuário se "$1" é tag (sem dados) ou component completo. Se ele pediu campos via $2, é component completo.

## Passos

1. **Ler arquivo inteiro** — `src/game/components/index.ts`. Note a ordem (interfaces no topo, defineComponent no final).
2. **Decidir posição alfabética** entre as outras interfaces.
3. **Adicionar interface** no bloco superior. Exemplo para "$1" com campos sugeridos:

   ```ts
   export interface $1 {
     // campos derivados do parâmetro $2 ou pedidos pelo usuário
   }
   ```

4. **Adicionar defineComponent** no bloco inferior, mesma posição alfabética relativa entre os defineComponent existentes:

   ```ts
   export const $1 = defineComponent<$1>("$1");
   ```

5. **Rodar `npm run typecheck`** — deve passar verde.

6. **Reportar**:
   - Diff aplicado (interface + defineComponent).
   - Sugestão de 1 system em `src/game/systems/` que pode consumir esse component (sem implementar).
   - Sugestão de teste em `src/game/__tests__/` se o component é central a algum sistema.

## Limites

- NÃO adicione lógica em sistemas — apenas o component. Lógica é decisão separada.
- NÃO duplicate de component existente. Procure por interface mesmo nome antes.
- NÃO use métodos na interface (components são puro state).
- Se o usuário pediu nome em conflito ou semanticamente confuso, pause e proponha alternativa.

## Exemplo de execução

Pedido: `/add-component Trail length:number color:number`

Resultado em `index.ts`:

```ts
// (no topo, alfabético)
export interface Trail {
  length: number;
  color: number;
}

// (no fim, alfabético)
export const Trail = defineComponent<Trail>("Trail");
```
