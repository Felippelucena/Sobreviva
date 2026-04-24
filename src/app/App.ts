import { buildRegistry, loadBasePack } from "../content";
import type { LoadedPack } from "../content/PackLoader";
import type { ContentRegistry } from "../content/registry/ContentRegistry";
import { JsRuntime } from "../mods/JsRuntime";
import { ModManager } from "../mods/ModManager";
import { MetaManager, type RunResult, type UnlockRule } from "../persistence/Meta";
import { MainMenu } from "../ui/MainMenu";
import { ModsMenu } from "../ui/ModsMenu";
import { PauseMenu } from "../ui/PauseMenu";
import { RunSummary } from "../ui/RunSummary";
import { Game, type GameResult } from "./Game";

type Screen = "menu" | "playing" | "summary";

export interface AppCallbacks {
  onNavigateEditor: () => void;
}

export class App {
  private basePack: LoadedPack | null = null;
  private registry: ContentRegistry | null = null;
  private readonly meta = new MetaManager();
  private readonly mods = new ModManager();
  private readonly jsRuntime = new JsRuntime();
  private readonly pauseMenu: PauseMenu;
  private readonly runSummary: RunSummary;
  private modsMenu: ModsMenu | null = null;
  private mainMenu: MainMenu | null = null;
  private currentGame: Game | null = null;
  private screen: Screen = "menu";
  private lastCharacterId = "runner_hero";
  private readonly onKeyDown: (e: KeyboardEvent) => void;

  constructor(
    private readonly host: HTMLElement,
    private readonly callbacks: AppCallbacks,
  ) {
    this.pauseMenu = new PauseMenu(host);
    this.runSummary = new RunSummary(host);
    this.onKeyDown = (e) => {
      if (e.code !== "Escape") return;
      if (this.modsMenu?.isOpen()) {
        e.preventDefault();
        this.closeModsMenu();
        return;
      }
      if (this.screen !== "playing") return;
      if (this.currentGame?.isUpgradeModalOpen()) return;
      e.preventDefault();
      if (this.pauseMenu.isOpen()) this.resumeGame();
      else this.pauseGame();
    };
    window.addEventListener("keydown", this.onKeyDown);
  }

  async start(): Promise<void> {
    this.host.innerHTML = '<div style="display:grid;place-items:center;height:100%;opacity:.6">Carregando...</div>';
    this.basePack = await loadBasePack();
    await this.reloadMods();
    this.showMenu();
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    this.pauseMenu.dispose();
    this.runSummary.dispose();
    this.modsMenu?.dispose();
    this.mainMenu?.close();
    this.currentGame?.dispose();
    this.currentGame = null;
  }

  private async reloadMods(): Promise<void> {
    if (!this.basePack) return;
    const result = await this.jsRuntime.loadMods(this.mods);
    if (result.errors.length > 0) {
      console.warn("[App] some mods failed to load:", result.errors);
    }
    this.registry = buildRegistry(this.basePack, [
      ...this.mods.enabledLoadedPacks(),
      ...this.jsRuntime.syntheticPacks(),
    ]);
  }

  private showMenu(): void {
    if (!this.registry) return;
    this.tearDownGame();
    this.runSummary.close();
    this.pauseMenu.close();
    this.modsMenu?.close();
    this.host.innerHTML = "";
    this.screen = "menu";
    this.mainMenu = new MainMenu(
      this.host,
      this.registry,
      this.meta,
      {
        onStart: (id) => this.startRun(id),
        onOpenEditor: () => this.callbacks.onNavigateEditor(),
        onOpenMods: () => this.openModsMenu(),
      },
      this.lastCharacterId,
    );
    this.mainMenu.show();
  }

  private openModsMenu(): void {
    if (!this.basePack) return;
    this.modsMenu?.close();
    this.modsMenu = new ModsMenu(this.host, this.mods, this.basePack);
    this.modsMenu.show({
      onClose: () => this.closeModsMenu(),
      onChanged: async () => {
        await this.reloadMods();
      },
    });
  }

  private async closeModsMenu(): Promise<void> {
    this.modsMenu?.close();
    this.modsMenu = null;
    await this.reloadMods();
    if (this.screen === "menu") this.showMenu();
  }

  private async startRun(characterId: string): Promise<void> {
    if (!this.registry) return;
    this.lastCharacterId = characterId;
    this.mainMenu?.close();
    this.runSummary.close();
    this.pauseMenu.close();
    this.modsMenu?.close();
    this.screen = "playing";
    this.currentGame = new Game({
      host: this.host,
      registry: this.registry,
      characterId,
      onRunEnded: (result) => this.handleRunEnded(result),
      jsRuntime: this.jsRuntime.hasMods() ? this.jsRuntime : null,
    });
    await this.currentGame.start();
  }

  private pauseGame(): void {
    if (!this.currentGame) return;
    this.currentGame.setExternalPause(true);
    this.pauseMenu.show({
      onResume: () => this.resumeGame(),
      onQuit: () => this.currentGame?.endRun(),
    });
  }

  private resumeGame(): void {
    if (!this.currentGame) return;
    this.pauseMenu.close();
    this.currentGame.setExternalPause(false);
  }

  private handleRunEnded(result: GameResult): void {
    this.pauseMenu.close();
    const runResult: RunResult = {
      characterId: result.characterId,
      timeMs: result.timeMs,
      kills: result.kills,
      level: result.level,
    };
    const { newlyUnlocked } = this.meta.recordRun(runResult);
    this.showSummary(runResult, newlyUnlocked);
  }

  private showSummary(result: RunResult, unlocks: readonly UnlockRule[]): void {
    this.screen = "summary";
    this.runSummary.show(result, unlocks, {
      onPlayAgain: () => this.startRun(result.characterId),
      onBackToMenu: () => this.showMenu(),
    });
  }

  private tearDownGame(): void {
    if (!this.currentGame) return;
    this.currentGame.dispose();
    this.currentGame = null;
  }
}
