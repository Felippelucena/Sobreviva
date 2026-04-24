import type { RunResult, UnlockRule } from "../persistence/Meta";

export interface RunSummaryCallbacks {
  onPlayAgain: () => void;
  onBackToMenu: () => void;
}

export class RunSummary {
  private root: HTMLDivElement | null = null;

  constructor(private readonly host: HTMLElement) {}

  show(
    result: RunResult,
    unlocks: readonly UnlockRule[],
    cbs: RunSummaryCallbacks,
  ): void {
    this.close();
    const root = document.createElement("div");
    root.className = "summary";
    const survived = formatMs(result.timeMs);
    const unlocksHtml =
      unlocks.length === 0
        ? ""
        : `<div class="summary__unlocks">
             <div class="summary__unlocks-title">Novo desbloqueio!</div>
             ${unlocks.map((u) => `<div>${escapeHtml(u.label)}</div>`).join("")}
           </div>`;
    root.innerHTML = `
      <div class="summary__panel">
        <h2 class="summary__title">Fim de run</h2>
        <p class="summary__subtitle">Você caiu. Bom combate.</p>
        <div class="summary__stats">
          <div class="summary__stat">
            <div class="summary__stat-label">Tempo</div>
            <div class="summary__stat-value">${survived}</div>
          </div>
          <div class="summary__stat">
            <div class="summary__stat-label">Kills</div>
            <div class="summary__stat-value">${result.kills}</div>
          </div>
          <div class="summary__stat">
            <div class="summary__stat-label">Nível</div>
            <div class="summary__stat-value">${result.level}</div>
          </div>
          <div class="summary__stat">
            <div class="summary__stat-label">Personagem</div>
            <div class="summary__stat-value" style="font-size:14px">${escapeHtml(result.characterId)}</div>
          </div>
        </div>
        ${unlocksHtml}
        <div class="summary__actions">
          <button class="menu__btn menu__btn--primary" data-action="again">Jogar de novo</button>
          <button class="menu__btn" data-action="menu">Menu</button>
        </div>
      </div>
    `;
    root
      .querySelector<HTMLButtonElement>('[data-action="again"]')!
      .addEventListener("click", () => cbs.onPlayAgain());
    root
      .querySelector<HTMLButtonElement>('[data-action="menu"]')!
      .addEventListener("click", () => cbs.onBackToMenu());
    this.host.appendChild(root);
    this.root = root;
  }

  close(): void {
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
  }

  dispose(): void {
    this.close();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
