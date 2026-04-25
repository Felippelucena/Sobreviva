---
name: milestone-status
description: Compara últimos N dias de commits contra ROADMAP.md e reporta progresso por milestone (M1-M8). Use quando o usuário perguntar "como está o progresso", "onde estamos no roadmap", "status de M5" ou similar. Não modifica nada.
argument-hint: "[dias=30]"
allowed-tools: Read, Bash, Grep
---

Análise de progresso de roadmap. Argumento `$1` = janela em dias (default 30).

## Passos

1. **Ler `ROADMAP.md`** inteiro. Extrair:
   - Lista de milestones (M1-M8) com status atual declarado.
   - Sub-itens de cada milestone (bullet points).

2. **Listar commits recentes**:

   ```bash
   git log --since="${1:-30} days ago" --pretty=format:"%h %s" --no-merges
   ```

3. **Listar arquivos tocados** no período:

   ```bash
   git log --since="${1:-30} days ago" --name-only --pretty=format: --no-merges | sort -u | grep -v '^$'
   ```

4. **Mapear commits a milestones** por escopo do conventional commit + paths tocados:
   - `weapon/` ou commits com `weapon` no escopo → M3 (combate básico) ou M4 (data layer)
   - `menu`, `ui` → M5 (menus + persistência)
   - `mod` → M6 (mods JSON) ou M8 (mods JS)
   - `editor` → M7
   - `ci`, `test`, `docs` → infra (M8 polish)

5. **Detectar drift**: commits que não mapeiam claramente a um milestone — listar como "fora do roadmap" para o usuário avaliar.

## Output

```
📊 PROGRESSO DOS ÚLTIMOS ${1:-30} DIAS

Atividade total:
- N commits, M arquivos, +adds/-dels

Por milestone:

M5 (menus + persistência) — 🟡 EM PROGRESSO
  ✅ Concluído nesta janela:
    - <lista de bullets do roadmap fechados>
  🔄 Em andamento:
    - <bullets parcialmente atacados>
  ⏳ Pendente:
    - <bullets intocados>

M3 (core loop + ECS + combate) — 🟢 ESTÁVEL
  Refinamentos recentes:
    - <commits>

Marcos não tocados nesta janela:
- M6, M7, M8

Atividade fora do roadmap (para avaliar):
- <commits que não mapeiam>

Sugestão de próximo foco:
- <item mais próximo de fechar em M5>
```

## Limites

- Read-only. NÃO escreve em ROADMAP.md.
- Mapeamento commit→milestone é heurístico — flag commits ambíguos.
- Se janela tem 0 commits, reporte "sem atividade" e encerre.
- Se ROADMAP.md mudou no período, mencione na nota.
