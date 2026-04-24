export interface PauseMenuCallbacks {
  onResume: () => void;
  onQuit: () => void;
}

export class PauseMenu {
  private root: HTMLDivElement | null = null;

  constructor(private readonly host: HTMLElement) {}

  show(cbs: PauseMenuCallbacks): void {
    this.close();
    const root = document.createElement("div");
    root.className = "pause-menu";
    root.innerHTML = `
      <div class="pause-menu__panel">
        <h2>Pausado</h2>
        <div class="pause-menu__actions">
          <button class="menu__btn menu__btn--primary" data-action="resume">Continuar</button>
          <button class="menu__btn" data-action="quit">Desistir</button>
        </div>
      </div>
    `;
    root
      .querySelector<HTMLButtonElement>('[data-action="resume"]')!
      .addEventListener("click", () => cbs.onResume());
    root
      .querySelector<HTMLButtonElement>('[data-action="quit"]')!
      .addEventListener("click", () => cbs.onQuit());
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
