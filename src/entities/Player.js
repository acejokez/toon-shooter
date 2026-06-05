/**
 * Player — the most important class (TDD §5.1).
 *
 * Movement model: kinematic, fixed-step, deterministic manual gravity (no
 * physics engine). The player anchor X is fixed; only Y (jump) and hitbox
 * height (crouch) change. The world scrolls past it.
 *
 * Weapon mount: the character glTF embeds every gun as a child mesh; swapping
 * weapons toggles which embedded mesh is visible (TDD §5.1 weapon mount).
 */
import * as THREE from 'three';
import { CONFIG } from '../config/constants.js';
import { EMBEDDED_GUN_NODES, resolveWeapon } from '../config/weapons.js';
import { Events } from '../core/events.js';
import { AnimController } from '../core/AnimController.js';
import { AssetManager } from '../core/AssetManager.js';
import { Team } from '../config/constants.js';

export const PlayerState = {
  GROUNDED: 'grounded',
  JUMPING: 'jumping',
  CROUCHING: 'crouching',
  HIT: 'hit',
  DEAD: 'dead',
};

export class Player {
  /**
   * @param {object} deps
   * @param {THREE.Scene} deps.scene
   * @param {AssetManager} deps.assets
   * @param {import('../core/events.js').EventBus} deps.bus
   * @param {import('../systems/ProjectileManager.js').ProjectileManager} deps.projectiles
   * @param {{loadout:string[], upgrades:object}} deps.config persisted run config
   */
  constructor({ scene, assets, bus, projectiles, audio, config }) {
    this.bus = bus;
    this.assets = assets;
    this.projectiles = projectiles;
    this.audio = audio ?? null;

    const char = assets.getCharacter('Character_Soldier', {
      targetHeight: CONFIG.HEIGHTS.character,
      face: 'right',
    });
    this.root = char.root;
    // Uniform scale baked in by normalizeModel — crouch/squash multiply onto it.
    this._baseScale = this.root.scale.x;
    this.root.position.set(CONFIG.PLAYER_X, CONFIG.GROUND_Y, 0);
    scene.add(this.root);

    this.anim = new AnimController(char.mixer, char.animations);

    // Hide all embedded guns up front; active weapon mesh is shown in setWeapon.
    for (const g of EMBEDDED_GUN_NODES) AssetManager.setChildVisible(this.root, g, false);

    // Run config (loadout + upgrades from SaveManager).
    this.loadout = config?.loadout ?? ['Pistol', 'Shotgun', 'SMG'];
    this.upgrades = config?.upgrades ?? {};
    this.weaponIndex = 0;
    this.weapon = resolveWeapon(this.loadout[0], this.upgrades);

    this._initRunState();
    this.setWeapon(0);
    this.anim.switch('Run_Gun', { fade: 0 });
  }

  _initRunState() {
    this.state = PlayerState.GROUNDED;
    this.y = CONFIG.GROUND_Y;
    this.vy = 0;
    this.hp = CONFIG.PLAYER_HP;
    this.ap = CONFIG.AP_MAX;
    this.crouching = false;
    this.isGrounded = true;
    this._lastShot = -Infinity;
    this._now = 0;
    this._invulnUntil = 0;
    this._shootBiasUntil = 0;
    this.alive = true;

    // Movement-feel state.
    this._coyote = 0; // time-since-grounded grace
    this._jumpBuffer = 0; // pressed-early grace
    this._jumpCutDone = false;
    this.platform = null; // obstacle currently standing on (null = ground)

    // Squash & stretch multipliers (lerp back to 1).
    this._sqY = 1;
    this._sqXZ = 1;
    this._crouchK = 0; // 0 = standing, 1 = fully crouched (smoothed)
  }

  // --- weapons ---

  setWeapon(index) {
    this.weaponIndex = index;
    const name = this.loadout[index];
    this.weapon = resolveWeapon(name, this.upgrades);
    for (const g of EMBEDDED_GUN_NODES) AssetManager.setChildVisible(this.root, g, false);
    AssetManager.setChildVisible(this.root, this.weapon.model, true);
    this.bus.emit(Events.WEAPON_SWAP, { name, index });
  }

  /** Swap by 1-based slot (keys 1-3). */
  swapSlot(slot) {
    const idx = slot - 1;
    if (idx >= 0 && idx < this.loadout.length && idx !== this.weaponIndex) {
      this.setWeapon(idx);
    }
  }

