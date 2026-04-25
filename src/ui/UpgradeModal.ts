import type { LevelUpCard } from "../game/progression/LevelUpPool";

export class UpgradeModal {
  private root: HTMLDivElement | null = null;

  constructor(private readonly host: HTMLElement) {}

  show(cards: readonly LevelUpCard[], onPick: (card: LevelUpCard) => void): void {
    this.close();
    const root = document.createElement("div");
    root.className = "upgrade-modal";
    root.innerHTML = `
      <div class="upgrade-modal__panel">
        <h2>Nível!</h2>
        <p>Escolha uma melhoria</p>
        <div class="upgrade-modal__cards"></div>
      </div>
    `;
    const cardsEl = root.querySelector<HTMLDivElement>(".upgrade-modal__cards")!;
    for (const card of cards) {
      const btn = document.createElement("button");
      btn.className = "upgrade-modal__card";
      btn.classList.add(`upgrade-modal__card--${card.kind}`);
      btn.innerHTML = renderCard(card);
      btn.addEventListener("click", () => {
        this.close();
        onPick(card);
      });
      cardsEl.appendChild(btn);
    }
    this.host.appendChild(root);
    this.root = root;
  }

  close(): void {
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
  }

  isOpen(): boolean {
    return this.root !== null;
  }

  dispose(): void {
    this.close();
  }
}

function renderCard(card: LevelUpCard): string {
  if (card.kind === "newWeapon") {
    return `
      <div class="upgrade-modal__card-tag">Nova arma!</div>
      <div class="upgrade-modal__card-name">${escapeHtml(card.weapon.name)}</div>
      <div class="upgrade-modal__card-desc">Equipa uma arma adicional para esta run.</div>
    `;
  }
  const { upgrade, nextLevel } = card;
  return `
    <div class="upgrade-modal__card-name">${escapeHtml(upgrade.name)}</div>
    <div class="upgrade-modal__card-desc">${escapeHtml(upgrade.desc)}</div>
    <div class="upgrade-modal__card-meta">Nível ${nextLevel} / ${upgrade.maxLevel}</div>
  `;
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
