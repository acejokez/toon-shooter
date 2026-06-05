/**
 * Game — orchestrator: state machine, fixed-step loop, system wiring (TDD §2, §7).
 *
 * Data flow per PLAYING frame:
 *   Input -> player intent -> fixed-step physics (gravity/jump) -> world scroll
 *   -> spawn director -> move pooled entities -> collisions -> resolve
 *   -> animation mixers -> UI sync -> render.
 */
import * as THREE from 'three';
import { CONFIG, GameState } from './config/constants.js';
import { ALL_PRELOAD, PRELOAD } from './config/assets.js';
import { clamp, makeRng } from './util/math.js';

import { EventBus, Events } from './core/events.js';
import { AssetManager } from './core/AssetManager.js';
import { InputController } from './core/InputController.js';
import { SaveManager } from './core/SaveManager.js';
import { AudioManager } from './core/AudioManager.js';

import { Stage } from './world/Stage.js';
import { Ground } from './world/Ground.js';
import { Parallax } from './world/Parallax.js';

import { Player } from './entities/Player.js';
import { ProjectileManager } from './systems/ProjectileManager.js';
import { EnemyManager } from './systems/EnemyManager.js';
import { ObstacleManager } from './systems/ObstacleManager.js';
import { PickupManager } from './systems/PickupManager.js';
import { SpawnDirector } from './systems/SpawnDirector.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { ScoreSystem } from './systems/ScoreSystem.js';

import { Hud } from './ui/Hud.js';
import { Menu } from './ui/Menu.js';
import { ShopPanel } from './ui/ShopPanel.js';

export class Game {
  constructor() {
    this.state = GameState.LOADING;
    this.clock = new THREE.Clock();
    this.acc = 0;
    this.timeScale = 1;
    this.seed = 1;
    this.rng = makeRng(this.seed);
    this.scrollSpeed = CONFIG.SCROLL_SPEED_START;

    this.bus = new EventBus();
    this.assets = new AssetManager();
    this.audio = new AudioManager();
    this.save = new SaveManager();
    this.save.load();

    this.container = document.getElementById('canvas-container');
    this.stage = new Stage(this.container);
    this.input = new InputController(this.container);

    this.hud = new Hud();
    this.menu = new Menu();
    this.shop = new ShopPanel(this.save);

    this.player = null;
    this._gameOverPending = false;
  }

  // ---- boot / asset preload (LOADING -> MENU) ----

  async boot() {
    this.menu.showLoading();
    this.input.attach();
    await this.assets.preload(ALL_PRELOAD, (loaded, total) =>
      this.menu.setLoadProgress(loaded / total),
    );

    this._buildWorld();
    this._wireEvents();
    this.stage.renderer.setAnimationLoop(() => this._frame());
    this._toMenu();
  }

  _buildWorld() {
    this.ground = new Ground(this.stage.scene);
    this.parallax = new Parallax(this.stage.scene, this.assets, {
      far: PRELOAD.parallaxFar,
      mid: PRELOAD.parallaxMid,
      near: PRELOAD.parallaxNear,
    });

    this.projectiles = new ProjectileManager(this.stage.scene);
    this.enemies = new EnemyManager(this.stage.scene, this.assets);
    this.obstacles = new ObstacleManager(this.stage.scene, this.assets);
    this.pickups = new PickupManager(this.stage.scene, this.assets);

    this.score = new ScoreSystem(this.bus);
    this.collisions = new CollisionSystem(this.bus, {
      projectiles: this.projectiles,
      enemies: this.enemies,
      obstacles: this.obstacles,
      pickups: this.pickups,
    });
    this.spawnDirector = new SpawnDirector(
      { obstacles: this.obstacles, enemies: this.enemies, pickups: this.pickups },
      this.seed,
    );

    this.player = new Player({
      scene: this.stage.scene,
      assets: this.assets,
      bus: this.bus,
      projectiles: this.projectiles,
      audio: this.audio,
      config: { loadout: this.save.data.loadout, upgrades: this.save.data.upgrades },
    });
    this.player.root.visible = false;
  }

