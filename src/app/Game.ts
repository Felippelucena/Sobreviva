import type { TilingSprite } from "pixi.js";
import type { ContentRegistry } from "../content/registry/ContentRegistry";
import { Audio } from "../engine/Audio";
import { createBackgroundSprite } from "../engine/Background";
import { Camera } from "../engine/Camera";
import { Input } from "../engine/Input";
import { Loop } from "../engine/Loop";
import { Renderer } from "../engine/Renderer";
import { Rng } from "../engine/Rng";
import { SpatialGrid } from "../engine/SpatialGrid";
import { World } from "../engine/World";
import { EventBus } from "../engine/events/EventBus";
import { GameState } from "../game/GameState";
import { PlayerProgress, Position } from "../game/components";
import { spawnPlayerFromCharacter } from "../game/factories";
import { pickUpgrades } from "../game/progression/UpgradePicker";
import { aiSystem } from "../game/systems/AISystem";
import { collisionSystem } from "../game/systems/CollisionSystem";
import { inputSystem } from "../game/systems/InputSystem";
import { lifetimeSystem } from "../game/systems/LifetimeSystem";
import { movementSystem } from "../game/systems/MovementSystem";
import { pickupSystem } from "../game/systems/PickupSystem";
import { renderSyncSystem } from "../game/systems/RenderSyncSystem";
import { EnemySpawner } from "../game/systems/SpawnSystem";
import { weaponSystem } from "../game/systems/WeaponSystem";
import { Hud } from "../ui/Hud";
import { UpgradeModal } from "../ui/UpgradeModal";
import type { JsRuntime } from "../mods/JsRuntime";

const DEFAULT_MAP_ID = "plains";
const SHAKE_DECAY = 0.88;

export interface GameResult {
  characterId: string;
  timeMs: number;
  kills: number;
  level: number;
}

export interface GameOptions {
  host: HTMLElement;
  registry: ContentRegistry;
  characterId: string;
  onRunEnded: (result: GameResult) => void;
  jsRuntime?: JsRuntime | null;
}

export class Game {
  private readonly renderer = new Renderer();
  private readonly world = new World();
  private readonly input: Input;
  private readonly state = new GameState();
  private readonly rng = new Rng();
  private readonly grid = new SpatialGrid(64);
  private readonly bus = new EventBus();
  private readonly audio = new Audio();
  private camera!: Camera;
  private spawner!: EnemySpawner;
  private hud!: Hud;
  private upgradeModal!: UpgradeModal;
  private loop!: Loop;
  private bgSprite!: TilingSprite;
  private readonly registry: ContentRegistry;
  private readonly host: HTMLElement;
  private readonly characterId: string;
  private readonly onRunEnded: (result: GameResult) => void;
  private readonly jsRuntime: JsRuntime | null;
  private jsDetach: (() => void) | null = null;
  private endedNotified = false;
  private externalPause = false;

  constructor(opts: GameOptions) {
    this.host = opts.host;
    this.registry = opts.registry;
    this.characterId = opts.characterId;
    this.onRunEnded = opts.onRunEnded;
    this.jsRuntime = opts.jsRuntime ?? null;
    this.host.innerHTML = "";
    this.input = new Input();
  }

  async start(): Promise<void> {
    await this.renderer.init(this.host);
    this.bgSprite = createBackgroundSprite(64);
    this.renderer.background.addChild(this.bgSprite);
    this.camera = new Camera(this.renderer.world);
    this.hud = new Hud(this.host);
    this.upgradeModal = new UpgradeModal(this.host);

    const character = this.registry.get("character", this.characterId);
    const weapon = this.registry.get("weapon", character.startWeaponId);
    const map = this.registry.get("map", DEFAULT_MAP_ID);
    const wave = this.registry.get("wave", map.waveId);

    this.state.playerId = spawnPlayerFromCharacter(
      this.world,
      this.renderer,
      0,
      0,
      character,
      weapon,
    );
    this.spawner = new EnemySpawner(
      this.world,
      this.renderer,
      this.rng,
      this.state,
      this.registry,
      wave,
      map,
      this.bus,
    );

    this.wireAudio();
    this.jsDetach = this.jsRuntime?.attachToGame(this.bus, this.world, this.renderer, this.registry, this.state) ?? null;

    this.audio.ensure();

    this.loop = new Loop({
      update: (tick) => this.update(tick.dt),
      render: (alpha) => this.render(alpha),
    });
    this.loop.start();
  }

