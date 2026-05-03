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
    const weaponIds = new Set<string>();
    const characterIds = new Set<string>();
    const weapons: { id: string; upgradeIds: readonly string[] }[] = [];
    const characters: { id: string; upgradeIds: readonly string[] }[] = [];
    for (const relative of manifest.files) {
      const parsed = PackFile.parse(readJson(join(PACKS_ROOT, "base", relative)));
      for (const def of parsed.defs) {
        if (def.kind === "upgrade") upgradesById.set(def.id, def);
        if (def.kind === "weapon") {
          weaponIds.add(def.id);
          weapons.push({ id: def.id, upgradeIds: def.upgradeIds });
        }
        if (def.kind === "character") {
          characterIds.add(def.id);
          characters.push({ id: def.id, upgradeIds: def.upgradeIds });
        }
      }
    }
    for (const w of weapons) {
      for (const uid of w.upgradeIds) {
        const u = upgradesById.get(uid);
        expect(u, `weapon "${w.id}" references upgrade "${uid}" that does not exist`).toBeDefined();
        expect(
          u!.scope.kind,
          `weapon "${w.id}" references upgrade "${uid}" with scope.kind "${u!.scope.kind}" (expected "weapon")`,
        ).toBe("weapon");
        if (u!.scope.ids) {
          expect(
            u!.scope.ids.includes(w.id),
            `weapon "${w.id}" references upgrade "${uid}" whose scope.ids ${JSON.stringify(u!.scope.ids)} does not include this weapon`,
          ).toBe(true);
        }
      }
    }
    for (const c of characters) {
      for (const uid of c.upgradeIds) {
        const u = upgradesById.get(uid);
        expect(u, `character "${c.id}" references upgrade "${uid}" that does not exist`).toBeDefined();
        expect(
          u!.scope.kind,
          `character "${c.id}" references upgrade "${uid}" with scope.kind "${u!.scope.kind}" (expected "character")`,
        ).toBe("character");
        if (u!.scope.ids) {
          expect(
            u!.scope.ids.includes(c.id),
            `character "${c.id}" references upgrade "${uid}" whose scope.ids ${JSON.stringify(u!.scope.ids)} does not include this character`,
          ).toBe(true);
        }
      }
    }
    // scope.ids on every upgrade must reference an existing weapon/character id in the base pack.
    for (const u of upgradesById.values()) {
      if (!u.scope.ids) continue;
      const pool = u.scope.kind === "weapon" ? weaponIds : characterIds;
      for (const id of u.scope.ids) {
        expect(
          pool.has(id),
          `upgrade "${u.id}" scope.ids includes "${id}" which is not a known ${u.scope.kind} in the base pack`,
        ).toBe(true);
      }
    }
  });

  it("every upgrade passes validateUpgradeDef and uses valid shotSelect.shotType", () => {
    const validShotTypes = new Set(["projectile", "area"]);
    const manifest = PackManifest.parse(readJson(join(PACKS_ROOT, "base", "manifest.json")));
    for (const relative of manifest.files) {
      const parsed = PackFile.parse(readJson(join(PACKS_ROOT, "base", relative)));
      for (const def of parsed.defs) {
        if (def.kind !== "upgrade") continue;
        const err = validateUpgradeDef(def);
        expect(err, `upgrade "${def.id}" failed: ${err ?? ""}`).toBeNull();
        for (const lvl of def.levels) {
          for (const imp of lvl.improvements) {
            if (imp.type !== "attr") continue;
            if (!imp.shotSelect || imp.shotSelect.select !== "type") continue;
            expect(
              validShotTypes.has(imp.shotSelect.shotType),
              `upgrade "${def.id}": shotSelect.shotType "${imp.shotSelect.shotType}" is not a valid WeaponShot discriminator`,
            ).toBe(true);
          }
        }
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