  _wireEvents() {
    this.bus.on(Events.PLAYER_HIT, (e) => {
      this.hud.flashScreen('#ff3322', 0.32, 0.12);
      this.stage.shake(0.4, 0.3);
      this.audio.hit();
      if (e.breakStreak) this.hud.floatText('STREAK LOST', '#ff8844', 50, 35);
    });

    this.bus.on(Events.ENEMY_KILLED, (e) => {
      this.hud.floatText('+' + CONFIG.SCRAP_PER_KILL, '#ffcc33', 55, 38);
      this.stage.shake(0.18, 0.18);
      this.audio.kill();
      if (this.score.streak > 0 && this.score.streak % 5 === 0) this._slowMo(0.4, 0.18);
      if (this.rng() < CONFIG.SCRAP_PICKUP_CHANCE) this.pickups.spawn('scrap', e.x);
    });

    this.bus.on(Events.MINE_DETONATE, () => {
      this.hud.flashScreen('#ffaa33', 0.4, 0.1);
      this.stage.shake(0.6, 0.35);
      this.audio.explosion();
    });

    this.bus.on(Events.PICKUP_HEALTH, () => {
      this.hud.floatText('+HP', '#6fff7a', 45, 40);
      this.audio.pickupHealth();
    });
    this.bus.on(Events.PICKUP_SCRAP, () => this.audio.pickupScrap());
    this.bus.on(Events.WEAPON_SWAP, (e) => {
      this.hud.floatText(e.name, '#5fd0ff', 40, 45);
      this.audio.swap();
    });
    this.bus.on(Events.PLAYER_DEAD, () => {
      this.audio.death();
      this._onPlayerDead();
    });
  }

  // ---- state transitions ----

  _setState(s) {
    this.state = s;
    this.bus.emit(Events.STATE_CHANGE, { state: s });
  }

  _toMenu() {
    this._setState(GameState.MENU);
    this.input.setEnabled(false);
    this.hud.hide();
    this.shop.render();
    this.menu.showStart(this.save.data.best, () => this.startRun());
  }

  startRun() {
    this.audio.resume(); // user gesture (start button) unlocks WebAudio

    // Apply current persisted loadout/upgrades to the (reused) player.
    this.player.loadout = [...this.save.data.loadout];
    this.player.upgrades = this.save.data.upgrades;

    this.seed = (Date.now() >>> 0) || 1;
    this.rng = makeRng(this.seed);

    this._resetRun();
    this._setState(GameState.PLAYING);
    this.menu.hide();
    this.hud.show();
    this.input.setEnabled(true);
    this.clock.getDelta(); // flush accumulated idle time
  }

  _resetRun() {
    this.projectiles.reset();
    this.enemies.reset();
    this.obstacles.reset();
    this.pickups.reset();
    this.score.reset();
    this.spawnDirector.reset(this.seed);
    this.acc = 0;
    this.timeScale = 1;
    this.scrollSpeed = CONFIG.SCROLL_SPEED_START;
    this.player.respawn();
    this.player.root.visible = true;
    this._gameOverPending = false;
  }

  _onPlayerDead() {
    this._setState(GameState.GAME_OVER);
    this.input.setEnabled(false);
    this.stage.shake(0.8, 0.5);
    this.hud.flashScreen('#ff0000', 0.5, 0.2);

    const result = {
      distance: this.score.meters,
      streak: this.score.streak,
      scrap: this.score.scrap,
    };
    this.save.commitRun(result);

    // Let the death animation play before showing the screen.
    this._gameOverPending = true;
    setTimeout(() => {
      if (this.state !== GameState.GAME_OVER) return;
      this.shop.render();
      this.menu.showGameOver(result, this.save.data.best, () => this.startRun());
    }, 1300);
  }

  pause() {
    if (this.state === GameState.PLAYING) this._setState(GameState.PAUSED);
  }
  resume() {
    if (this.state === GameState.PAUSED) {
      this._setState(GameState.PLAYING);
      this.clock.getDelta();
    }
  }

  // ---- main loop ----

