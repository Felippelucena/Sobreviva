import type { ContentRegistry } from "../content/registry/ContentRegistry";
import type { CharacterDef } from "../content/schema";
import type { MetaManager, UnlockRule } from "../persistence/Meta";
import { UNLOCK_RULES } from "../persistence/Meta";

export interface MainMenuCallbacks {
  onStart: (characterId: string) => void;
  onOpenEditor: () => void;
  onOpenMods: () => void;
}

export class MainMenu {
  private root: HTMLDivElement | null = null;
  private selectedId: string;

  constructor(
    private readonly host: HTMLElement,
    private readonly registry: ContentRegistry,
    private readonly meta: MetaManager,
    private readonly callbacks: MainMenuCallbacks,
    initialCharacterId?: string,
  ) {
    const unlocked = registry
      .list("character")
      .find((c) => meta.isUnlocked(c.id) && (!initialCharacterId || c.id === initialCharacterId));
    this.selectedId = unlocked?.id ?? "runner_hero";
  }

  show(): void {
    this.close();
    const chars = this.registry.list("character");
    const root = document.createElement("div");
    root.className = "menu";
    const best = this.meta.state.bestRun;
    root.innerHTML = `
      <div class="menu__panel">
        <h1 class="menu__title">SOBREVIVA</h1>
        <p class="menu__tagline">Sobreviva. Colete. Evolua.</p>
        <div class="menu__char-grid"></div>
        <div class="menu__actions">
          <button class="menu__btn menu__btn--primary" data-action="start">Jogar</button>
          <button class="menu__btn" data-action="mods">Mods</button>
          <button class="menu__btn" data-action="editor">Editor</button>
        </div>
        <div class="menu__footer">
          Melhor run: ${formatMs(best.timeMs)} · ${best.kills} kills · nv. ${best.level}
          &nbsp;·&nbsp; Runs: ${this.meta.state.runs}
        </div>
      </div>
    `;
    const grid = root.querySelector<HTMLDivElement>(".menu__char-grid")!;
    for (const c of chars) {
      grid.appendChild(this.renderCharCard(c));
    }
    root.querySelector<HTMLButtonElement>('[data-action="start"]')!.addEventListener("click", () => {
      this.callbacks.onStart(this.selectedId);
    });
    root
      .querySelector<HTMLButtonElement>('[data-action="mods"]')!
      .addEventListener("click", () => this.callbacks.onOpenMods());
    root
      .querySelector<HTMLButtonElement>('[data-action="editor"]')!
      .addEventListener("click", () => this.callbacks.onOpenEditor());
    this.host.appendChild(root);
    this.root = root;
  }

  close(): void {
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
  }

  private renderCharCard(c: CharacterDef): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = "menu__char";
    if (c.id === this.selectedId) btn.classList.add("selected");
    const weapon = this.registry.find("weapon", c.startWeaponId);
    const unlocked = this.meta.isUnlocked(c.id);
    btn.disabled = !unlocked;
    btn.innerHTML = `
      <div class="menu__char-name">${escapeHtml(c.name)}</div>
      <div class="menu__char-stats">
        HP ${c.baseHp}<br>
        Velocidade ${c.baseSpeed}<br>
        Arma: ${escapeHtml(weapon?.name ?? c.startWeaponId)}
      </div>
      ${unlocked ? "" : `<div class="menu__char-locked">${escapeHtml(lockHint(c.id))}</div>`}
    `;
    if (unlocked) {
      btn.addEventListener("click", () => {
        this.selectedId = c.id;
        for (const el of this.root!.querySelectorAll(".menu__char")) el.classList.remove("selected");
        btn.classList.add("selected");
      });
    }
    return btn;
  }
}

function lockHint(characterId: string): string {
  const rule: UnlockRule | undefined = UNLOCK_RULES.find((r) => r.characterId === characterId);
  return rule?.label ?? "Bloqueado";
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
