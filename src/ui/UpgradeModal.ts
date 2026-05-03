import type { LevelUpCard } from "../game/progression/LevelUpPool";
import type {
  AttrImprovement,
  Improvement,
  PushShotImprovement,
  UpgradeLevel,
} from "../content/schema/upgrade";

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
  const { upgrade, nextLevel, targetName } = card;
  const lvl = upgrade.levels[nextLevel - 1];
  const scopeLabel = upgrade.scope.kind === "weapon" ? "Arma" : "Personagem";
  const lvlName = lvl ? lvl.name : "";
  const lvlDesc = lvl?.description ?? upgrade.desc;
  const improvements = lvl ? renderImprovements(lvl) : "";
  return `
    <div class="upgrade-modal__card-target">${escapeHtml(scopeLabel)}: ${escapeHtml(targetName)}</div>
    <div class="upgrade-modal__card-name">${escapeHtml(upgrade.name)}</div>
    <div class="upgrade-modal__card-meta">Nível ${nextLevel} / ${upgrade.levels.length}${lvlName ? ` — ${escapeHtml(lvlName)}` : ""}</div>
    <div class="upgrade-modal__card-desc">${escapeHtml(lvlDesc)}</div>
    ${improvements}
  `;
}

function renderImprovements(level: UpgradeLevel): string {
  const items = level.improvements.map((imp) => `<li>${escapeHtml(describeImprovement(imp))}</li>`);
  return `<ul class="upgrade-modal__card-improvements">${items.join("")}</ul>`;
}

function describeImprovement(imp: Improvement): string {
  if (imp.type === "pushShot") return describePushShot(imp);
  return describeAttr(imp);
}

function describeAttr(imp: AttrImprovement): string {
  const target = formatPath(imp.path, imp.shotSelect);
  switch (imp.op) {
    case "mul":
      return `${target} × ${formatNum(imp.value)}`;
    case "add":
      return `${target} ${imp.value >= 0 ? "+" : ""}${formatNum(imp.value)}`;
    case "set":
      return `${target} = ${formatNum(imp.value)}`;
  }
}

function describePushShot(_imp: PushShotImprovement): string {
  return "Adiciona um disparo extra";
}

function formatPath(path: string, sel: AttrImprovement["shotSelect"]): string {
  if (!sel) return path;
  if (sel.select === "all") return path;
  if (sel.select === "type") return `${path} (${sel.shotType})`;
  return `${path} [shot ${sel.index}]`;
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "");
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
