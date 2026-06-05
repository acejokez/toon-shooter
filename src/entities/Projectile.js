/**
 * Projectile — pooled bullet, two teams (TDD §5.4). Travels along a velocity
 * vector; despawns off-screen or on hit. Pure-ish: holds position + AABB.
 */
import * as THREE from 'three';
import { CONFIG, Team } from '../config/constants.js';

const RADIUS = 0.12;

export class Projectile {
  constructor(scene) {
    const geo = new THREE.SphereGeometry(RADIUS, 8, 6);
    this._matPlayer = new THREE.MeshStandardMaterial({
      color: 0xffe066,
      emissive: 0xffaa00,
      emissiveIntensity: 1.4,
    });
    this._matEnemy = new THREE.MeshStandardMaterial({
      color: 0xff5544,
      emissive: 0xff2200,
      emissiveIntensity: 1.4,
    });
    this.root = new THREE.Mesh(geo, this._matPlayer);
    this.root.visible = false;
    scene.add(this.root);

    this.active = false;
    this.team = Team.PLAYER;
    this.vx = 0;
    this.vy = 0;
    this.damage = 1;
  }

  reset({ team, x, y, vx, vy, damage }) {
    this.team = team;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.root.material = team === Team.PLAYER ? this._matPlayer : this._matEnemy;
    this.root.position.set(x, y, 0);
  }

  /** Returns true when it should despawn (off-screen). */
  step(h, scrollDx) {
    // Enemy/world projectiles drift with the world; player bullets are in world
    // space too but fast enough that scroll barely matters — apply scroll to all
    // for consistency so nothing appears to outrun the treadmill incorrectly.
    this.root.position.x += this.vx * h - (this.team === Team.ENEMY ? scrollDx : 0);
    this.root.position.y += this.vy * h;
    const p = this.root.position;
    return p.x < CONFIG.DESPAWN_X || p.x > CONFIG.SPAWN_X + 2 || p.y < -1 || p.y > 8;
  }

  getHitbox() {
    const p = this.root.position;
    return { x: p.x, y: p.y, w: RADIUS * 2, h: RADIUS * 2 };
  }
}