  // --- physics (fixed step) ---

  /**
   * Advance one fixed physics step.
   * @param {number} h fixed step seconds
   * @param {import('../core/InputController.js').InputController} input
   */
  stepPhysics(h, input, obstacles = []) {
    if (this.state === PlayerState.DEAD) return;
    this._now += h;

    const prevY = this.y;

    // --- jump intent: buffer + coyote time ---
    if (input.consumeJump()) this._jumpBuffer = CONFIG.JUMP_BUFFER;
    this._jumpBuffer = Math.max(0, this._jumpBuffer - h);
    this._coyote = this.isGrounded ? CONFIG.COYOTE_TIME : Math.max(0, this._coyote - h);

    if (this._jumpBuffer > 0 && this._coyote > 0) {
      this.vy = CONFIG.JUMP_VELOCITY;
      this.isGrounded = false;
      this.platform = null;
      this._jumpBuffer = 0;
      this._coyote = 0;
      this._jumpCutDone = false;
      this.state = PlayerState.JUMPING;
      this._jumpSquash = true;
      this.audio?.jump();
    }

    // Crouch (held). Cannot crouch mid-air.
    this.crouching = input.isCrouching && this.isGrounded;

    // --- gravity (asymmetric) + variable jump height ---
    if (!this.isGrounded) {
      // Variable height: releasing SPACE while rising cuts the climb.
      if (!input.isJumpHeld && this.vy > 0 && !this._jumpCutDone) {
        this.vy *= CONFIG.JUMP_CUT;
        this._jumpCutDone = true;
      }
      const g = this.vy > 0 ? CONFIG.GRAVITY : CONFIG.FALL_GRAVITY;
      this.vy -= g * h;
      this.y += this.vy * h;
    }

    // --- support resolution: ground (Y=0) or one-way platform tops ---
    let supportY = CONFIG.GROUND_Y;
    let support = null;
    for (const o of obstacles) {
      if (!o.alive || !o.data?.standable) continue;
      const hb = o.getHitbox();
      const halfSpan = (hb.w + CONFIG.PLAYER_W) / 2;
      if (Math.abs(hb.x - CONFIG.PLAYER_X) > halfSpan) continue; // not over it
      const top = o.topY;
      // One-way: only catch when we were at/above the surface.
      if (prevY + 1e-3 >= top && top > supportY) {
        supportY = top;
        support = o;
      }
    }

    if (this.isGrounded) {
      // Still supported? (the platform may have scrolled out from under us)
      if (supportY < this.y - 0.05) {
        this.isGrounded = false;
        this.platform = null;
        this.state = PlayerState.JUMPING; // walked off the edge
      } else {
        this.y = supportY;
        this.platform = support;
      }
    } else if (this.vy <= 0 && this.y <= supportY) {
      // Landing.
      this.y = supportY;
      this.vy = 0;
      this.isGrounded = true;
      this.platform = support;
      this.state = PlayerState.GROUNDED;
      this._landed = true;
      this._landSquash = true;
      this.audio?.land();
    }
    this.root.position.y = this.y;

    // AP regen.
    this.ap = Math.min(CONFIG.AP_MAX, this.ap + CONFIG.AP_REGEN_PER_S * h);

    // Weapon swap.
    const swap = input.consumeWeaponSwap();
    if (swap) this.swapSlot(swap);

    // Fire (held-to-fire, gated by fireRate + AP).
    if (input.isFiring) this.tryFire();

    // Resolve hit i-frames back to a normal state.
    if (this.state === PlayerState.HIT && this._now >= this._invulnUntil) {
      this.state = this.isGrounded ? PlayerState.GROUNDED : PlayerState.JUMPING;
    }
  }

  tryFire() {
    if (this.state === PlayerState.DEAD) return false;
    const minInterval = 1 / this.weapon.fireRate;
    if (this._now - this._lastShot < minInterval) return false;
    if (this.ap < this.weapon.apCost) return false;

    this._lastShot = this._now;
    this.ap -= this.weapon.apCost;
    this._shootBiasUntil = this._now + 0.2;

    const muzzle = this.getMuzzle();
    const w = this.weapon;
    if (w.pellets) {
      const mid = (w.pellets - 1) / 2;
      for (let i = 0; i < w.pellets; i++) {
        const ang = (i - mid) * w.spread;
        this.projectiles.spawn({
          team: Team.PLAYER,
          x: muzzle.x,
          y: muzzle.y,
          vx: Math.cos(ang) * w.projSpeed,
          vy: Math.sin(ang) * w.projSpeed,
          damage: w.damage,
        });
      }
    } else {
      this.projectiles.spawn({
        team: Team.PLAYER,
        x: muzzle.x,
        y: muzzle.y,
        vx: w.projSpeed,
        vy: 0,
        damage: w.damage,
      });
    }
    this.bus.emit(Events.SHOT_FIRED, { weapon: w.name });
    this.audio?.shoot(w.name);
    return true;
  }

