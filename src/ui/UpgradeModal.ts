import type { Upgrade } from "../game/progression/upgrades";

export class UpgradeModal {
  private root: HTMLDivElement | null = null;

  constructor(private readonly host: HTMLElement) {}

  show(options: readonly Upgrade[], onPick: (u: Upgrade) => void): void {
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
    const cards = root.querySelector<HTMLDivElement>(".upgrade-modal__cards")!;
    for (const u of options) {
      const btn = document.createElement("button");
      btn.className = "upgrade-modal__card";
      btn.innerHTML = `
        <div class="upgrade-modal__card-name">${escapeHtml(u.name)}</div>
        <div class="upgrade-modal__card-desc">${escapeHtml(u.desc)}</div>
      `;
      btn.addEventListener("click", () => {
        this.close();
        onPick(u);
      });
      cards.appendChild(btn);
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
