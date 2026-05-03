# Follow-up: PropertyGrid compact forms

PR separado, sem urgência. Levantado durante o refactor de upgrades (multi-improvement).

## Problema

`PropertyGrid` (`src/editor/PropertyGrid.ts`) renderiza um `pg__row` por field, sempre em coluna única. Para defs com muitos campos numéricos curtos (ex.: improvement em upgrade — `path`, `op`, `value`, `shotSelect.select`, `shotSelect.shotType/index`), a tela vira uma escada longa de inputs minúsculos. Em particular o array de improvements aninhado dentro de levels de upgrade fica visualmente cansativo.

## Requisitos da nova UI

- Inputs numéricos e enums curtos (ex.: `op`, `select`, `shotType`) podem ser agrupados em colunas dentro do mesmo `pg__row` (grid CSS de 2-3 colunas), em vez de cada um ocupar uma linha cheia.
- Strings curtas (ex.: `path`, `name`) podem dividir linha quando o tamanho for compatível.
- Objetos aninhados (`pg__object`) e discriminated unions continuam empilhando — só os leaf fields agrupam.
- Color pickers e textareas mantêm linha cheia (ocupam mais espaço por natureza).
- Comportamento opt-in: `PropertyGridOptions` ganha `compact?: boolean` (ou flag por field via metadata Zod `.describe()`), default `false` para não regredir telas existentes.

## Implementação sugerida

### Opção A — flag `compact: true` no PropertyGridOptions
- Adicionar `compact?: boolean` em `PropertyGridOptions`.
- Quando `true`, agrupar runs de fields adjacentes do mesmo "tier" (ZodNumber, ZodString curto, ZodEnum) num único `pg__row--group-compact` com `display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));`.
- Quebra de grupo em ZodObject/ZodArray/ZodDiscriminatedUnion.
- Aplicar em `Editor.ts` para o tab de upgrades (e qualquer outro tab onde fizer sentido).

### Opção B — metadata via `.describe()`
- Mais flexível mas mais invasivo no schema. Não recomendado para esta primeira iteração.

## CSS necessário (`src/ui/styles.css`)

```css
.pg__row--group-compact {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 6px 12px;
  align-items: end;
}
.pg__row--group-compact .pg__label {
  font-size: 0.75em;
  margin-bottom: 2px;
}
```

## Não escopo

- Não mudar o shape do schema só para layout.
- Não introduzir biblioteca de form externa.
- Não criar editor custom para upgrade — o autoform genérico precisa funcionar bem.

## Arquivos a tocar

- `src/editor/PropertyGrid.ts` — flag + lógica de agrupamento.
- `src/editor/Editor.ts` — passar `compact: true` quando renderizar tab `upgrade` (e outros relevantes).
- `src/ui/styles.css` — classes novas.
- Sem mudança em testes de coerência (puramente visual).
