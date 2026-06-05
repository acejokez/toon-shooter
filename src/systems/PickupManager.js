/**
 * PickupManager — pools for Health and Scrap pickups (TDD §5.6).
 */
import { ObjectPool } from '../core/ObjectPool.js';
import { Pickup } from '../entities/Pickup.js';
import { CONFIG } from '../config/constants.js';

export class PickupManager {
  constructor(scene, assets) {
    this.health = new ObjectPool(() => new Pickup(scene, assets, 'health'), CONFIG.POOL.pickups);
    this.scrap = new ObjectPool(() => new Pickup(scene, assets, 'scrap'), CONFIG.POOL.pickups);
  }

  spawn(kind, x) {
    return (kind === 'scrap' ? this.scrap : this.health).spawn({ x });
  }

  get active() {
    return [...this.health.active, ...this.scrap.active];
  }

  step(scrollDx, dt) {
    this.health.updateAll((p) => p.step(scrollDx, dt));
    this.scrap.updateAll((p) => p.step(scrollDx, dt));
  }

  despawn(p) {
    (p.kind === 'scrap' ? this.scrap : this.health).despawn(p);
  }

  reset() {
    this.health.despawnAll();
    this.scrap.despawnAll();
  }
}
