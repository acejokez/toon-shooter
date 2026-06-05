/**
 * Enemy — ground combatant (`Character_Enemy`) and elevated sniper
 * (`Character_Hazmat` on `Structure_1`), parameterized by `kind` (TDD §5.2/§5.3).
 *
 *  - ground: spawns off-screen right, moves left at scroll+closing speed, fires
 *    a left-traveling bullet periodically.
 *  - sniper: perches on a platform (scrolls with the world), fires
 *    downward-diagonal bullets aimed at the player.
 *
 * Dies on player projectile hit: plays Death, then despawns after the clip.
 */
import * as THREE from 'three';
import { CONFIG, Team } from '../config/constants.js';
import { AnimController } from '../core/AnimController.js';
import { EMBEDDED_GUN_NODES } from '../config/weapons.js';
import { AssetManager } from '../core/AssetManager.js';

const SNIPER_PLATFORM_TOP = 2.4;

export class Enemy {
  /**
   * @param {THREE.Scene} scene
   * @param {AssetManager} assets
   * @param {'ground'|'sniper'} kind
   */
  constructor(scene, assets, kind) {
    this.kind = kind;
    this.group = new THREE.Group();
    this.root = this.group;
    scene.add(this.group);

    const charName = kind === 'sniper' ? 'Character_Hazmat' : 'Character_Enemy';
    const char = assets.getCharacter(charName, {
      targetHeight: CONFIG.HEIGHTS.character,
      face: 'left',
    });
    this.char = char.root;
    this.anim = new AnimController(char.mixer, char.animations);

    // Show a rifle on the enemy for readability; hide the rest.
    for (const g of EMBEDDED_GUN_NODES) AssetManager.setChildVisible(this.char, g, false);
    AssetManager.setChildVisible(this.char, kind === 'sniper' ? 'Sniper' : 'AK', true);

    if (kind === 'sniper') {
      try {
        this.platform = assets.getProp('Structure_1', {
          targetHeight: CONFIG.HEIGHTS.platform,
          recenterY: true,
        });
        this.group.add(this.platform);
      } catch {
        /* platform optional */
      }
      this.char.position.y = SNIPER_PLATFORM_TOP;
      this.elevation = SNIPER_PLATFORM_TOP;
    } else {
      this.elevation = 0;
    }
    this.group.add(this.char);

    this.active = false;
    this.alive = false;
    this.hp = 1;
    this._fireTimer = 0;
    this._deathTimer = 0;
  }

  reset({ x }) {
    this.group.position.set(x, 0, 0);
    this.alive = true;
    this.hp = this.kind === 'sniper' ? CONFIG.HAZMAT_HP : CONFIG.ENEMY_HP;
    this._fireTimer = this.kind === 'sniper' ? CONFIG.HAZMAT_FIRE_INTERVAL : CONFIG.ENEMY_FIRE_INTERVAL;
    this._deathTimer = 0;
    this.char.scale.y = 1;
    this.anim.switch('Run_Gun', { fade: 0, force: true });
  }

  /**
   * Advance one step.
   * @returns {boolean} true => despawn
   */
  step(h, scrollDx, player, fire) {
    if (!this.alive) {
      // Dying: ride the scroll, count down to despawn.
      this.group.position.x -= scrollDx;
      this._deathTimer -= h;
      return this._deathTimer <= 0 || this.group.position.x < CONFIG.DESPAWN_X;
    }

    if (this.kind === 'ground') {
      this.group.position.x -= scrollDx + CONFIG.ENEMY_CLOSING_SPEED * h;
    } else {
      this.group.position.x -= scrollDx; // perched; rides the world
    }

    // Fire on a timer.
    this._fireTimer -= h;
    if (this._fireTimer <= 0 && this.group.position.x < CONFIG.SPAWN_X - 1) {
      this._fireTimer = this.kind === 'sniper' ? CONFIG.HAZMAT_FIRE_INTERVAL : CONFIG.ENEMY_FIRE_INTERVAL;
      this._fire(player, fire);
    }

    return this.group.position.x < CONFIG.DESPAWN_X;
  }

  _fire(player, fire) {
    const ox = this.group.position.x;
    const oy = this.elevation + 1.1;
    const speed = 12;
    let vx = -speed;
    let vy = 0;
    if (this.kind === 'sniper' && player) {
      const ph = player.getHitbox();
      const dx = ph.x - ox;
      const dy = ph.y - oy;
      const len = Math.hypot(dx, dy) || 1;
      vx = (dx / len) * speed;
      vy = (dy / len) * speed;
    }
    fire({ team: Team.ENEMY, x: ox - 0.5, y: oy, vx, vy, damage: CONFIG.ENEMY_BULLET_DAMAGE });
  }

  /** @returns {boolean} killed this hit */
  takeDamage(amount) {
    if (!this.alive) return false;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.kill();
      return true;
    }
    this.anim.switch('HitReact', { loop: false, fade: 0.05 });
    return false;
  }

  kill() {
    this.alive = false;
    this._deathTimer = 1.0;
    this.anim.switch('Death', { loop: false, fade: 0.1 });
  }

  getHitbox() {
    const p = this.group.position;
    return { x: p.x, y: this.elevation + CONFIG.HEIGHTS.character / 2, w: 0.9, h: CONFIG.HEIGHTS.character };
  }

  update(dt) {
    this.anim.update(dt);
  }
}
