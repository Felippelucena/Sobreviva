import type { CharacterDef } from "../../content/schema/character";
import type {
  AttrImprovement,
  Improvement,
  PushShotImprovement,
  ShotSelect,
  UpgradeDef,
} from "../../content/schema/upgrade";
import type { WeaponDef, WeaponShot } from "../../content/schema/weapon";

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
    if (a.def.scope.kind !== "weapon") continue;
    if (a.def.scope.ids && !a.def.scope.ids.includes(base.id)) continue;
    applyLevel(out as unknown as object, a.def, a.level);
  }
  return out;
}

export function applyUpgradesToCharacter(
  base: CharacterDef,
  applied: readonly AppliedUpgrade[],
): CharacterDef {
  const out = structuredClone(base) as CharacterDef;
  for (const a of applied) {
    if (a.def.scope.kind !== "character") continue;
    if (a.def.scope.ids && !a.def.scope.ids.includes(base.id)) continue;
    applyLevel(out as unknown as object, a.def, a.level);
  }
  return out;
}

function applyLevel(target: object, def: UpgradeDef, level: number): void {
  if (level < 1 || level > def.levels.length) return;
  const lvl = def.levels[level - 1];
  if (!lvl) return;
  for (const imp of lvl.improvements) {
    applyImprovement(target, imp);
  }
}

function applyImprovement(target: object, imp: Improvement): void {
  if (imp.type === "pushShot") {
    applyPushShot(target, imp);
    return;
  }
  applyAttr(target, imp);
}

function applyPushShot(target: object, imp: PushShotImprovement): void {
  const obj = target as Record<string, unknown>;
  if (!Object.hasOwn(obj, "shots")) return;
  const arr = obj["shots"];
  if (!Array.isArray(arr)) return;
  arr.push(structuredClone(imp.shot));
}

function applyAttr(target: object, imp: AttrImprovement): void {
  const segs = parsePath(imp.path);
  if (segs === null) return;
  applyAtPath(target, segs, imp);
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

function applyAtPath(target: unknown, segs: readonly PathSeg[], imp: AttrImprovement): void {
  if (segs.length === 0 || target === null || typeof target !== "object") return;
  const seg = segs[0]!;
  const rest = segs.slice(1);
  const obj = target as Record<string, unknown>;

  if (seg.kind === "fieldArray") {
    if (!Object.hasOwn(obj, seg.name)) return;
    const arr = obj[seg.name];
    if (!Array.isArray(arr)) return;
    const isShots = seg.name === "shots";
    if (rest.length === 0) {
      for (let i = 0; i < arr.length; i++) {
        if (isShots && !shotMatches(arr[i], i, imp.shotSelect)) continue;
        arr[i] = applyOp(arr[i], imp);
      }
      return;
    }
    for (let i = 0; i < arr.length; i++) {
      if (isShots && !shotMatches(arr[i], i, imp.shotSelect)) continue;
      applyAtPath(arr[i], rest, imp);
    }
    return;
  }

  if (rest.length === 0) {
    if (Object.hasOwn(obj, seg.name)) obj[seg.name] = applyOp(obj[seg.name], imp);
    return;
  }
  if (!Object.hasOwn(obj, seg.name)) return;
  applyAtPath(obj[seg.name], rest, imp);
}

function applyOp(current: unknown, imp: AttrImprovement): unknown {
  if (typeof current !== "number" || !Number.isFinite(current)) return current;
  switch (imp.op) {
    case "mul":
      return current * imp.value;
    case "add":
      return current + imp.value;
    case "set":
      return imp.value;
  }
}

function shotMatches(shot: unknown, index: number, sel: ShotSelect | undefined): boolean {
  if (!sel || sel.select === "all") return true;
  if (sel.select === "index") return sel.index === index;
  if (sel.select === "type") {
    const s = shot as Partial<WeaponShot> | null;
    return !!s && typeof s === "object" && s.type === sel.shotType;
  }
  return true;
}
