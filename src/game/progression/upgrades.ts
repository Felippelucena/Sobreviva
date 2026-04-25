import type { World, EntityId } from "../../engine/World";
import {
  Health,
  PlayerProgress,
  Velocity,
  WeaponState,
  type WeaponBurstConfig,
} from "../components";

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  apply: (world: World, playerId: EntityId) => void;
}

function eachShot(burst: WeaponBurstConfig, fn: (shot: NonNullable<WeaponBurstConfig["volleys"][number]>["shots"][number]) => void): void {
  for (const volley of burst.volleys) for (const shot of volley.shots) fn(shot);
}

export const UPGRADES: readonly Upgrade[] = [
  {
    id: "damage",
    name: "Mais dano",
    desc: "+20% de dano da arma",
    apply: (world, id) => {
      const w = world.get(id, WeaponState);
      if (!w) return;
      eachShot(w.burst, (s) => {
        s.damage *= 1.2;
      });
    },
  },
  {
    id: "cooldown",
    name: "Mais rápido",
    desc: "-10% no cooldown da arma",
    apply: (world, id) => {
      const w = world.get(id, WeaponState);
      if (w) w.cooldownMs = Math.max(80, w.cooldownMs * 0.9);
    },
  },
  {
    id: "projectile_speed",
    name: "Mais potência",
    desc: "+15% de velocidade de projétil",
    apply: (world, id) => {
      const w = world.get(id, WeaponState);
      if (!w) return;
      eachShot(w.burst, (s) => {
        if (s.type === "projectile") s.projectile.speed *= 1.15;
      });
    },
  },
  {
    id: "pierce",
    name: "Perfuração",
    desc: "Projéteis atravessam +1 inimigo",
    apply: (world, id) => {
      const w = world.get(id, WeaponState);
      if (!w) return;
      eachShot(w.burst, (s) => {
        if (s.type === "projectile") s.projectile.pierce += 1;
      });
    },
  },
  {
    id: "move_speed",
    name: "Mais veloz",
    desc: "+12% de velocidade de movimento",
    apply: (world, id) => {
      const v = world.get(id, Velocity);
      if (v) v.speed *= 1.12;
    },
  },
  {
    id: "max_hp",
    name: "Mais vida",
    desc: "+25 HP máximo (cura junto)",
    apply: (world, id) => {
      const h = world.get(id, Health);
      if (h) {
        h.max += 25;
        h.current = Math.min(h.max, h.current + 25);
      }
    },
  },
  {
    id: "pickup_radius",
    name: "Ímã",
    desc: "+25% de raio de coleta",
    apply: (world, id) => {
      const p = world.get(id, PlayerProgress);
      if (p) p.pickupRadius *= 1.25;
    },
  },
];
