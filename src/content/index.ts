import { loadPackFromUrl, type LoadedPack } from "./PackLoader";
import { ContentRegistry } from "./registry/ContentRegistry";

const BASE_PACK_URL = "./packs/base/manifest.json";

export async function loadBasePack(): Promise<LoadedPack> {
  return loadPackFromUrl(BASE_PACK_URL);
}

export function buildRegistry(base: LoadedPack, mods: readonly LoadedPack[] = []): ContentRegistry {
  return new ContentRegistry([base, ...mods]);
}

export { ContentRegistry } from "./registry/ContentRegistry";
export { loadPackFromUrl } from "./PackLoader";
export type { LoadedPack } from "./PackLoader";
