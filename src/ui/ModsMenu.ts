import { bundleFromLoadedPack, downloadBundle } from "../content/bundle";
import type { LoadedPack } from "../content/PackLoader";
import type { ModManager, StoredMod } from "../mods/ModManager";

const EXAMPLE_PACKS: readonly { url: string; label: string; note: string }[] = [
  {
    url: "./packs/examples/rapid-fire.sobrevivapack.json",
    label: "Rapid Fire",
    note: "JSON-only — spark mais rápido",
  },
  {
    url: "./packs/examples/xp-burst.sobrevivapack.json",
    label: "XP Burst",
    note: "JS — cada morte dropa XP extra",
  },
];

export interface ModsMenuCallbacks {
  onClose: () => void;
  onChanged: () => void;
}

export class ModsMenu {
  private root: HTMLDivElement | null = null;
  private errorEl: HTMLDivElement | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly manager: ModManager,
    private readonly basePack: LoadedPack,
  ) {}

  show(cbs: ModsMenuCallbacks): void {
    this.close();
    const root = document.createElement("div");
    root.className = "mods";
    root.innerHTML = `
      <div class="mods__panel">
        <div class="mods__header">
          <h2>Mods</h2>
          <button class="menu__btn" data-action="close">Fechar</button>
        </div>
        <div class="mods__section-title">Pack base</div>
        <div class="mods__base"></div>
        <div class="mods__section-title">Mods instalados</div>
        <div class="mods__list"></div>
        <div class="mods__import">
          <div class="mods__section-title" style="margin-top:0">Importar</div>
          <input type="file" accept=".json,application/json" class="mods__file" />
          <div class="mods__import-row">
            <input type="text" class="mods__url" placeholder="https://... (URL de um .sobrevivapack.json)" />
            <button class="menu__btn" data-action="import-url">Carregar URL</button>
          </div>
          <div class="mods__error" style="display:none"></div>
        </div>
        <div class="mods__section-title">Exemplos</div>
        <div class="mods__examples"></div>
        <div class="mods__note">Mudanças aplicam no próximo jogo (volte ao menu e comece uma run).</div>
      </div>
    `;
    root.querySelector<HTMLButtonElement>('[data-action="close"]')!.addEventListener("click", () =>
      cbs.onClose(),
    );
    root.addEventListener("click", (e) => {
      if (e.target === root) cbs.onClose();
    });

    this.errorEl = root.querySelector<HTMLDivElement>(".mods__error");
    this.renderBase(root.querySelector<HTMLDivElement>(".mods__base")!);
    this.renderList(root, cbs);
    this.renderExamples(root.querySelector<HTMLDivElement>(".mods__examples")!, cbs);

    root.querySelector<HTMLInputElement>(".mods__file")!.addEventListener("change", async (e) => {
      const input = e.currentTarget as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const raw = JSON.parse(text);
        this.manager.import(raw);
        this.clearError();
        cbs.onChanged();
        this.refresh(cbs);
      } catch (err) {
        this.showError(err);
      } finally {
        input.value = "";
      }
    });

    root.querySelector<HTMLButtonElement>('[data-action="import-url"]')!.addEventListener(
      "click",
      async () => {
        const input = root.querySelector<HTMLInputElement>(".mods__url")!;
        const url = input.value.trim();
        if (!url) return;
        await this.importUrl(url, cbs, input);
      },
    );

    this.host.appendChild(root);
    this.root = root;
  }

  close(): void {
    if (this.root) {
      this.root.remove();
      this.root = null;
      this.errorEl = null;
    }
  }

  isOpen(): boolean {
    return this.root !== null;
  }

  dispose(): void {
    this.close();
  }

  private refresh(cbs: ModsMenuCallbacks): void {
    if (!this.root) return;
    this.renderList(this.root, cbs);
  }

  private renderBase(container: HTMLDivElement): void {
    container.innerHTML = "";
    const row = document.createElement("div");
    row.className = "mods__row mods__row--base";
    const m = this.basePack.manifest;
    row.innerHTML = `
      <div>
        <div class="mods__row-title">${escapeHtml(m.name)}</div>
        <div class="mods__row-sub">id: ${escapeHtml(m.id)} · v${escapeHtml(m.version)} · ${this.basePack.defs.length} defs</div>
      </div>
      <button class="mods__row-btn" data-action="export-base">Exportar</button>
    `;
    row.querySelector<HTMLButtonElement>('[data-action="export-base"]')!.addEventListener(
      "click",
      () => downloadBundle(bundleFromLoadedPack(this.basePack)),
    );
    container.appendChild(row);
  }

  private renderList(root: HTMLDivElement, cbs: ModsMenuCallbacks): void {
    const list = root.querySelector<HTMLDivElement>(".mods__list")!;
    list.innerHTML = "";
    const mods = this.manager.list();
    if (mods.length === 0) {
      const empty = document.createElement("div");
      empty.className = "mods__empty";
      empty.textContent = "Nenhum mod instalado. Importe um abaixo ou exporte o pack base para editar.";
      list.appendChild(empty);
      return;
    }
    for (const mod of mods) {
      list.appendChild(this.renderModRow(mod, cbs));
    }
  }

  private renderExamples(container: HTMLDivElement, cbs: ModsMenuCallbacks): void {
    container.innerHTML = "";
    for (const ex of EXAMPLE_PACKS) {
      const row = document.createElement("div");
      row.className = "mods__row mods__row--base";
      row.innerHTML = `
        <div>
          <div class="mods__row-title">${escapeHtml(ex.label)}</div>
          <div class="mods__row-sub">${escapeHtml(ex.note)}</div>
        </div>
        <button class="mods__row-btn" data-action="load-example">Carregar</button>
      `;
      row.querySelector<HTMLButtonElement>('[data-action="load-example"]')!.addEventListener(
        "click",
        async () => {
          await this.importUrl(ex.url, cbs);
        },
      );
      container.appendChild(row);
    }
  }

  private async importUrl(url: string, cbs: ModsMenuCallbacks, inputToClear?: HTMLInputElement): Promise<void> {
    try {
      await this.manager.importFromUrl(url);
      this.clearError();
      if (inputToClear) inputToClear.value = "";
      cbs.onChanged();
      this.refresh(cbs);
    } catch (err) {
      this.showError(err);
    }
  }

  private renderModRow(mod: StoredMod, cbs: ModsMenuCallbacks): HTMLDivElement {
    const m = mod.bundle.manifest;
    const hasScripts = mod.bundle.scripts.length > 0;
    const hasConsent = this.manager.hasJsConsent(m.id);

    const row = document.createElement("div");
    row.className = "mods__row";
    const jsChip = hasScripts
      ? hasConsent
        ? `<span class="mods__js-chip mods__js-chip--ok" title="JS permitido para v${escapeHtml(m.version)}">JS ✓</span>`
        : `<span class="mods__js-chip mods__js-chip--warn" title="Contém JavaScript">JS ⚠</span>`
      : "";

    row.innerHTML = `
      <div>
        <div class="mods__row-title">${escapeHtml(m.name)} ${jsChip}</div>
        <div class="mods__row-sub">id: ${escapeHtml(m.id)} · v${escapeHtml(m.version)} · ${mod.bundle.defs.length} defs${hasScripts ? ` · ${mod.bundle.scripts.length} scripts` : ""}</div>
      </div>
      <label class="mods__row-toggle">
        <input type="checkbox" ${mod.enabled ? "checked" : ""} />
        Ativo
      </label>
      <input type="number" class="mods__row-priority" value="${mod.priority}" title="Prioridade (maior sobrescreve menor)" />
      <button class="mods__row-btn" data-action="export">Exportar</button>
      <button class="mods__row-btn mods__row-btn--danger" data-action="remove">Remover</button>
    `;
    row.querySelector<HTMLInputElement>(".mods__row-toggle input")!.addEventListener("change", (e) => {
      this.manager.setEnabled(m.id, (e.currentTarget as HTMLInputElement).checked);
      cbs.onChanged();
    });
    row.querySelector<HTMLInputElement>(".mods__row-priority")!.addEventListener("blur", (e) => {
      const v = Number((e.currentTarget as HTMLInputElement).value);
      if (Number.isFinite(v)) this.manager.setPriority(m.id, v);
      cbs.onChanged();
      this.refresh(cbs);
    });
    row.querySelector<HTMLButtonElement>('[data-action="export"]')!.addEventListener("click", () =>
      downloadBundle(mod.bundle),
    );
    row.querySelector<HTMLButtonElement>('[data-action="remove"]')!.addEventListener("click", () => {
      if (!confirm(`Remover mod "${m.name}"?`)) return;
      this.manager.remove(m.id);
      cbs.onChanged();
      this.refresh(cbs);
    });

    if (hasScripts) {
      const jsRow = document.createElement("div");
      jsRow.className = "mods__js-row";
      if (hasConsent) {
        jsRow.innerHTML = `
          <div>Scripts JS permitidos para esta versão.</div>
          <button class="mods__row-btn" data-action="revoke">Revogar</button>
        `;
        jsRow.querySelector<HTMLButtonElement>('[data-action="revoke"]')!.addEventListener(
          "click",
          () => {
            this.manager.revokeJsConsent(m.id);
            cbs.onChanged();
            this.refresh(cbs);
          },
        );
      } else {
        jsRow.innerHTML = `
          <div>Este mod contém JavaScript (${mod.bundle.scripts.length} script${mod.bundle.scripts.length > 1 ? "s" : ""}). Executar código arbitrário é um risco de segurança.</div>
          <button class="mods__row-btn mods__js-allow" data-action="allow">Permitir JS</button>
        `;
        jsRow.querySelector<HTMLButtonElement>('[data-action="allow"]')!.addEventListener(
          "click",
          () => {
            if (!confirmJs(mod)) return;
            this.manager.grantJsConsent(m.id);
            cbs.onChanged();
            this.refresh(cbs);
          },
        );
      }
      const wrap = document.createElement("div");
      wrap.className = "mods__row-with-js";
      wrap.appendChild(row);
      wrap.appendChild(jsRow);
      return wrap as unknown as HTMLDivElement;
    }

    return row;
  }

  private showError(err: unknown): void {
    if (!this.errorEl) return;
    const msg = err instanceof Error ? err.message : String(err);
    this.errorEl.textContent = msg;
    this.errorEl.style.display = "block";
  }

  private clearError(): void {
    if (!this.errorEl) return;
    this.errorEl.textContent = "";
    this.errorEl.style.display = "none";
  }
}

function confirmJs(mod: StoredMod): boolean {
  const m = mod.bundle.manifest;
  const scriptList = mod.bundle.scripts.map((s) => ` - ${s.name} (${s.code.length} caracteres)`).join("\n");
  const msg = `Permitir JS do mod "${m.name}" v${m.version}?\n\nScripts:\n${scriptList}\n\nExecutar código arbitrário de fontes desconhecidas é um risco. Só aceite se confia na origem.`;
  return confirm(msg);
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
