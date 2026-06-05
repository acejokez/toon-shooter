/**
 * ProjectileManager — pool + per-step movement for all bullets (TDD §5.4).
 */
import { ObjectPool } from '../core/ObjectPool.js';
import { Projectile } from '../entities/Projectile.js';
import { CONFIG } from '../config/constants.js';

export class ProjectileManager {
  constructor(scene) {
    this.pool = new ObjectPool(() => new Projectile(scene), CONFIG.POOL.projectiles);
  }

  spawn(spec) {
    return this.pool.spawn(spec);
  }

  get active() {
    return this.pool.active;
  }

  step(h, scrollDx) {
    this.pool.updateAll((p) => p.step(h, scrollDx));
  }

  despawn(p) {
    this.pool.despawn(p);
  }

  reset() {
    this.pool.despawnAll();
  }
}
