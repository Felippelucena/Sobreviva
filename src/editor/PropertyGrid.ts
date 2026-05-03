import { z } from "zod";

const COLOR_FIELDS = new Set(["color", "backgroundColor", "biomeTint"]);
const READ_ONLY_FIELDS = new Set(["kind"]);

export interface PropertyGridOptions<T extends Record<string, unknown>> {
  schema: z.ZodObject<z.ZodRawShape>;
  /** Live getter so that closures always read the latest state, never a stale capture. */
  getValue: () => T;
  /** Fields to hide (rendered but as read-only summary). */
  omit?: readonly string[];
  onChange: (next: T) => void;
  /**
   * When true, runs of adjacent leaf fields (number/enum/short string/boolean)
   * are packed into a CSS-grid row instead of one row each. Nested objects,
   * arrays, discriminated unions, color pickers and textareas always break
   * the run and stack vertically.
   */
  compact?: boolean;
}

export function renderPropertyGrid<T extends Record<string, unknown>>(
  opts: PropertyGridOptions<T>,
): HTMLElement {
  const root = document.createElement("div");
  root.className = "pg";
  const shape = opts.schema.shape;
  const entries = Object.entries(shape).filter(([k]) => !opts.omit?.includes(k));
  const compact = opts.compact === true;
  appendFieldRuns(root, entries, compact, (fieldKey, fieldSchema) =>
    renderField(
      fieldKey,
      fieldKey,
      fieldSchema,
      () => (opts.getValue() as Record<string, unknown>)[fieldKey],
      (newValue) => {
        const cur = opts.getValue() as Record<string, unknown>;
        const next = { ...cur, [fieldKey]: newValue } as T;
        opts.onChange(next);
      },
      compact,
    ),
  );
  return root;
}

function appendFieldRuns(
  parent: HTMLElement,
  entries: readonly (readonly [string, unknown])[],
  compact: boolean,
  build: (key: string, schema: z.ZodTypeAny) => HTMLElement,
): void {
  if (!compact) {
    for (const [key, schema] of entries) parent.appendChild(build(key, schema as z.ZodTypeAny));
    return;
  }
  let bucket: HTMLElement[] = [];
  const flush = (): void => {
    if (bucket.length === 0) return;
    if (bucket.length === 1) {
      parent.appendChild(bucket[0]!);
    } else {
      const group = document.createElement("div");
      group.className = "pg__row--group-compact";
      for (const row of bucket) {
        row.classList.add("pg__row--compact-cell");
        group.appendChild(row);
      }
      parent.appendChild(group);
    }
    bucket = [];
  };
  for (const [key, schema] of entries) {
    const row = build(key, schema as z.ZodTypeAny);
    if (canPack(schema as z.ZodTypeAny, key)) {
      bucket.push(row);
    } else {
      flush();
      parent.appendChild(row);
    }
  }
  flush();
}

function canPack(schema: z.ZodTypeAny, key: string): boolean {
  if (COLOR_FIELDS.has(key)) return false;
  if (READ_ONLY_FIELDS.has(key)) return true;
  const tn = unwrap(schema)._def.typeName as string;
  return tn === "ZodNumber" || tn === "ZodEnum" || tn === "ZodBoolean" || tn === "ZodLiteral" || tn === "ZodString";
}

