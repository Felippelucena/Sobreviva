import type { AnyDef } from "./schema";

/**
 * Shallow merge at def level, one extra level of shallow merge for nested object fields
 * (sprite, hitbox, projectile). Arrays and primitives always replace. Predictable rules
 * beat clever ones for modders who only have our docs to go on.
 */
export function mergeDef(base: AnyDef, override: AnyDef): AnyDef {
  if (base.kind !== override.kind) {
    throw new Error(`mergeDef kind mismatch: ${base.kind} vs ${override.kind}`);
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const baseVal = (base as Record<string, unknown>)[key];
    if (isPlainObject(baseVal) && isPlainObject(value)) {
      out[key] = { ...baseVal, ...value };
    } else {
      out[key] = value;
    }
  }
  return out as AnyDef;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype
  );
}
