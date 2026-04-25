import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PackFile, PackManifest, validateWaveEntries } from "../schema";

const PACKS_ROOT = join(process.cwd(), "public", "packs");

function listJsonFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...listJsonFiles(full));
    } else if (name.endsWith(".json")) {
      out.push(full);
    }
  }
  return out;
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

describe("base pack manifest", () => {
  const manifestPath = join(PACKS_ROOT, "base", "manifest.json");

  it("manifest.json parses", () => {
    expect(() => PackManifest.parse(readJson(manifestPath))).not.toThrow();
  });

  it("every file referenced in manifest exists and parses", () => {
    const manifest = PackManifest.parse(readJson(manifestPath));
    for (const relative of manifest.files) {
      const full = join(PACKS_ROOT, "base", relative);
      const parsed = PackFile.safeParse(readJson(full));
      if (!parsed.success) {
        throw new Error(`Pack file ${relative} failed Zod parse:\n${parsed.error.message}`);
      }
    }
  });

  it("base pack has no duplicate kind:id across files", () => {
    const manifest = PackManifest.parse(readJson(manifestPath));
    const seen = new Map<string, string>();
    for (const relative of manifest.files) {
      const parsed = PackFile.parse(readJson(join(PACKS_ROOT, "base", relative)));
      for (const def of parsed.defs) {
        const key = `${def.kind}:${def.id}`;
        const prev = seen.get(key);
        if (prev) {
          throw new Error(`duplicate def ${key} in ${prev} and ${relative}`);
        }
        seen.set(key, relative);
      }
    }
  });

  it("waves reference enemy ids that exist somewhere in the base pack", () => {
    const manifest = PackManifest.parse(readJson(manifestPath));
    const enemyIds = new Set<string>();
    const waveFiles: string[] = [];
    for (const relative of manifest.files) {
      const parsed = PackFile.parse(readJson(join(PACKS_ROOT, "base", relative)));
      for (const def of parsed.defs) {
        if (def.kind === "enemy") enemyIds.add(def.id);
        if (def.kind === "wave") waveFiles.push(relative);
      }
    }
    for (const relative of waveFiles) {
      const parsed = PackFile.parse(readJson(join(PACKS_ROOT, "base", relative)));
      for (const def of parsed.defs) {
        if (def.kind !== "wave") continue;
        const err = validateWaveEntries(def);
        expect(err, `${relative} :: wave ${def.id}`).toBeNull();
        for (const entry of def.entries) {
          expect(
            enemyIds.has(entry.enemyId),
            `wave ${def.id} references unknown enemyId "${entry.enemyId}"`,
          ).toBe(true);
        }
      }
    }
  });
});

describe("example packs", () => {
  const examplesDir = join(PACKS_ROOT, "examples");

  it("every example .json file is a valid bundle or pack file", () => {
    let dir: string[];
    try {
      dir = listJsonFiles(examplesDir);
    } catch {
      return;
    }
    for (const file of dir) {
      const raw = readJson(file);
      const asPack = PackFile.safeParse(raw);
      const asBundle = "manifest" in (raw as Record<string, unknown>);
      expect(asPack.success || asBundle, `example ${file} parsed as nothing`).toBe(true);
    }
  });
});
