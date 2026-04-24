import { z } from "zod";

const COLOR_FIELDS = new Set(["color", "backgroundColor", "biomeTint"]);
const READ_ONLY_FIELDS = new Set(["kind"]);

export interface PropertyGridOptions<T extends Record<string, unknown>> {
  schema: z.ZodObject<z.ZodRawShape>;
  value: T;
  /** Fields to hide (rendered but as read-only summary). */
  omit?: readonly string[];
  onChange: (next: T) => void;
}

export function renderPropertyGrid<T extends Record<string, unknown>>(
  opts: PropertyGridOptions<T>,
): HTMLElement {
  const root = document.createElement("div");
  root.className = "pg";
  const shape = opts.schema.shape;
  for (const [fieldKey, fieldSchema] of Object.entries(shape)) {
    if (opts.omit?.includes(fieldKey)) continue;
    const row = renderField(fieldKey, fieldKey, fieldSchema as z.ZodTypeAny, (opts.value as Record<string, unknown>)[fieldKey], (newValue) => {
      const next = { ...(opts.value as Record<string, unknown>), [fieldKey]: newValue } as T;
      opts.onChange(next);
    });
    root.appendChild(row);
  }
  return root;
}

function renderField(
  key: string,
  label: string,
  schema: z.ZodTypeAny,
  value: unknown,
  onChange: (newValue: unknown) => void,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "pg__row";
  const labelEl = document.createElement("label");
  labelEl.className = "pg__label";
  labelEl.textContent = label;
  row.appendChild(labelEl);

  const base = unwrap(schema);
  const typeName = base._def.typeName as string;

  if (READ_ONLY_FIELDS.has(key)) {
    row.appendChild(readonlyChip(String(value)));
    return row;
  }

  switch (typeName) {
    case "ZodString":
      row.appendChild(textInput(value as string | undefined, onChange));
      break;
    case "ZodNumber":
      row.appendChild(numberInput(key, base as z.ZodNumber, value as number | undefined, onChange));
      break;
    case "ZodBoolean":
      row.appendChild(checkboxInput(value as boolean | undefined, onChange));
      break;
    case "ZodEnum":
      row.appendChild(
        enumSelect(((base as z.ZodEnum<[string, ...string[]]>)._def.values as string[]) ?? [], value as string | undefined, onChange),
      );
      break;
    case "ZodLiteral":
      row.appendChild(readonlyChip(String((base as z.ZodLiteral<unknown>)._def.value)));
      break;
    case "ZodObject": {
      const sub = document.createElement("div");
      sub.className = "pg__object";
      const subValue = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
      const subShape = (base as z.ZodObject<z.ZodRawShape>).shape;
      for (const [subKey, subSchema] of Object.entries(subShape)) {
        const subRow = renderField(
          subKey,
          subKey,
          subSchema as z.ZodTypeAny,
          subValue[subKey],
          (newValue) => {
            const next = { ...subValue, [subKey]: newValue };
            onChange(next);
          },
        );
        sub.appendChild(subRow);
      }
      labelEl.classList.add("pg__label--group");
      row.classList.add("pg__row--group");
      row.appendChild(sub);
      break;
    }
    case "ZodArray":
      row.appendChild(jsonFallback(value, onChange));
      break;
    default:
      row.appendChild(jsonFallback(value, onChange));
      break;
  }

  return row;
}

function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  let cur = schema;
  const seen = new Set<unknown>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const tn = cur._def?.typeName as string | undefined;
    if (tn === "ZodDefault" || tn === "ZodOptional" || tn === "ZodNullable") {
      cur = (cur._def as { innerType: z.ZodTypeAny }).innerType;
      continue;
    }
    if (tn === "ZodEffects") {
      cur = (cur._def as { schema: z.ZodTypeAny }).schema;
      continue;
    }
    break;
  }
  return cur;
}

