---
description: API do Pixi v8 (não v7). Invariantes de uso de Renderer, Graphics, containers, HUD em DOM.
paths:
  - "src/engine/Renderer.ts"
  - "src/engine/Background.ts"
  - "src/game/factories/**"
  - "src/game/systems/RenderSyncSystem.ts"
  - "src/ui/**"
  - "src/editor/LivePreview.ts"
---

# Pixi v8 — Sobreviva

Sobreviva usa `pixi.js@^8.x`. API mudou de v7 para v8 — não confundir.

## Graphics: API chainable

```ts
// ✅ v8
new Graphics()
  .circle(x, y, r)
  .fill({ color: 0xff6b6b });

// ❌ v7 — compila silenciosamente em alguns casos, comportamento errado
g.beginFill(0xff6b6b);
g.drawCircle(x, y, r);
g.endFill();
```

Cores aceitam `number` hex direto ou objeto `{ color, alpha }`.

## Application init é async

```ts
const app = new Application();
await app.init({ background: 0x111111, resizeTo: window });
```

Construtor de v7 com options inline foi removido.

## Containers em camadas

`Renderer` mantém containers stackados em z-order (background, world, hud). Adicionar entidade ao container correto. World é transformado pela `Camera`; render system NÃO mexe em `world.position` direto — chama API da câmera.

Shake é exceção controlada — aplicar/decair em ponto único do render frame.

## HUD em DOM, não Pixi

HUD principal (`src/ui/Hud.ts`) é DOM cru. Razão: layout de texto dinâmico em Pixi é caro (bitmap font setup) e CSS é grátis para esse caso.

Não migrar HUD para Pixi sem motivo forte. Misturar text Pixi (`Text`) com HUD DOM produz drift de posição relativo a câmera.

## Lifecycle

- Adicionar: `parent.addChild(child)`.
- Remover (entidade morta): `parent.removeChild(child)` + `child.destroy({ children: true })`.
- Reusar (visibilidade alternada): `child.visible = false/true` em vez de remove/add — evita GC pressure.

`renderSyncSystem` itera entidades visíveis. Quando entidade morre no ECS, sprite ref é limpo no mesmo tick — caso contrário, leak no Pixi tree.

## Pitfalls comuns

- Esquecer `await app.init(...)` antes de `addChild` → tela preta.
- Recriar `Graphics` por frame em hot path → GC pause em runs longas. Reaproveitar.
- Misturar text Pixi com HUD DOM e esperar sync com câmera.
- Trocar containers (`removeChild` + `addChild`) por frame para visibilidade — `visible` é mais barato.

Quando suspeita de regressão de performance, escalar para `performance-analyst`.
