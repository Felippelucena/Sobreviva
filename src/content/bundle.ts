import type { LoadedPack } from "./PackLoader";
import { BundledPack, validateWaveEntries } from "./schema";

export function bundleFromLoadedPack(pack: LoadedPack): BundledPack {
  const { manifest, defs } = pack;
  return {
    schemaVersion: 1,
    manifest: {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      priority: manifest.priority,
      dependsOn: manifest.dependsOn,
    },
    defs: [...defs],
    scripts: [],
  };
}

export function parseBundle(raw: unknown): BundledPack {
  const bundle = BundledPack.parse(raw);
  const seen = new Set<string>();
  for (const def of bundle.defs) {
    const key = `${def.kind}:${def.id}`;
    if (seen.has(key)) throw new Error(`Duplicate def ${key} in bundle "${bundle.manifest.id}"`);
    seen.add(key);
    if (def.kind === "wave") {
      const err = validateWaveEntries(def);
      if (err) throw new Error(err);
    }
  }
  return bundle;
}

export function bundleToLoadedPack(bundle: BundledPack): LoadedPack {
  return {
    manifest: {
      schemaVersion: 1,
      id: bundle.manifest.id,
      name: bundle.manifest.name,
      version: bundle.manifest.version,
      priority: bundle.manifest.priority,
      dependsOn: bundle.manifest.dependsOn,
      files: [],
      js: [],
    },
    defs: [...bundle.defs],
  };
}

export function downloadBundle(bundle: BundledPack, suggestedName?: string): void {
  const filename = `${suggestedName ?? bundle.manifest.id}.correrilpack.json`;
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
