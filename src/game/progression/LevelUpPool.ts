import type { ContentRegistry } from "../../content/registry/ContentRegistry";
import type { CharacterDef } from "../../content/schema/character";
import type { UpgradeDef } from "../../content/schema/upgrade";
import type { WeaponDef } from "../../content/schema/weapon";
import type { Rng } from "../../engine/Rng";
import type { EntityId, World } from "../../engine/World";
import {
  EquippedWeapons,
  UpgradeLevels,
  WeaponState,
} from "../components";

export type LevelUpCard =
  | {
      kind: "upgrade";
      upgrade: UpgradeDef;
      // Entity that holds the UpgradeLevels for this upgrade (the weapon entity
      // for weapon upgrades, the player for character upgrades).
      targetEntityId: EntityId;
      // Level the player will be AT after picking this card.
      nextLevel: number;
      // Display name of the weapon or character this upgrade applies to.
      targetName: string;
    }
  | { kind: "newWeapon"; weapon: WeaponDef };

export interface BuildPoolOpts {
  world: World;
  registry: ContentRegistry;
  rng: Rng;
  playerId: EntityId;
  character: CharacterDef;
  count?: number;
}

export function buildLevelUpPool(opts: BuildPoolOpts): LevelUpCard[] {
  const candidates = collectCandidates(opts);
  if (candidates.length === 0) return [];
  const target = opts.count ?? 3;
  if (candidates.length <= target) return candidates;
  const pool = [...candidates];
  const out: LevelUpCard[] = [];
  for (let i = 0; i < target; i++) {
    const idx = opts.rng.intRange(0, pool.length);
    out.push(pool[idx]!);
    pool.splice(idx, 1);
  }
  return out;
}

function collectCandidates(opts: BuildPoolOpts): LevelUpCard[] {
  const { world, registry, playerId, character } = opts;
  const out: LevelUpCard[] = [];

  const equipped = world.get(playerId, EquippedWeapons);
  const playerLevels = world.get(playerId, UpgradeLevels);

  if (equipped) {
    for (const weaponEntityId of equipped.weaponEntityIds) {
      const ws = world.get(weaponEntityId, WeaponState);
      if (!ws) continue;
      const def = registry.find("weapon", ws.baseDefId);
      if (!def) continue;
      const wLevels = world.get(weaponEntityId, UpgradeLevels);
      for (const upgradeId of def.upgradeIds) {
        const upgrade = registry.find("upgrade", upgradeId);
        if (!upgrade || upgrade.scope.kind !== "weapon") continue;
        if (upgrade.scope.ids && !upgrade.scope.ids.includes(def.id)) continue;
        const cur = wLevels?.byUpgradeId.get(upgradeId) ?? 0;
        if (cur >= upgrade.levels.length) continue;
        out.push({
          kind: "upgrade",
          upgrade,
          targetEntityId: weaponEntityId,
          nextLevel: cur + 1,
          targetName: def.name,
        });
      }
    }
  }

  for (const upgradeId of character.upgradeIds) {
    const upgrade = registry.find("upgrade", upgradeId);
    if (!upgrade || upgrade.scope.kind !== "character") continue;
    if (upgrade.scope.ids && !upgrade.scope.ids.includes(character.id)) continue;
    const cur = playerLevels?.byUpgradeId.get(upgradeId) ?? 0;
    if (cur >= upgrade.levels.length) continue;
    out.push({
      kind: "upgrade",
      upgrade,
      targetEntityId: playerId,
      nextLevel: cur + 1,
      targetName: character.name,
    });
  }

  if (equipped && equipped.weaponEntityIds.length < equipped.maxWeapons) {
    const equippedWeaponDefIds = new Set<string>();
    for (const weaponEntityId of equipped.weaponEntityIds) {
      const ws = world.get(weaponEntityId, WeaponState);
      if (ws) equippedWeaponDefIds.add(ws.baseDefId);
    }
    for (const weapon of registry.list("weapon")) {
      if (equippedWeaponDefIds.has(weapon.id)) continue;
      out.push({ kind: "newWeapon", weapon });
    }
  }

  return out;
}
