import { bundleFromLoadedPack, downloadBundle, parseBundle } from "../content/bundle";
import { loadBasePack } from "../content";
import type { LoadedPack } from "../content/PackLoader";
import {
  AnyDef,
  CharacterDef,
  EnemyDef,
  MapDef,
  PickupDef,
  UpgradeDef,
  WaveDef,
  WeaponDef,
} from "../content/schema";
import { ModManager } from "../mods/ModManager";
import { LivePreview } from "./LivePreview";
import { renderPropertyGrid } from "./PropertyGrid";
import {
  WorkingPack,
  blankCharacter,
  blankEnemy,
  blankMap,
  blankPickup,
  blankUpgrade,
  blankWave,
  blankWeapon,
  type DefKindOf,
} from "./WorkingPack";
import { renderWaveEditor } from "./WaveEditor";

type Kind = AnyDef["kind"];

const TABS: readonly { kind: Kind; label: string }[] = [
  { kind: "weapon", label: "Armas" },
  { kind: "enemy", label: "Inimigos" },
  { kind: "pickup", label: "Pickups" },
  { kind: "character", label: "Personagens" },
  { kind: "map", label: "Mapas" },
  { kind: "wave", label: "Ondas" },
  { kind: "upgrade", label: "Melhorias" },
];

const COMPACT_KINDS = new Set<Kind>(["upgrade", "weapon", "enemy", "character"]);

export interface EditorCallbacks {
  onBackToGame: () => void;
}