function textInput(
  value: string | undefined,
  onChange: (v: string) => void,
): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "pg__input";
  input.value = value ?? "";
  input.addEventListener("input", () => onChange(input.value));
  return input;
}

function numberInput(
  fieldKey: string,
  schema: z.ZodNumber,
  value: number | undefined,
  onChange: (v: number) => void,
): HTMLElement {
  const isColor = COLOR_FIELDS.has(fieldKey);
  const constraints = numberConstraints(schema);

  if (isColor) {
    const wrap = document.createElement("div");
    wrap.className = "pg__color";
    const picker = document.createElement("input");
    picker.type = "color";
    picker.value = "#" + (value ?? 0).toString(16).padStart(6, "0");
    picker.className = "pg__color-picker";
    const text = document.createElement("input");
    text.type = "text";
    text.className = "pg__input pg__color-text";
    text.value = "0x" + (value ?? 0).toString(16).padStart(6, "0");
    picker.addEventListener("input", () => {
      const n = parseInt(picker.value.slice(1), 16);
      text.value = "0x" + n.toString(16).padStart(6, "0");
      onChange(n);
    });
    text.addEventListener("change", () => {
      const normalized = text.value.trim().replace(/^#/, "").replace(/^0x/i, "");
      const n = parseInt(normalized, 16);
      if (Number.isFinite(n) && n >= 0 && n <= 0xffffff) {
        picker.value = "#" + n.toString(16).padStart(6, "0");
        onChange(n);
      } else {
        text.value = "0x" + (value ?? 0).toString(16).padStart(6, "0");
      }
    });
    wrap.appendChild(picker);
    wrap.appendChild(text);
    return wrap;
  }

  const input = document.createElement("input");
  input.type = "number";
  input.className = "pg__input";
  input.value = String(value ?? "");
  if (constraints.int) input.step = "1";
  else input.step = "any";
  if (constraints.min !== undefined) input.min = String(constraints.min);
  if (constraints.max !== undefined) input.max = String(constraints.max);
  input.addEventListener("input", () => {
    const raw = input.value.trim();
    if (raw === "") return;
    const n = Number(raw);
    if (Number.isFinite(n)) onChange(n);
  });
  return input;
}

function checkboxInput(
  value: boolean | undefined,
  onChange: (v: boolean) => void,
): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "pg__checkbox";
  input.checked = Boolean(value);
  input.addEventListener("change", () => onChange(input.checked));
  return input;
}

function enumSelect(
  values: string[],
  current: string | undefined,
  onChange: (v: string) => void,
): HTMLSelectElement {
  const sel = document.createElement("select");
  sel.className = "pg__input";
  for (const v of values) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    if (v === current) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener("change", () => onChange(sel.value));
  return sel;
}

function readonlyChip(text: string): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.className = "pg__chip";
  chip.textContent = text;
  return chip;
}

function jsonFallback(value: unknown, onChange: (v: unknown) => void): HTMLTextAreaElement {
  const ta = document.createElement("textarea");
  ta.className = "pg__textarea";
  ta.rows = 3;
  ta.value = JSON.stringify(value ?? null, null, 2);
  ta.addEventListener("change", () => {
    try {
      onChange(JSON.parse(ta.value));
      ta.classList.remove("pg__input--err");
    } catch {
      ta.classList.add("pg__input--err");
    }
  });
  return ta;
}

interface NumberConstraints {
  int: boolean;
  min?: number;
  max?: number;
}

function numberConstraints(schema: z.ZodNumber): NumberConstraints {
  const out: NumberConstraints = { int: false };
  const checks = (schema._def as { checks?: { kind: string; value?: number }[] }).checks ?? [];
  for (const c of checks) {
    if (c.kind === "int") out.int = true;
    else if (c.kind === "min" && c.value !== undefined) out.min = c.value;
    else if (c.kind === "max" && c.value !== undefined) out.max = c.value;
  }
  return out;
}