function renderField(
  key: string,
  label: string,
  schema: z.ZodTypeAny,
  getCurrent: () => unknown,
  onChange: (newValue: unknown) => void,
  compact = false,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "pg__row";
  const labelEl = document.createElement("label");
  labelEl.className = "pg__label";
  labelEl.textContent = label;
  row.appendChild(labelEl);

  const base = unwrap(schema);
  const typeName = base._def.typeName as string;
  const initial = getCurrent();

  if (READ_ONLY_FIELDS.has(key)) {
    row.appendChild(readonlyChip(String(initial)));
    return row;
  }

  switch (typeName) {
    case "ZodString":
      row.appendChild(textInput(initial as string | undefined, onChange));
      break;
    case "ZodNumber":
      row.appendChild(numberInput(key, base as z.ZodNumber, initial as number | undefined, onChange));
      break;
    case "ZodBoolean":
      row.appendChild(checkboxInput(initial as boolean | undefined, onChange));
      break;
    case "ZodEnum":
      row.appendChild(
        enumSelect(((base as z.ZodEnum<[string, ...string[]]>)._def.values as string[]) ?? [], initial as string | undefined, onChange),
      );
      break;
    case "ZodLiteral":
      row.appendChild(readonlyChip(String((base as z.ZodLiteral<unknown>)._def.value)));
      break;
    case "ZodObject": {
      const sub = document.createElement("div");
      sub.className = "pg__object";
      const subShape = (base as z.ZodObject<z.ZodRawShape>).shape;
      const subEntries = Object.entries(subShape);
      appendFieldRuns(sub, subEntries, compact, (subKey, subSchema) =>
        renderField(
          subKey,
          subKey,
          subSchema,
          () => {
            const cur = getCurrent();
            return cur && typeof cur === "object"
              ? (cur as Record<string, unknown>)[subKey]
              : undefined;
          },
          (newValue) => {
            const cur = getCurrent();
            const base2 = cur && typeof cur === "object" ? (cur as Record<string, unknown>) : {};
            const next = { ...base2, [subKey]: newValue };
            onChange(next);
          },
          compact,
        ),
      );
      labelEl.classList.add("pg__label--group");
      row.classList.add("pg__row--group");
      row.appendChild(sub);
      break;
    }
    case "ZodArray":
      row.appendChild(arrayField(base as z.ZodArray<z.ZodTypeAny>, getCurrent, onChange, compact));
      break;
    case "ZodDiscriminatedUnion":
      row.appendChild(
        discriminatedUnionField(
          base as z.ZodDiscriminatedUnion<string, z.ZodObject<z.ZodRawShape>[]>,
          getCurrent,
          onChange,
          compact,
        ),
      );
      break;
    default:
      row.appendChild(jsonFallback(initial, onChange));
      break;
  }

  return row;
}

function arrayField(
  schema: z.ZodArray<z.ZodTypeAny>,
  getCurrent: () => unknown,
  onChange: (next: unknown) => void,
  compact = false,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "pg__array";
  const elementSchema = schema._def.type;

  const readArr = (): unknown[] => {
    const v = getCurrent();
    return Array.isArray(v) ? v : [];
  };

  const rebuild = (): void => {
    wrap.innerHTML = "";
    const items = readArr();
    items.forEach((_itemValue, idx) => {
      const itemRow = document.createElement("div");
      itemRow.className = "pg__array-item";
      const head = document.createElement("div");
      head.className = "pg__array-item-head";
      const title = document.createElement("span");
      title.className = "pg__array-item-title";
      title.textContent = `#${idx + 1}`;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "pg__btn pg__btn--danger";
      removeBtn.textContent = "Remover";
      removeBtn.addEventListener("click", () => {
        const arr = readArr().slice();
        arr.splice(idx, 1);
        onChange(arr);
        rebuild();
      });
      head.appendChild(title);
      head.appendChild(removeBtn);
      itemRow.appendChild(head);

      const itemBody = renderField(
        `item_${idx}`,
        "",
        elementSchema,
        () => {
          const arr = readArr();
          return arr[idx];
        },
        (next) => {
          const arr = readArr().slice();
          arr[idx] = next;
          onChange(arr);
        },
        compact,
      );
      const itemLabel = itemBody.querySelector(".pg__label");
      if (itemLabel) itemLabel.remove();
      itemRow.appendChild(itemBody);
      wrap.appendChild(itemRow);
    });

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "pg__btn";
    addBtn.textContent = "+ Adicionar";
    addBtn.addEventListener("click", () => {
      const arr = readArr().slice();
      arr.push(makeDefault(elementSchema));
      onChange(arr);
      rebuild();
    });
    wrap.appendChild(addBtn);
  };

  rebuild();
  return wrap;
}

