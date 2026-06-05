/**
 * EnemyManager — two pools (ground + sniper) since each kind is bound to a
 * different character model at construction (TDD §5.2/§5.3).
 */
import { ObjectPool } from '../core/ObjectPool.js';
import { Enemy } from '../entities/Enemy.js';
import { CONFIG } from '../config/constants.js';

export class EnemyManager {
  constructor(scene, assets) {
    this.ground = new ObjectPool(() => new Enemy(scene, assets, 'ground'), CONFIG.POOL.enemies);
    this.sniper = new ObjectPool(() => new Enemy(scene, assets, 'sniper'), 4);
  }

  spawn(kind, x) {
    const pool = kind === 'sniper' ? this.sniper : this.ground;
    return pool.spawn({ x });
  }

  get active() {
    return [...this.ground.active, ...this.sniper.active];
  }

  /** @param {(spec:object)=>void} fire enemy-bullet spawn callback */
  step(h, scrollDx, player, fire) {
    this.ground.updateAll((e) => e.step(h, scrollDx, player, fire));
    this.sniper.updateAll((e) => e.step(h, scrollDx, player, fire));
  }

  update(dt) {
    for (const e of this.ground.active) e.update(dt);
    for (const e of this.sniper.active) e.update(dt);
  }

  despawn(e) {
    (e.kind === 'sniper' ? this.sniper : this.ground).despawn(e);
  }

  reset() {
    this.ground.despawnAll();
    this.sniper.despawnAll();
  }
}