  _frame() {
    const dt = Math.min(this.clock.getDelta(), CONFIG.MAX_DT);

    if (this.state === GameState.PLAYING) {
      this.acc += dt * this.timeScale;
      let guard = 0;
      while (this.acc >= CONFIG.FIXED_STEP && guard++ < 8) {
        this.stepPhysics(CONFIG.FIXED_STEP);
        this.acc -= CONFIG.FIXED_STEP;
      }
    }

    // Animations advance on render dt (idle anims keep playing in menu/over).
    const animDt = dt * this.timeScale;
    if (this.player) this.player.update(animDt);
    this.enemies?.update(animDt);

    this.stage.updateShake(dt);
    this._syncUI();
    this.stage.render();
  }

  /** One deterministic fixed step (also the test-harness unit, TDD §11). */
  stepPhysics(h) {
    const meters = this.score.meters;
    this.scrollSpeed = clamp(
      CONFIG.SCROLL_SPEED_START + meters * CONFIG.SCROLL_RAMP_PER_M,
      CONFIG.SCROLL_SPEED_START,
      CONFIG.SCROLL_SPEED_MAX,
    );
    const dx = this.scrollSpeed * h;

    this.player.stepPhysics(h, this.input, this.obstacles.active);
    this.ground.update(dx);
    this.parallax.update(dx);
    this.spawnDirector.update(dx, meters);
    this.obstacles.step(dx);
    this.enemies.step(h, dx, this.player, (spec) => {
      this.projectiles.spawn(spec);
      this.audio.enemyShoot();
    });
    this.pickups.step(dx, h);
    this.projectiles.step(h, dx);
    this.collisions.update(this.player);
    this.score.addDistance(dx);
  }

  _slowMo(factor, duration) {
    this.timeScale = factor;
    clearTimeout(this._slowMoT);
    this._slowMoT = setTimeout(() => (this.timeScale = 1), duration * 1000);
  }

  _syncUI() {
    if (!this.player) return;
    this.hud.sync({
      hp: this.player.hp,
      ap: this.player.ap,
      meters: this.score.meters,
      streak: this.score.streak,
      scrap: this.score.scrap,
      weapon: this.player.weapon.name,
    });
  }

  // ---- deterministic test harness (TDD §11) ----

  installHarness() {
    const g = this;
    window.__game = {
      _g: g,
      get state() {
        return g.state;
      },
      setSeed: (s) => {
        g.seed = s >>> 0;
        g.rng = makeRng(g.seed);
        g.spawnDirector.reset(g.seed);
      },
      start: () => g.startRun(),
      stepFrames: (n) => {
        for (let i = 0; i < n; i++) g.stepPhysics(CONFIG.FIXED_STEP);
      },
      input: g.input,
      getPlayer: () => ({
        hp: g.player.hp,
        ap: g.player.ap,
        x: g.player.root.position.x,
        y: g.player.y,
        state: g.player.state,
        weapon: g.player.weapon.name,
        grounded: g.player.isGrounded,
      }),
      getScore: () => ({
        meters: g.score.meters,
        streak: g.score.streak,
        scrap: g.score.scrap,
      }),
      counts: () => ({
        projectiles: g.projectiles.active.length,
        enemies: g.enemies.active.length,
        obstacles: g.obstacles.active.length,
        pickups: g.pickups.active.length,
      }),
      // Deterministic probe: drop the player onto a STATIONARY platform and
      // confirm one-way landing works (exercises the real Player physics).
      landingProbe: () => {
        const p = g.player;
        const platform = {
          alive: true,
          data: { standable: true },
          topY: 1.1,
          getHitbox: () => ({ x: CONFIG.PLAYER_X, w: 1.0 }),
        };
        const noInput = {
          consumeJump: () => false,
          isJumpHeld: false,
          isCrouching: false,
          consumeWeaponSwap: () => 0,
          isFiring: false,
        };
        p.y = 3;
        p.vy = 0;
        p.isGrounded = false;
        p.platform = null;
        p.state = 'jumping';
        p.root.position.y = 3;
        for (let i = 0; i < 120; i++) p.stepPhysics(CONFIG.FIXED_STEP, noInput, [platform]);
        return { y: p.y, grounded: p.isGrounded, onPlatform: !!p.platform };
      },
    };
  }
}
