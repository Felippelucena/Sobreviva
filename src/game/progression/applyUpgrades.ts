import type { CharacterDef } from "../../content/schema/character";
import type { UpgradeDef } from "../../content/schema/upgrade";
import type { WeaponDef } from "../../content/schema/weapon";

export interface AppliedUpgrade {
  def: UpgradeDef;
  level: number;
}

export function applyUpgradesToWeapon(
  base: WeaponDef,
  applied: readonly AppliedUpgrade[],
): WeaponDef {
  const out = structuredClone(base) as WeaponDef;
  for (const a of applied) {
    if (a.def.scope !== "weapon") continue;
    if (a.level < 1 || a.level > a.def.maxLevel) continue;
    applyOne(out as unknown as object, a.def, a.level);
  }
  return out;
}

export function applyUpgradesToCharacter(
  base: CharacterDef,
  applied: readonly AppliedUpgrade[],
): CharacterDef {
  const out = structuredClone(base) as CharacterDef;
  for (const a of applied) {
    if (a.def.scope !== "character") continue;
    if (a.level < 1 || a.level > a.def.maxLevel) continue;
    applyOne(out as unknown as object, a.def, a.level);
  }
  return out;
}

function applyOne(target: object, def: UpgradeDef, level: number): void {
  const op = def.target.op;
  const segs = parsePath(def.target.path);
  if (segs === null) return;

  if (op === "pushShot") {
    if (segs.length !== 1 || segs[0]!.kind !== "field" || segs[0]!.name !== "shots") return;
    const obj = target as Record<string, unknown>;
    if (!Object.hasOwn(obj, "shots")) return;
    const arr = obj["shots"];
    if (!Array.isArray(arr)) return;
    for (let i = 0; i < level; i++) {
      const v = def.values[i];
      if (v === undefined) continue;
      arr.push(structuredClone(v));
    }
    return;
  }

  const value = def.values[level - 1];
  if (typeof value !== "number" || !Number.isFinite(value)) return;
  applyAtPath(target, segs, (current) => {
    if (typeof current !== "number" || !Number.isFinite(current)) return current;
    switch (op) {
      case "mul":
        return current * value;
      case "add":
        return current + value;
      case "set":
        return value;
    }
  });
}

type PathSeg =
  | { kind: "field"; name: string }
  | { kind: "fieldArray"; name: string };

const FORBIDDEN_PATH_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

function parsePath(path: string): PathSeg[] | null {
  const segs: PathSeg[] = [];
  for (const raw of path.split(".")) {
    const isArray = raw.endsWith("[]");
    const name = isArray ? raw.slice(0, -2) : raw;
    if (name.length === 0 || FORBIDDEN_PATH_SEGMENTS.has(name)) return null;
    segs.push(isArray ? { kind: "fieldArray", name } : { kind: "field", name });
  }
  return segs;
}

function applyAtPath(
  target: unknown,
  segs: readonly PathSeg[],
  fn: (cur: unknown) => unknown,
): void {
  if (segs.length === 0 || target === null || typeof target !== "object") return;
  const seg = segs[0]!;
  const rest = segs.slice(1);
  const obj = target as Record<string, unknown>;
  if (seg.kind === "fieldArray") {
    if (!Object.hasOwn(obj, seg.name)) return;
    const arr = obj[seg.name];
    if (!Array.isArray(arr)) return;
    if (rest.length === 0) {
      for (let i = 0; i < arr.length; i++) arr[i] = fn(arr[i]);
      return;
    }
    for (const item of arr) applyAtPath(item, rest, fn);
    return;
  }
  if (rest.length === 0) {
    if (Object.hasOwn(obj, seg.name)) obj[seg.name] = fn(obj[seg.name]);
    return;
  }
  if (!Object.hasOwn(obj, seg.name)) return;
  applyAtPath(obj[seg.name], rest, fn);
}