  setExternalPause(paused: boolean): void {
    this.externalPause = paused;
    if (!paused) return;
    this.state.paused = true;
  }

  isUpgradeModalOpen(): boolean {
    return this.upgradeModal?.isOpen() ?? false;
  }

  endRun(): void {
    if (this.endedNotified) return;
    this.state.gameOver = true;
  }

  private update(dt: number): void {
    if (this.state.gameOver) {
      this.world.flushDestroyed();
      if (!this.endedNotified) {
        this.endedNotified = true;
        this.audio.play("death");
        this.loop.stop();
        this.onRunEnded(this.result());
      }
      return;
    }
    this.maybeOpenUpgradeModal();

    const internalPauseActive =
      this.state.paused && (this.upgradeModal.isOpen() || this.externalPause);

    if (this.externalPause || internalPauseActive) {
      this.world.flushDestroyed();
      return;
    }
    this.state.paused = false;

    this.state.runTimeMs += dt * 1000;
    const nowMs = performance.now();

    inputSystem(this.world, this.input);
    aiSystem(this.world, this.state);
    movementSystem(this.world, dt);
    collisionSystem(
      {
        world: this.world,
        grid: this.grid,
        state: this.state,
        renderer: this.renderer,
        registry: this.registry,
        rng: this.rng,
        bus: this.bus,
      },
      nowMs,
    );
    weaponSystem(this.world, this.renderer, this.bus, dt);
    pickupSystem(this.world, this.state, this.bus, dt);
    lifetimeSystem(this.world, dt);
    this.spawner.update(dt);
    this.bus.emit("tick", { dt, elapsedMs: this.state.runTimeMs });

    if (this.state.shakeAmount > 0) {
      this.state.shakeAmount *= SHAKE_DECAY;
      if (this.state.shakeAmount < 0.2) this.state.shakeAmount = 0;
    }

    this.world.flushDestroyed();
  }

  private wireAudio(): void {
    this.bus.on("weaponFire", () => this.audio.play("shoot"), "audio");
    this.bus.on("playerHit", () => this.audio.play("hit"), "audio");
    this.bus.on("enemyDeath", () => this.audio.play("hit"), "audio");
    this.bus.on("levelUp", () => this.audio.play("levelup"), "audio");
  }

  private maybeOpenUpgradeModal(): void {
    if (this.state.playerId === null) return;
    if (this.upgradeModal.isOpen()) return;
    const progress = this.world.get(this.state.playerId, PlayerProgress);
    if (!progress || progress.pendingLevelUps <= 0) return;
    const options = pickUpgrades(this.rng, 3);
    this.state.paused = true;
    this.upgradeModal.show(options, (chosen) => {
      chosen.apply(this.world, this.state.playerId!);
      progress.pendingLevelUps -= 1;
      if (progress.pendingLevelUps <= 0 && !this.externalPause) {
        this.state.paused = false;
      }
    });
  }

  private render(alpha: number): void {
    const nowMs = performance.now();
    renderSyncSystem(this.world, alpha, nowMs);
    const screen = this.renderer.app.screen;
    if (this.state.playerId !== null) {
      const pos = this.world.get(this.state.playerId, Position);
      if (pos) {
        const px = pos.prevX + (pos.x - pos.prevX) * alpha;
        const py = pos.prevY + (pos.y - pos.prevY) * alpha;
        this.camera.follow({ x: px, y: py }, screen.width, screen.height, 0.2);
      }
    }
    if (this.state.shakeAmount > 0) {
      const sx = (Math.random() - 0.5) * this.state.shakeAmount * 2;
      const sy = (Math.random() - 0.5) * this.state.shakeAmount * 2;
      this.renderer.world.position.x += sx;
      this.renderer.world.position.y += sy;
    }
    this.bgSprite.width = screen.width;
    this.bgSprite.height = screen.height;
    this.bgSprite.tilePosition.set(-this.camera.x, -this.camera.y);
    this.hud.update(this.world, this.state);
  }

  private result(): GameResult {
    const progress =
      this.state.playerId !== null
        ? this.world.get(this.state.playerId, PlayerProgress)
        : undefined;
    return {
      characterId: this.characterId,
      timeMs: this.state.runTimeMs,
      kills: this.state.kills,
      level: progress?.level ?? 1,
    };
  }

  dispose(): void {
    this.loop?.stop();
    this.jsDetach?.();
    this.jsDetach = null;
    this.input.dispose();
    this.hud?.dispose();
    this.upgradeModal?.dispose();
    this.audio.dispose();
    this.renderer.dispose();
  }
}
