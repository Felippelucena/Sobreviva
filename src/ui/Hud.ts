import type { GameState } from "../game/GameState";
import type { World } from "../engine/World";
import { Health, PlayerProgress } from "../game/components";

export class Hud {
  private readonly root: HTMLDivElement;
  private readonly hpFill: HTMLDivElement;
  private readonly hpText: HTMLDivElement;
  private readonly xpFill: HTMLDivElement;
  private readonly xpLevelEl: HTMLSpanElement;
  private readonly xpValueEl: HTMLSpanElement;
  private readonly timerEl: HTMLDivElement;
  private readonly killEl: HTMLSpanElement;

  constructor(private readonly host: HTMLElement) {
    const root = document.createElement("div");
    root.className = "hud";
    root.innerHTML = `
      <div class="hud__hp-wrap">
        <div class="hud__hp-label">HP</div>
        <div class="hud__hp-bar"><div class="hud__hp-fill"></div></div>
        <div class="hud__hp-text">100 / 100</div>
      </div>
      <div class="hud__xp-wrap">
        <div class="hud__xp-label">
          <span>Nível <span class="hud__xp-level">1</span></span>
          <span class="hud__xp-value">0 / 5</span>
        </div>
        <div class="hud__xp-bar"><div class="hud__xp-fill"></div></div>
      </div>
      <div class="hud__topright">
        <div>Tempo <span class="hud__timer">00:00</span></div>
        <div>Kills <span class="hud__kill-count">0</span></div>
      </div>
    `;
    this.host.appendChild(root);
    this.root = root;
    this.hpFill = root.querySelector<HTMLDivElement>(".hud__hp-fill")!;
    this.hpText = root.querySelector<HTMLDivElement>(".hud__hp-text")!;
    this.xpFill = root.querySelector<HTMLDivElement>(".hud__xp-fill")!;
    this.xpLevelEl = root.querySelector<HTMLSpanElement>(".hud__xp-level")!;
    this.xpValueEl = root.querySelector<HTMLSpanElement>(".hud__xp-value")!;
    this.timerEl = root.querySelector<HTMLDivElement>(".hud__timer")!;
    this.killEl = root.querySelector<HTMLSpanElement>(".hud__kill-count")!;
  }

  update(world: World, state: GameState): void {
    if (state.playerId !== null) {
      const hp = world.get(state.playerId, Health);
      if (hp) {
        const ratio = Math.max(0, hp.current / hp.max);
        this.hpFill.style.transform = `scaleX(${ratio})`;
        this.hpText.textContent = `${Math.max(0, Math.round(hp.current))} / ${hp.max}`;
      }
      const progress = world.get(state.playerId, PlayerProgress);
      if (progress) {
        const ratio = Math.min(1, progress.xp / progress.xpForNext);
        this.xpFill.style.transform = `scaleX(${ratio})`;
        this.xpLevelEl.textContent = String(progress.level);
        this.xpValueEl.textContent = `${progress.xp} / ${progress.xpForNext}`;
      }
    }
    this.timerEl.textContent = formatMs(state.runTimeMs);
    this.killEl.textContent = String(state.kills);
  }

  dispose(): void {
    this.root.remove();
  }
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
