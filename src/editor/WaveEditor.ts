import type { WaveDef, WaveEntry } from "../content/schema";

export interface WaveEditorOptions {
  value: WaveDef;
  enemyIds: readonly string[];
  onChange: (next: WaveDef) => void;
}

export function renderWaveEditor(opts: WaveEditorOptions): HTMLElement {
  const root = document.createElement("div");
  root.className = "wave-editor";
  const header = document.createElement("div");
  header.className = "wave-editor__header";
  header.innerHTML = `
    <div>Entradas de spawn (${opts.value.entries.length})</div>
    <button class="mods__row-btn" data-action="add">+ Entrada</button>
  `;
  header.querySelector<HTMLButtonElement>('[data-action="add"]')!.addEventListener("click", () => {
    const next: WaveDef = {
      ...opts.value,
      entries: [
        ...opts.value.entries,
        { enemyId: opts.enemyIds[0] ?? "", startSec: 0, endSec: 600, ratePerSec: 1, burst: 0, cap: 0 },
      ],
    };
    opts.onChange(next);
  });
  root.appendChild(header);

  const table = document.createElement("div");
  table.className = "wave-editor__table";
  const columns = ["enemyId", "startSec", "endSec", "ratePerSec", "burst", "cap", ""];
  const headRow = document.createElement("div");
  headRow.className = "wave-editor__row wave-editor__row--head";
  for (const c of columns) {
    const cell = document.createElement("div");
    cell.textContent = c;
    headRow.appendChild(cell);
  }
  table.appendChild(headRow);

  opts.value.entries.forEach((entry, i) => {
    table.appendChild(renderEntryRow(entry, i, opts));
  });
  root.appendChild(table);
  return root;
}

function renderEntryRow(
  entry: WaveEntry,
  index: number,
  opts: WaveEditorOptions,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "wave-editor__row";

  row.appendChild(enemySelect(entry.enemyId, opts.enemyIds, (v) => patch({ enemyId: v })));
  row.appendChild(numCell(entry.startSec, (v) => patch({ startSec: v }), 0));
  row.appendChild(numCell(entry.endSec, (v) => patch({ endSec: v }), 0));
  row.appendChild(numCell(entry.ratePerSec, (v) => patch({ ratePerSec: v }), 0, "any"));
  row.appendChild(numCell(entry.burst, (v) => patch({ burst: v }), 0, "1"));
  row.appendChild(numCell(entry.cap, (v) => patch({ cap: v }), 0, "1"));

  const actions = document.createElement("div");
  actions.className = "wave-editor__actions";
  const del = document.createElement("button");
  del.className = "mods__row-btn mods__row-btn--danger";
  del.textContent = "–";
  del.title = "Remover";
  del.addEventListener("click", () => {
    const next: WaveDef = {
      ...opts.value,
      entries: opts.value.entries.filter((_, j) => j !== index),
    };
    opts.onChange(next);
  });
  actions.appendChild(del);
  row.appendChild(actions);
  return row;

  function patch(partial: Partial<WaveEntry>): void {
    const updated: WaveEntry = { ...entry, ...partial };
    const next: WaveDef = {
      ...opts.value,
      entries: opts.value.entries.map((e, j) => (j === index ? updated : e)),
    };
    opts.onChange(next);
  }
}

function enemySelect(
  current: string,
  options: readonly string[],
  onChange: (v: string) => void,
): HTMLElement {
  if (options.length === 0) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "pg__input";
    input.value = current;
    input.addEventListener("input", () => onChange(input.value));
    return input;
  }
  const sel = document.createElement("select");
  sel.className = "pg__input";
  const seen = new Set(options);
  if (current && !seen.has(current)) {
    const opt = document.createElement("option");
    opt.value = current;
    opt.textContent = `${current} (desconhecido)`;
    sel.appendChild(opt);
  }
  for (const id of options) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = id;
    if (id === current) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener("change", () => onChange(sel.value));
  return sel;
}

function numCell(
  value: number,
  onChange: (v: number) => void,
  min?: number,
  step: string = "any",
): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.className = "pg__input";
  input.value = String(value);
  if (min !== undefined) input.min = String(min);
  input.step = step;
  input.addEventListener("input", () => {
    const n = Number(input.value);
    if (Number.isFinite(n)) onChange(n);
  });
  return input;
}
