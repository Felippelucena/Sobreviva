import { PackFile, PackManifest, validateWaveEntries, type AnyDef } from "./schema";

export interface LoadedPack {
  manifest: PackManifest;
  defs: AnyDef[];
}

export interface PackSource {
  manifestUrl: string;
  resolveFile: (relative: string) => string;
}

export async function loadPackFromUrl(manifestUrl: string): Promise<LoadedPack> {
  const base = new URL(manifestUrl, window.location.href);
  return loadPack({
    manifestUrl,
    resolveFile: (rel) => new URL(rel, base).toString(),
  });
}

export async function loadPack(source: PackSource): Promise<LoadedPack> {
  const manifestJson = await fetchJson(source.manifestUrl);
  const manifest = PackManifest.parse(manifestJson);

  const defs: AnyDef[] = [];
  const seen = new Map<string, AnyDef>();
  for (const relative of manifest.files) {
    const fileUrl = source.resolveFile(relative);
    const raw = await fetchJson(fileUrl);
    const parsed = PackFile.parse(raw);
    for (const def of parsed.defs) {
      if (def.kind === "wave") {
        const err = validateWaveEntries(def);
        if (err) throw new Error(`Pack "${manifest.id}" ${err}`);
      }
      const key = `${def.kind}:${def.id}`;
      if (seen.has(key)) {
        throw new Error(
          `Pack "${manifest.id}" has duplicate def ${key} (files: ${relative})`,
        );
      }
      seen.set(key, def);
      defs.push(def);
    }
  }
  return { manifest, defs };
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  return res.json();
}
