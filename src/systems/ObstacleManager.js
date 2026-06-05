/**
 * ObstacleManager — one pool per obstacle type (each type is bound to its prop
 * mesh at construction, so per-type pools keep cloning out of the loop).
 */
import { ObjectPool } from '../core/ObjectPool.js';
import { Obstacle, OBSTACLE_TYPES } from '../entities/Obstacle.js';

export class ObstacleManager {
  constructor(scene, assets) {
    /** @type {Record<string, ObjectPool>} */
    this.pools = {};
    for (const type of Object.keys(OBSTACLE_TYPES)) {
      this.pools[type] = new ObjectPool(() => new Obstacle(scene, assets, type), 4);
    }
  }

  spawn(type, x) {
    const pool = this.pools[type];
    if (!pool) throw new Error(`Unknown obstacle type: ${type}`);
    return pool.spawn({ x });
  }

  get active() {
    return Object.values(this.pools).flatMap((p) => p.active);
  }

  step(scrollDx) {
    for (const pool of Object.values(this.pools)) {
      pool.updateAll((o) => o.step(scrollDx));
    }
  }

  despawn(o) {
    this.pools[o.type]?.despawn(o);
  }

  reset() {
    for (const pool of Object.values(this.pools)) pool.despawnAll();
  }
}
