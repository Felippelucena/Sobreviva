import type { ContentRegistry } from "../content/registry/ContentRegistry";
import type { CharacterDef, MapDef } from "../content/schema";
import type { MetaManager, UnlockRule } from "../persistence/Meta";
import { UNLOCK_RULES } from "../persistence/Meta";

export interface MainMenuCallbacks {
  onStart: (characterId: string, mapId: string, waveId: string) => void;
  onOpenEditor: () => void;
  onOpenMods: () => void;
}

export interface MainMenuInitial {
  characterId?: string;
  mapId?: string | null;
  waveId?: string | null;
}

export class MainMenu {
  private root: HTMLDivElement | null = null;
  private selectedCharacterId: string;
  private selectedMapId: string;
  private readonly waveByMap = new Map<string, string>();

  constructor(
    private readonly host: HTMLElement,
    private readonly registry: ContentRegistry,
    private readonly meta: MetaManager,
    private readonly callbacks: MainMenuCallbacks,
    initial: MainMenuInitial = {},
  ) {
    const characters = registry.list("character");
    const initialChar = characters.find(
      (c) => meta.isUnlocked(c.id) && (!initial.characterId || c.id === initial.characterId),
    );
    this.selectedCharacterId = initialChar?.id ?? "runner_hero";

    const maps = registry.list("map");
    const initialMap = maps.find(
      (m) => meta.isMapUnlocked(m) && (!initial.mapId || m.id === initial.mapId),
    );
    this.selectedMapId = initialMap?.id ?? maps.find((m) => meta.isMapUnlocked(m))?.id ?? maps[0]?.id ?? "";

    for (const m of maps) {
      const preferred =
        initial.mapId === m.id && initial.waveId && this.isValidWaveId(initial.waveId)
          ? initial.waveId
          : m.waveId;
      this.waveByMap.set(m.id, preferred);
    }
  }

  show(): void {
    this.close();
    const characters = this.registry.list("character");
    const maps = this.registry.list("map");
    const root = document.createElement("div");
    root.className = "menu";
    const best = this.meta.state.bestRun;
    root.innerHTML = `
      <div class="menu__panel">
        <h1 class="menu__title">SOBREVIVA</h1>
        <p class="menu__tagline">Sobreviva. Colete. Evolua.</p>
        <div class="menu__section-title">Personagem</div>
        <div class="menu__char-grid"></div>
        <div class="menu__section-title">Mapa</div>
        <div class="menu__map-grid"></div>
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
    const charGrid = root.querySelector<HTMLDivElement>(".menu__char-grid")!;
    for (const c of characters) charGrid.appendChild(this.renderCharCard(c));

    const mapGrid = root.querySelector<HTMLDivElement>(".menu__map-grid")!;
    for (const m of maps) mapGrid.appendChild(this.renderMapCard(m));

    root.querySelector<HTMLButtonElement>('[data-action="start"]')!.addEventListener("click", () => {
      const waveId = this.waveByMap.get(this.selectedMapId);
      if (!this.selectedMapId || !waveId) return;
      this.callbacks.onStart(this.selectedCharacterId, this.selectedMapId, waveId);
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
    if (c.id === this.selectedCharacterId) btn.classList.add("selected");
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
      ${unlocked ? "" : `<div class="menu__char-locked">${escapeHtml(charLockHint(c.id))}</div>`}
    `;
    if (unlocked) {
      btn.addEventListener("click", () => {
        this.selectedCharacterId = c.id;
        for (const el of this.root!.querySelectorAll(".menu__char")) el.classList.remove("selected");
        btn.classList.add("selected");
      });
    }
    return btn;
  }

  private renderMapCard(m: MapDef): HTMLDivElement {
    const card = document.createElement("div");
    card.className = "menu__map";
    if (m.id === this.selectedMapId) card.classList.add("selected");
    const unlocked = this.meta.isMapUnlocked(m);
    if (!unlocked) card.classList.add("locked");

    const waves = this.registry.list("wave");
    const currentWaveId = this.waveByMap.get(m.id) ?? m.waveId;
    const lockHint = unlocked ? null : this.meta.mapLockHint(m);

    const waveOptions = waves
      .map(
        (w) =>
          `<option value="${escapeHtml(w.id)}"${w.id === currentWaveId ? " selected" : ""}>${escapeHtml(w.id)}</option>`,
      )
      .join("");

    card.innerHTML = `
      <div class="menu__map-swatch" style="background:#${m.backgroundColor.toString(16).padStart(6, "0")}"></div>
      <div class="menu__map-body">
        <div class="menu__map-name">${escapeHtml(m.name)}</div>
        <label class="menu__map-wave">
          <span>Wave</span>
          <select ${unlocked ? "" : "disabled"}>${waveOptions}</select>
        </label>
        ${lockHint ? `<div class="menu__map-locked">${escapeHtml(lockHint)}</div>` : ""}
      </div>
    `;

    const select = card.querySelector<HTMLSelectElement>("select")!;
    select.addEventListener("change", () => {
      this.waveByMap.set(m.id, select.value);
    });
    select.addEventListener("click", (e) => e.stopPropagation());

    if (unlocked) {
      card.addEventListener("click", () => {
        this.selectedMapId = m.id;
        for (const el of this.root!.querySelectorAll(".menu__map")) el.classList.remove("selected");
        card.classList.add("selected");
      });
    }
    return card;
  }

  private isValidWaveId(id: string): boolean {
    return this.registry.find("wave", id) !== undefined;
  }
}

function charLockHint(characterId: string): string {
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
