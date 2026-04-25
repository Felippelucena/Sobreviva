import { createBackgroundSprite } from "../engine/Background";
import { Camera } from "../engine/Camera";
import { EventBus } from "../engine/events/EventBus";
import { Loop } from "../engine/Loop";
import { Renderer } from "../engine/Renderer";
import { Rng } from "../engine/Rng";
import { SpatialGrid } from "../engine/SpatialGrid";
import { World, type EntityId } from "../engine/World";
import type { CharacterDef, EnemyDef, WeaponDef } from "../content/schema";
import { GameState } from "../game/GameState";
import { Health, PlayerTag, Position, WeaponState } from "../game/components";
import {
  spawnEnemy,
  spawnPlayerFromCharacter,
  weaponStateFromDef,
} from "../game/factories";
import { aiSystem } from "../game/systems/AISystem";
import {
  collisionSystem,
  destroyEntityWithDisplay,
} from "../game/systems/CollisionSystem";
import { lifetimeSystem } from "../game/systems/LifetimeSystem";
import { movementSystem } from "../game/systems/MovementSystem";
import { renderSyncSystem } from "../game/systems/RenderSyncSystem";
import { weaponSystem } from "../game/systems/WeaponSystem";
import { EnemyTag } from "../game/components";

const FALLBACK_WEAPON: WeaponDef = {
  kind: "weapon",
  id: "_preview",
  name: "Preview",
  cooldownMs: 500,
  burst: {
    volleyCount: 1,
    volleyIntervalMs: 0,
    volleys: [
      {
        shots: [
          {
            type: "projectile",
            angleOffsetDeg: 0,
            damage: 10,
            projectile: { speed: 320, radius: 4, lifetimeMs: 800, pierce: 0, color: 0xffd166 },
          },
        ],
      },
    ],
  },
};

const FALLBACK_ENEMY: EnemyDef = {
  kind: "enemy",
  id: "_preview_enemy",
  name: "Target",
  hp: 40,
  speed: 40,
  contactDamage: 0,
  xpDrop: 0,
  hitbox: { radius: 10 },
  sprite: { color: 0xef476f, radius: 10 },
};

const FALLBACK_CHARACTER: CharacterDef = {
  kind: "character",
  id: "_preview_char",
  name: "Preview",
  startWeaponId: "_preview",
  baseHp: 9999,
  baseSpeed: 0,
  pickupRadius: 10,
  sprite: { color: 0x4cc9f0, radius: 12 },
};

const SPAWN_INTERVAL_MS = 550;
const SPAWN_RADIUS = 160;
const MAX_ENEMIES = 8;

export class LivePreview {
  private readonly renderer = new Renderer();
  private readonly world = new World();
  private readonly state = new GameState();
  private readonly rng = new Rng(1);
  private readonly grid = new SpatialGrid(48);
  private readonly bus = new EventBus();
  private loop: Loop | null = null;
  private camera!: Camera;
  private playerId: EntityId | null = null;
  private currentWeapon: WeaponDef = FALLBACK_WEAPON;
  private currentEnemy: EnemyDef = FALLBACK_ENEMY;
  private currentCharacter: CharacterDef = FALLBACK_CHARACTER;
  private spawnTimer = 0;
  private started = false;

  constructor(private readonly host: HTMLElement) {}

  async init(): Promise<void> {
    await this.renderer.init(this.host);
    this.camera = new Camera(this.renderer.world);
    const bg = createBackgroundSprite(48);
    this.renderer.background.addChild(bg);
    this.respawnPlayer();
    this.loop = new Loop({
      update: (tick) => this.update(tick.dt),
      render: (alpha) => this.render(alpha, bg),
    });
    this.loop.start();
    this.started = true;
  }

  setWeapon(def: WeaponDef | undefined): void {
    this.currentWeapon = def ?? FALLBACK_WEAPON;
    if (this.playerId !== null) {
      this.world.remove(this.playerId, WeaponState);
      this.world.add(this.playerId, WeaponState, weaponStateFromDef(this.currentWeapon));
    }
  }

  setEnemy(def: EnemyDef | undefined): void {
    const incoming = def ?? FALLBACK_ENEMY;
    this.currentEnemy = { ...incoming, xpDrop: 0, contactDamage: 0 };
    this.clearEnemies();
  }

  setCharacter(def: CharacterDef | undefined): void {
    this.currentCharacter = def ?? FALLBACK_CHARACTER;
    this.respawnPlayer();
  }

  dispose(): void {
    this.loop?.stop();
    if (!this.started) return;
    this.renderer.dispose();
  }

  private update(dt: number): void {
    aiSystem(this.world, this.state);
    movementSystem(this.world, dt);
    collisionSystem(
      {
        world: this.world,
        grid: this.grid,
        state: this.state,
        renderer: this.renderer,
        registry: fakeRegistry,
        rng: this.rng,
        bus: this.bus,
      },
      performance.now(),
    );
    weaponSystem(this.world, this.renderer, this.bus, dt);
    lifetimeSystem(this.world, dt);
    this.pumpSpawner(dt);

    if (this.playerId !== null) {
      const hp = this.world.get(this.playerId, Health);
      if (hp && hp.current <= 0) this.respawnPlayer();
    }

    this.world.flushDestroyed();
  }

  private render(alpha: number, bg: ReturnType<typeof createBackgroundSprite>): void {
    const now = performance.now();
    renderSyncSystem(this.world, alpha, now);
    const screen = this.renderer.app.screen;
    this.camera.follow({ x: 0, y: 0 }, screen.width, screen.height, 1);
    bg.width = screen.width;
    bg.height = screen.height;
    bg.tilePosition.set(-this.camera.x, -this.camera.y);
  }

  private respawnPlayer(): void {
    if (this.playerId !== null) {
      destroyEntityWithDisplay(this.world, this.playerId);
      this.playerId = null;
    }
    this.world.flushDestroyed();
    this.playerId = spawnPlayerFromCharacter(
      this.world,
      this.renderer,
      0,
      0,
      this.currentCharacter,
      this.currentWeapon,
    );
    this.state.playerId = this.playerId;
    this.state.gameOver = false;
    this.clearEnemies();
  }

  private pumpSpawner(dt: number): void {
    this.spawnTimer += dt * 1000;
    if (this.spawnTimer < SPAWN_INTERVAL_MS) return;
    this.spawnTimer = 0;
    if (this.countEnemies() >= MAX_ENEMIES) return;
    const angle = this.rng.range(0, Math.PI * 2);
    const dist = SPAWN_RADIUS;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    spawnEnemy(this.world, this.renderer, x, y, this.currentEnemy);
  }

  private countEnemies(): number {
    return this.world.count(EnemyTag);
  }

  private clearEnemies(): void {
    const ids: EntityId[] = [];
    for (const [id] of this.world.query(Position)) {
      if (this.world.has(id, EnemyTag)) ids.push(id);
    }
    for (const id of ids) destroyEntityWithDisplay(this.world, id);
    void PlayerTag;
  }
}

// CollisionSystem wants a ContentRegistry to resolve XP orb pickup defs. In preview we keep
// enemies with xpDrop=0 so that branch is never hit, but the type still requires a registry.
const fakeRegistry = {
  find: () => undefined,
  get: () => {
    throw new Error("fakeRegistry.get should not be called in preview");
  },
  list: () => [],
  packOrder: [],
} as unknown as import("../content/registry/ContentRegistry").ContentRegistry;