  getMuzzle() {
    const h = this.crouching ? CONFIG.PLAYER_H * 0.5 : CONFIG.PLAYER_H;
    return { x: CONFIG.PLAYER_X + 0.7, y: this.y + h * 0.55 };
  }

  // --- damage ---

  takeDamage(amount, { breakStreak = false } = {}) {
    if (!this.alive || this._now < this._invulnUntil) return false;
    this.hp -= amount;
    this._invulnUntil = this._now + CONFIG.HIT_INVULN;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    } else {
      this.state = PlayerState.HIT;
    }
    this.bus.emit(Events.PLAYER_HIT, { amount, hp: this.hp, breakStreak });
    return true;
  }

  heal(amount) {
    this.hp = Math.min(CONFIG.PLAYER_HP, this.hp + amount);
  }

  die() {
    this.state = PlayerState.DEAD;
    this.alive = false;
    this.anim.switch('Death', { loop: false, fade: 0.1 });
    this.bus.emit(Events.PLAYER_DEAD, {});
  }

  // --- hitbox (current, possibly crouched) ---

  getHitbox() {
    const h = this.crouching ? CONFIG.PLAYER_H * CONFIG.CROUCH_HITBOX_SCALE : CONFIG.PLAYER_H;
    return { x: CONFIG.PLAYER_X, y: this.y + h / 2, w: CONFIG.PLAYER_W, h };
  }

  // --- per-frame animation (render dt) ---

  update(dt) {
    this._syncAnimation();

    // Trigger squash/stretch impulses set during the physics step.
    if (this._jumpSquash) {
      this._jumpSquash = false;
      this._sqY = 1.18; // stretch up
      this._sqXZ = 0.86;
    }
    if (this._landSquash) {
      this._landSquash = false;
      this._sqY = 0.74; // squash down
      this._sqXZ = 1.2;
    }

    // Ease squash multipliers + crouch factor back toward rest.
    const k = Math.min(1, dt * 12);
    this._sqY += (1 - this._sqY) * k;
    this._sqXZ += (1 - this._sqXZ) * k;
    this._crouchK += ((this.crouching ? 1 : 0) - this._crouchK) * Math.min(1, dt * 16);

    // Compose: normalization base scale * crouch * transient squash.
    const crouchSY = 1 - this._crouchK * 0.45; // down to 0.55 when crouched
    const b = this._baseScale;
    this.root.scale.set(b * this._sqXZ, b * crouchSY * this._sqY, b * this._sqXZ);

    this.anim.update(dt);
  }

  _syncAnimation() {
    if (this.state === PlayerState.DEAD) return;
    const shooting = this._now < this._shootBiasUntil;

    let clip;
    if (this._landed) {
      this._landed = false;
      this.anim.switch('Jump_Land', {
        loop: false,
        fade: 0.05,
        onFinished: () => {},
      });
      return;
    }
    if (!this.isGrounded) {
      clip = this.vy > 0 ? 'Jump' : 'Jump_Idle';
    } else if (this.crouching) {
      clip = 'Walk'; // closest crouch/slide proxy
    } else if (shooting) {
      clip = 'Run_Shoot';
    } else {
      clip = 'Run_Gun';
    }
    // Don't interrupt a one-shot land mid-play.
    if (this.anim.currentName === 'Jump_Land' && this.anim.current?.isRunning()) return;
    this.anim.switch(clip);
  }

  /** Reset for a fresh run (reused player instance). */
  respawn() {
    this._initRunState();
    this.root.position.set(CONFIG.PLAYER_X, CONFIG.GROUND_Y, 0);
    this.root.scale.setScalar(this._baseScale);
    this.setWeapon(0);
    this.anim.switch('Run_Gun', { fade: 0, force: true });
  }
}
