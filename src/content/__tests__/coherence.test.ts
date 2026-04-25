import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AnyDef,
  CharacterDef,
  EnemyDef,
  MapDef,
  PackFile,
  PackManifest,
  PickupDef,
  UpgradeDef,
  validateUpgradeDef,
  WaveDef,
  WeaponDef,
} from "../schema";
import type { DefByKind } from "../registry/ContentRegistry";

const KINDS = AnyDef.options.map((o) => o.shape.kind.value) as readonly (keyof DefByKind)[];

const PROJECT_ROOT = process.cwd();
const PACKS_ROOT = join(PROJECT_ROOT, "public", "packs");

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

function readSource(file: string): string {
  return readFileSync(join(PROJECT_ROOT, file), "utf8");
}

describe("coherence: AnyDef ↔ DefByKind ↔ Editor ↔ packs", () => {
  it("AnyDef discriminator covers all expected kinds", () => {
    expect(KINDS.length).toBeGreaterThan(0);
    expect(new Set(KINDS).size).toBe(KINDS.length);
  });

  it("Editor.ts registers a tab for every kind in AnyDef", () => {
    const editorSrc = readSource("src/editor/Editor.ts");
    const tabsBlockMatch = editorSrc.match(/const TABS\s*:\s*[^=]+=\s*\[([\s\S]*?)\]\s*;/);
    expect(tabsBlockMatch, "could not locate TABS array in Editor.ts").not.toBeNull();
    const tabsBlock = tabsBlockMatch![1] ?? "";
    for (const kind of KINDS) {
      expect(
        new RegExp(`kind:\\s*"${kind}"`).test(tabsBlock),
        `Editor.ts TABS missing kind "${kind}"`,
      ).toBe(true);
    }
  });

  it("each kind in AnyDef has a Zod schema export with matching kind literal", () => {
    const schemaByKind: Record<keyof DefByKind, { shape: { kind: { value: string } } }> = {
      weapon: WeaponDef,
      enemy: EnemyDef,
      pickup: PickupDef,
      wave: WaveDef,
      character: CharacterDef,
      map: MapDef,
      upgrade: UpgradeDef,
    };
    for (const kind of KINDS) {
      const schema = schemaByKind[kind];
      expect(schema, `no schema export wired for kind "${kind}"`).toBeDefined();
      expect(
        schema.shape.kind.value,
        `schema for kind "${kind}" has wrong literal`,
      ).toBe(kind);
    }
  });

  it("base pack provides at least one def for every kind in AnyDef", () => {
    const manifest = PackManifest.parse(readJson(join(PACKS_ROOT, "base", "manifest.json")));
    const seen = new Set<string>();
    for (const relative of manifest.files) {
      const parsed = PackFile.parse(readJson(join(PACKS_ROOT, "base", relative)));
      for (const def of parsed.defs) seen.add(def.kind);
    }
    for (const kind of KINDS) {
      expect(seen.has(kind), `base pack has no def for kind "${kind}"`).toBe(true);
    }
  });

  it("character.startWeaponId references a weapon that exists in the base pack", () => {
    const manifest = PackManifest.parse(readJson(join(PACKS_ROOT, "base", "manifest.json")));
    const weaponIds = new Set<string>();
    const characters: { id: string; startWeaponId: string }[] = [];
    for (const relative of manifest.files) {
      const parsed = PackFile.parse(readJson(join(PACKS_ROOT, "base", relative)));
      for (const def of parsed.defs) {
        if (def.kind === "weapon") weaponIds.add(def.id);
        if (def.kind === "character") {
          characters.push({ id: def.id, startWeaponId: def.startWeaponId });
        }
      }
    }
    for (const ch of characters) {
      expect(
        weaponIds.has(ch.startWeaponId),
        `character "${ch.id}" startWeaponId "${ch.startWeaponId}" not found among base weapons`,
      ).toBe(true);
    }
  });

  it("weapon.upgradeIds and character.upgradeIds reference upgrades with matching scope", () => {
    const manifest = PackManifest.parse(readJson(join(PACKS_ROOT, "base", "manifest.json")));
    const upgradesById = new Map<string, ReturnType<typeof UpgradeDef.parse>>();
    const weapons: { id: string; upgradeIds: readonly string[] }[] = [];
    const characters: { id: string; upgradeIds: readonly string[] }[] = [];
    for (const relative of manifest.files) {
      const parsed = PackFile.parse(readJson(join(PACKS_ROOT, "base", relative)));
      for (const def of parsed.defs) {
        if (def.kind === "upgrade") upgradesById.set(def.id, def);
        if (def.kind === "weapon") weapons.push({ id: def.id, upgradeIds: def.upgradeIds });
        if (def.kind === "character") characters.push({ id: def.id, upgradeIds: def.upgradeIds });
      }
    }
    for (const w of weapons) {
      for (const uid of w.upgradeIds) {
        const u = upgradesById.get(uid);
        expect(u, `weapon "${w.id}" references upgrade "${uid}" that does not exist`).toBeDefined();
        expect(
          u!.scope,
          `weapon "${w.id}" references upgrade "${uid}" with scope "${u!.scope}" (expected "weapon")`,
        ).toBe("weapon");
      }
    }
    for (const c of characters) {
      for (const uid of c.upgradeIds) {
        const u = upgradesById.get(uid);
        expect(u, `character "${c.id}" references upgrade "${uid}" that does not exist`).toBeDefined();
        expect(
          u!.scope,
          `character "${c.id}" references upgrade "${uid}" with scope "${u!.scope}" (expected "character")`,
        ).toBe("character");
      }
    }
  });

  it("every upgrade has values.length === maxLevel and passes validateUpgradeDef", () => {
    const manifest = PackManifest.parse(readJson(join(PACKS_ROOT, "base", "manifest.json")));
    for (const relative of manifest.files) {
      const parsed = PackFile.parse(readJson(join(PACKS_ROOT, "base", relative)));
      for (const def of parsed.defs) {
        if (def.kind !== "upgrade") continue;
        const err = validateUpgradeDef(def);
        expect(err, `upgrade "${def.id}" failed: ${err ?? ""}`).toBeNull();
      }
    }
  });
});

describe("coherence: ECS components", () => {
  // TS already checks that defineComponent<X>(...) takes a valid X type.
  // What it DOES NOT catch: when the runtime literal name diverges from the type
  // (e.g. defineComponent<Foo>("Bar")) or when component is renamed in interface
  // but defineComponent literal is left stale.
  it("every defineComponent literal matches its generic type parameter", () => {
    const src = readSource("src/game/components/index.ts");
    const declarations = [
      ...src.matchAll(/defineComponent<([\w]+|true)>\("([\w]+)"\)/g),
    ].map((m) => ({ type: m[1]!, name: m[2]! }));

    expect(declarations.length).toBeGreaterThan(0);
    for (const d of declarations) {
      // Tags use defineComponent<true>("XTag") — name carries meaning, type is "true".
      if (d.type === "true") continue;
      expect(
        d.type,
        `defineComponent<${d.type}>("${d.name}") — generic type and runtime literal must match`,
      ).toBe(d.name);
    }
  });

  it("every component literal name appears in the exported const list (not orphaned)", () => {
    const src = readSource("src/game/components/index.ts");
    const declarations = [
      ...src.matchAll(/defineComponent<(?:[\w]+|true)>\("([\w]+)"\)/g),
    ].map((m) => m[1]!);
    for (const name of declarations) {
      expect(
        new RegExp(`export const ${name}\\s*=\\s*defineComponent`).test(src),
        `defineComponent("${name}") is not bound to "export const ${name}"`,
      ).toBe(true);
    }
  });
});