function discriminatedUnionField(
  schema: z.ZodDiscriminatedUnion<string, z.ZodObject<z.ZodRawShape>[]>,
  getCurrent: () => unknown,
  onChange: (next: unknown) => void,
  compact = false,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "pg__object";
  const discriminator = schema._def.discriminator;
  const options = schema._def.options as z.ZodObject<z.ZodRawShape>[];
  const optionLabels = options.map((opt) => {
    const tagSchema = opt.shape[discriminator] as z.ZodTypeAny | undefined;
    return tagSchema && (tagSchema as z.ZodLiteral<unknown>)._def?.value !== undefined
      ? String((tagSchema as z.ZodLiteral<unknown>)._def.value)
      : "?";
  });

  const readTag = (): string => {
    const cur = getCurrent();
    if (cur && typeof cur === "object" && discriminator in (cur as Record<string, unknown>)) {
      return String((cur as Record<string, unknown>)[discriminator]);
    }
    return optionLabels[0] ?? "";
  };

  const rebuild = (): void => {
    wrap.innerHTML = "";
    const currentTag = readTag();

    const typeRow = document.createElement("div");
    typeRow.className = "pg__row";
    const typeLabel = document.createElement("label");
    typeLabel.className = "pg__label";
    typeLabel.textContent = discriminator;
    typeRow.appendChild(typeLabel);
    const sel = enumSelect(optionLabels, currentTag, (newTag) => {
      const newOption = options[optionLabels.indexOf(newTag)];
      if (!newOption) return;
      const fresh = makeDefault(newOption);
      onChange(fresh);
      rebuild();
    });
    typeRow.appendChild(sel);
    wrap.appendChild(typeRow);

    const activeOption = options[optionLabels.indexOf(currentTag)];
    if (!activeOption) return;
    const subEntries = Object.entries(activeOption.shape).filter(([k]) => k !== discriminator);
    appendFieldRuns(wrap, subEntries, compact, (subKey, subSchema) =>
      renderField(
        subKey,
        subKey,
        subSchema,
        () => {
          const cur = getCurrent();
          return cur && typeof cur === "object"
            ? (cur as Record<string, unknown>)[subKey]
            : undefined;
        },
        (newValue) => {
          const cur = getCurrent();
          const base2 = cur && typeof cur === "object" ? (cur as Record<string, unknown>) : {};
          const next = { ...base2, [subKey]: newValue };
          onChange(next);
        },
        compact,
      ),
    );
  };

  rebuild();
  return wrap;
}

function makeDefault(schema: z.ZodTypeAny): unknown {
  const inner = unwrap(schema);
  const tn = inner._def.typeName as string;
  // Optional/nullable wrappers: caller can leave the value as undefined,
  // but for array elements / discriminator switches we want a concrete object.
  if (tn === "ZodObject") {
    const obj = inner as z.ZodObject<z.ZodRawShape>;
    const out: Record<string, unknown> = {};
    for (const [k, s] of Object.entries(obj.shape)) {
      const child = makeDefault(s as z.ZodTypeAny);
      if (child !== undefined) out[k] = child;
    }
    return out;
  }
  if (tn === "ZodDiscriminatedUnion") {
    const du = inner as z.ZodDiscriminatedUnion<string, z.ZodObject<z.ZodRawShape>[]>;
    const first = du._def.options[0];
    if (first) return makeDefault(first);
  }
  if (tn === "ZodLiteral") {
    return (inner as z.ZodLiteral<unknown>)._def.value;
  }
  if (tn === "ZodDefault") {
    // unwrap() above strips ZodDefault; we only land here if it's a leaf default.
    return (schema._def as { defaultValue: () => unknown }).defaultValue?.();
  }
  // For wrapped types where the *outer* is ZodOptional we already unwrapped.
  // Pull a default if Zod attached one anywhere up the chain.
  const def = extractDefault(schema);
  if (def !== undefined) return def;
  switch (tn) {
    case "ZodNumber": {
      const num = inner as z.ZodNumber;
      const c = numberConstraints(num);
      // Pick a value that satisfies positive/min constraints when present.
      if (c.min !== undefined) return c.min > 0 ? c.min : 1;
      // PositiveNumber has a "min" check kind under the hood, but in case it's
      // a "positive" check, fall back to 1.
      const checks = (num._def as { checks?: { kind: string }[] }).checks ?? [];
      if (checks.some((ck) => ck.kind === "positive")) return 1;
      return 0;
    }
    case "ZodString":
      return "";
    case "ZodBoolean":
      return false;
    case "ZodArray":
      return [];
    case "ZodOptional":
      return undefined;
    default:
      return undefined;
  }
}

function extractDefault(schema: z.ZodTypeAny): unknown {
  let cur: z.ZodTypeAny | undefined = schema;
  const seen = new Set<unknown>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const tn = cur._def?.typeName as string | undefined;
    if (tn === "ZodDefault") {
      return (cur._def as { defaultValue: () => unknown }).defaultValue();
    }
    if (tn === "ZodOptional" || tn === "ZodNullable") {
      cur = (cur._def as { innerType: z.ZodTypeAny }).innerType;
      continue;
    }
    break;
  }
  return undefined;
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