export class Editor {
  private readonly working = new WorkingPack();
  private readonly mods = new ModManager();
  private basePack: LoadedPack | null = null;
  private preview: LivePreview | null = null;
  private toolbar: HTMLDivElement | null = null;
  private listEl: HTMLDivElement | null = null;
  private formEl: HTMLDivElement | null = null;
  private previewHost: HTMLDivElement | null = null;
  private tabsEl: HTMLDivElement | null = null;
  private currentKind: Kind = "weapon";
  private currentId: string | null = null;
  private unsubscribe: (() => void) | null = null;
  private suppressFormRerender = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly callbacks: EditorCallbacks,
  ) {}

  async start(): Promise<void> {
    this.host.innerHTML = '<div style="display:grid;place-items:center;height:100%;opacity:.6">Carregando editor...</div>';
    this.basePack = await loadBasePack();
    this.renderShell();
    this.preview = new LivePreview(this.previewHost!);
    await this.preview.init();
    this.unsubscribe = this.working.subscribe(() => {
      this.renderList();
      if (!this.suppressFormRerender) this.renderForm();
      this.updatePreview();
    });
    this.selectFirstOrCreate();
    this.updatePreview();
  }

  dispose(): void {
    this.unsubscribe?.();
    this.preview?.dispose();
    this.preview = null;
  }

  private renderShell(): void {
    this.host.innerHTML = "";
    const root = document.createElement("div");
    root.className = "editor";
    root.innerHTML = `
      <div class="editor__toolbar">
        <div class="editor__brand">EDITOR</div>
        <div class="editor__manifest"></div>
        <div class="editor__actions">
          <button class="editor__btn" data-action="seed">Partir do base</button>
          <button class="editor__btn" data-action="import-file">Importar</button>
          <button class="editor__btn" data-action="export">Exportar</button>
          <button class="editor__btn editor__btn--primary" data-action="apply">Aplicar como mod</button>
          <button class="editor__btn editor__btn--danger" data-action="reset">Limpar</button>
          <button class="editor__btn" data-action="back">← Jogo</button>
        </div>
      </div>
      <div class="editor__main">
        <div class="editor__tabs"></div>
        <div class="editor__list"></div>
        <div class="editor__form"></div>
        <div class="editor__preview">
          <div class="editor__preview-title">Preview</div>
          <div class="editor__preview-canvas"></div>
        </div>
      </div>
    `;
    this.host.appendChild(root);
    this.toolbar = root.querySelector<HTMLDivElement>(".editor__toolbar");
    this.tabsEl = root.querySelector<HTMLDivElement>(".editor__tabs");
    this.listEl = root.querySelector<HTMLDivElement>(".editor__list");
    this.formEl = root.querySelector<HTMLDivElement>(".editor__form");
    this.previewHost = root.querySelector<HTMLDivElement>(".editor__preview-canvas");

    this.renderManifestBar();
    this.renderTabs();
    this.renderList();

    root
      .querySelector<HTMLButtonElement>('[data-action="back"]')!
      .addEventListener("click", () => this.callbacks.onBackToGame());
    root
      .querySelector<HTMLButtonElement>('[data-action="seed"]')!
      .addEventListener("click", () => this.seedFromBase());
    root
      .querySelector<HTMLButtonElement>('[data-action="import-file"]')!
      .addEventListener("click", () => this.importFile());
    root
      .querySelector<HTMLButtonElement>('[data-action="export"]')!
      .addEventListener("click", () => this.exportBundle());
    root
      .querySelector<HTMLButtonElement>('[data-action="apply"]')!
      .addEventListener("click", () => this.applyAsMod());
    root
      .querySelector<HTMLButtonElement>('[data-action="reset"]')!
      .addEventListener("click", () => {
        if (!confirm("Apagar o pack em edição?")) return;
        this.working.reset();
        this.currentId = null;
        this.renderManifestBar();
      });
  }

  private renderManifestBar(): void {
    if (!this.toolbar) return;
    const host = this.toolbar.querySelector<HTMLDivElement>(".editor__manifest")!;
    const m = this.working.manifest;
    host.innerHTML = `
      <input name="id" placeholder="id" value="${escapeAttr(m.id)}" />
      <input name="name" placeholder="nome" value="${escapeAttr(m.name)}" />
      <input name="version" placeholder="versão" value="${escapeAttr(m.version)}" />
      <input name="priority" type="number" step="1" value="${m.priority}" />
    `;
    host.querySelector<HTMLInputElement>('input[name="id"]')!.addEventListener("change", (e) => {
      this.working.updateManifest({ id: (e.currentTarget as HTMLInputElement).value.trim() });
    });
    host.querySelector<HTMLInputElement>('input[name="name"]')!.addEventListener("change", (e) => {
      this.working.updateManifest({ name: (e.currentTarget as HTMLInputElement).value });
    });
    host.querySelector<HTMLInputElement>('input[name="version"]')!.addEventListener("change", (e) => {
      this.working.updateManifest({ version: (e.currentTarget as HTMLInputElement).value });
    });
    host.querySelector<HTMLInputElement>('input[name="priority"]')!.addEventListener("change", (e) => {
      const n = Number((e.currentTarget as HTMLInputElement).value);
      if (Number.isFinite(n)) this.working.updateManifest({ priority: Math.round(n) });
    });
  }

  private renderTabs(): void {
    if (!this.tabsEl) return;
    this.tabsEl.innerHTML = "";
    for (const tab of TABS) {
      const btn = document.createElement("button");
      btn.className = "editor__tab";
      if (tab.kind === this.currentKind) btn.classList.add("active");
      btn.textContent = `${tab.label} (${this.working.list(tab.kind).length})`;
      btn.addEventListener("click", () => {
        this.currentKind = tab.kind;
        this.currentId = null;
        this.renderTabs();
        this.renderList();
        this.selectFirstOrCreate();
      });
      this.tabsEl.appendChild(btn);
    }
  }

  private renderList(): void {
    if (!this.listEl) return;
    const kind = this.currentKind;
    this.listEl.innerHTML = "";
    const header = document.createElement("div");
    header.className = "editor__list-header";
    header.innerHTML = `
      <div class="editor__list-title">${kindLabel(kind)}</div>
      <button class="editor__btn" data-action="new">+ Novo</button>
    `;
    header.querySelector<HTMLButtonElement>('[data-action="new"]')!.addEventListener("click", () =>
      this.createNew(),
    );
    this.listEl.appendChild(header);

    const items = this.working.list(kind);
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "editor__list-empty";
      empty.textContent = `Nenhum ${kindLabel(kind).toLowerCase()}. Clique em “+ Novo” ou importe o pack base.`;
      this.listEl.appendChild(empty);
      this.renderTabs();
      return;
    }
    for (const def of items) {
      const btn = document.createElement("button");
      btn.className = "editor__list-item";
      if (def.id === this.currentId) btn.classList.add("active");
      btn.innerHTML = `
        <div>${escapeHtml(defTitle(def))}</div>
        <div class="editor__list-item-sub">${escapeHtml(def.id)}</div>
      `;
      btn.addEventListener("click", () => {
        this.currentId = def.id;
        this.renderList();
        this.renderForm();
        this.updatePreview();
      });
      this.listEl.appendChild(btn);
    }
    this.renderTabs();
  }

  private renderForm(): void {
    if (!this.formEl) return;
    const kind = this.currentKind;
    const def = this.currentId ? this.working.get(kind, this.currentId) : undefined;
    this.formEl.innerHTML = "";
    if (!def) {
      const empty = document.createElement("div");
      empty.className = "editor__form-empty";
      empty.textContent = "Selecione um item na lista ou crie um novo.";
      this.formEl.appendChild(empty);
      return;
    }

    const header = document.createElement("div");
    header.className = "editor__form-header";
    header.innerHTML = `
      <div class="editor__form-id">
        <label>id</label>
        <input type="text" value="${escapeAttr(def.id)}" />
      </div>
      <button class="editor__btn" data-action="duplicate">Duplicar</button>
      <button class="editor__btn editor__btn--danger" data-action="delete">Excluir</button>
    `;
    const idInput = header.querySelector<HTMLInputElement>("input")!;
    idInput.addEventListener("change", () => {
      const newId = idInput.value.trim();
      if (!newId || newId === def.id) return;
      try {
        const clone: AnyDef = { ...def, id: newId } as AnyDef;
        this.working.upsert(clone, def.id);
        this.currentId = newId;
      } catch (e) {
        this.showError(e);
        idInput.value = def.id;
      }
    });
    header.querySelector<HTMLButtonElement>('[data-action="duplicate"]')!.addEventListener(
      "click",
      () => {
        const clone = this.working.duplicate(kind, def.id);
        if (clone) this.currentId = clone.id;
      },
    );
    header.querySelector<HTMLButtonElement>('[data-action="delete"]')!.addEventListener(
      "click",
      () => {
        if (!confirm(`Excluir ${kind} "${def.id}"?`)) return;
        this.working.delete(kind, def.id);
        this.currentId = null;
      },
    );
    this.formEl.appendChild(header);

    const errorEl = document.createElement("div");
    errorEl.className = "editor__form-error";
    errorEl.style.display = "none";
    this.formEl.appendChild(errorEl);

    if (kind === "wave") {
      const editor = renderWaveEditor({
        value: def as WaveDef,
        enemyIds: this.enemyIdChoices(),
        onChange: (next) => this.patchDef(next),
      });
      this.formEl.appendChild(editor);
      return;
    }

    const schema = pickSchemaFor(kind);
    const formKind = kind;
    const grid = renderPropertyGrid({
      schema,
      // Read live from WorkingPack so closures never use a stale def reference.
      getValue: () => {
        const id = this.currentId;
        const cur = id ? this.working.get(formKind, id) : undefined;
        return (cur ?? def) as unknown as Record<string, unknown>;
      },
      omit: ["kind", "id"],
      compact: COMPACT_KINDS.has(kind),
      onChange: (next) => {
        const id = this.currentId;
        const cur = (id ? this.working.get(formKind, id) : undefined) ?? def;
        const merged = { ...cur, ...next } as AnyDef;
        this.patchDef(merged);
      },
    });
    this.formEl.appendChild(grid);
  }

  private patchDef(next: AnyDef): void {
    this.suppressFormRerender = true;
    try {
      this.working.upsert(next);
      this.currentId = next.id;
    } catch (e) {
      this.showError(e);
    } finally {
      this.suppressFormRerender = false;
    }
  }

  private updatePreview(): void {
    if (!this.preview) return;
    const weapon =
      this.currentKind === "weapon" && this.currentId
        ? this.working.get("weapon", this.currentId)
        : this.firstOfKind("weapon");
    const enemy =
      this.currentKind === "enemy" && this.currentId
        ? this.working.get("enemy", this.currentId)
        : this.firstOfKind("enemy");
    const character =
      this.currentKind === "character" && this.currentId
        ? this.working.get("character", this.currentId)
        : this.firstOfKind("character");
    this.preview.setWeapon(weapon ?? this.baseDefaultWeapon());
    this.preview.setEnemy(enemy ?? this.baseDefaultEnemy());
    this.preview.setCharacter(character ?? this.baseDefaultCharacter());
  }

  private firstOfKind<K extends AnyDef["kind"]>(kind: K): DefKindOf<K> | undefined {
    return this.working.list(kind)[0];
  }

  private baseDefaultWeapon(): WeaponDef | undefined {
    return this.basePack?.defs.find((d): d is WeaponDef => d.kind === "weapon");
  }

  private baseDefaultEnemy(): EnemyDef | undefined {
    return this.basePack?.defs.find((d): d is EnemyDef => d.kind === "enemy");
  }

  private baseDefaultCharacter(): CharacterDef | undefined {
    return this.basePack?.defs.find((d): d is CharacterDef => d.kind === "character");
  }

  private enemyIdChoices(): readonly string[] {
    const working = this.working.list("enemy").map((e) => e.id);
    const base = this.basePack?.defs
      .filter((d): d is EnemyDef => d.kind === "enemy")
      .map((e) => e.id) ?? [];
    return [...new Set([...base, ...working])];
  }

  private selectFirstOrCreate(): void {
    const items = this.working.list(this.currentKind);
    if (items.length > 0) {
      this.currentId = items[0]!.id;
    } else {
      this.currentId = null;
    }
    this.renderList();
    this.renderForm();
    this.updatePreview();
  }

  private createNew(): void {
    const kind = this.currentKind;
    const id = this.uniqueId(`new_${kind}`, kind);
    let def: AnyDef;
    switch (kind) {
      case "weapon":
        def = blankWeapon(id);
        break;
      case "enemy":
        def = blankEnemy(id);
        break;
      case "pickup":
        def = blankPickup(id);
        break;
      case "character": {
        const firstWeapon = this.firstOfKind("weapon") ?? this.baseDefaultWeapon();
        def = blankCharacter(id, firstWeapon?.id ?? "spark");
        break;
      }
      case "map": {
        const firstWave = this.firstOfKind("wave");
        def = blankMap(id, firstWave?.id ?? "default");
        break;
      }
      case "wave":
        def = blankWave(id);
        break;
      case "upgrade":
        def = blankUpgrade(id);
        break;
    }
    this.working.upsert(def);
    this.currentId = id;
  }

  private uniqueId(base: string, kind: Kind): string {
    let i = 1;
    let candidate = base;
    while (this.working.get(kind, candidate)) {
      i += 1;
      candidate = `${base}_${i}`;
    }
    return candidate;
  }

  private seedFromBase(): void {
    if (!this.basePack) return;
    if (this.working.bundle.defs.length > 0) {
      if (!confirm("Isto substitui o pack em edição pelo base. Continuar?")) return;
    }
    const bundle = bundleFromLoadedPack(this.basePack);
    bundle.manifest = { ...bundle.manifest, id: "my-pack", name: "Meu pack", priority: 100 };
    this.working.replaceBundle(bundle);
    this.renderManifestBar();
    this.selectFirstOrCreate();
    this.showToast("Pack base carregado para edição.");
  }

  private async importFile(): Promise<void> {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const bundle = parseBundle(JSON.parse(text));
        this.working.replaceBundle(bundle);
        this.renderManifestBar();
        this.selectFirstOrCreate();
        this.showToast(`Importado "${bundle.manifest.name}".`);
      } catch (e) {
        this.showError(e);
      }
    };
    input.click();
  }

  private exportBundle(): void {
    try {
      const bundle = parseBundle(this.working.bundle);
      downloadBundle(bundle);
      this.showToast("Pack exportado.");
    } catch (e) {
      this.showError(e);
    }
  }

  private applyAsMod(): void {
    try {
      this.mods.import(this.working.bundle);
      this.showToast(`Mod "${this.working.manifest.name}" aplicado. Volte ao jogo e comece uma run.`);
    } catch (e) {
      this.showError(e);
    }
  }

  private showError(err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err);
    this.showToast(msg, true);
  }

  private showToast(msg: string, isError = false): void {
    const toast = document.createElement("div");
    toast.className = "editor__toast" + (isError ? " editor__toast--err" : "");
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), isError ? 4500 : 2500);
  }
}

function kindLabel(kind: Kind): string {
  switch (kind) {
    case "weapon":
      return "Armas";
    case "enemy":
      return "Inimigos";
    case "pickup":
      return "Pickups";
    case "character":
      return "Personagens";
    case "map":
      return "Mapas";
    case "wave":
      return "Ondas";
    case "upgrade":
      return "Melhorias";
  }
}

function defTitle(def: AnyDef): string {
  switch (def.kind) {
    case "weapon":
    case "enemy":
    case "character":
    case "map":
    case "upgrade":
      return def.name;
    case "pickup":
      return `${def.effect} (${def.value})`;
    case "wave":
      return `${def.entries.length} entradas`;
  }
}

function pickSchemaFor(kind: Exclude<Kind, "wave">): import("zod").ZodObject<import("zod").ZodRawShape> {
  switch (kind) {
    case "weapon":
      return WeaponDef;
    case "enemy":
      return EnemyDef;
    case "pickup":
      return PickupDef;
    case "character":
      return CharacterDef;
    case "map":
      return MapDef;
    case "upgrade":
      return UpgradeDef;
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

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
