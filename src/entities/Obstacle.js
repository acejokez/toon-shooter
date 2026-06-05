/**
 * Obstacle — single class parameterized by `type` (TDD §5.5). The behavior
 * table below is read by the CollisionSystem; the entity just carries geometry,
 * an AABB, and flags. AABB is a center-box in world space.
 */
import * as THREE from 'three';
import { CONFIG } from '../config/constants.js';
import { AssetManager } from '../core/AssetManager.js';

/**
 * type -> spawn + collision description.
 *  asset:      glTF name (fallback box if missing)
 *  height:     normalized world height
 *  aabb:       { yCenter, w, h } collision box relative to ground
 *  solid:      blocks passage (wall/barrier)
 *  overhead:   sits in the upper band — crouch under it
 *  damage:     HP lost on contact (0 = none)
 *  breakStreak:contact resets kill streak
 *  detonable:  a player projectile triggers an AoE
 *  aoe:        explodes (mine/barrel) dealing splash on detonation
 */
export const OBSTACLE_TYPES = {
  wall: {
    asset: 'SackTrench', height: CONFIG.HEIGHTS.wall,
    aabb: { yCenter: 1.0, w: 1.2, h: 2.0 },
    solid: true, standable: true, damage: CONFIG.WALL_DAMAGE,
  },
  barrier: {
    asset: 'Barrier_Large', height: CONFIG.HEIGHTS.wall,
    aabb: { yCenter: 1.0, w: 1.6, h: 2.0 },
    solid: true, standable: true, damage: CONFIG.WALL_DAMAGE,
  },
  crate: {
    asset: 'Crate', height: CONFIG.HEIGHTS.crate,
    aabb: { yCenter: 0.55, w: 1.0, h: 1.1 },
    solid: true, standable: true, damage: CONFIG.WALL_DAMAGE,
  },
  overhead: {
    asset: 'Pipes', height: 1.4, elevate: 1.8,
    aabb: { yCenter: 2.5, w: 2.0, h: 1.2 },
    overhead: true, damage: CONFIG.WALL_DAMAGE,
  },
  trap: {
    asset: 'BearTrap_Open', height: CONFIG.HEIGHTS.trap,
    aabb: { yCenter: 0.3, w: 1.0, h: 0.6 },
    damage: CONFIG.TRAP_DAMAGE, breakStreak: true,
  },
  mine: {
    asset: 'Landmine', height: CONFIG.HEIGHTS.mine,
    aabb: { yCenter: 0.3, w: 0.8, h: 0.6 },
    damage: CONFIG.MINE_DAMAGE, detonable: true, aoe: true,
  },
  barrel: {
    asset: 'ExplodingBarrel', height: 1.5,
    aabb: { yCenter: 0.75, w: 0.9, h: 1.5 },
    damage: CONFIG.MINE_DAMAGE, detonable: true, aoe: true, solid: false,
  },
};

export class Obstacle {
  /**
   * @param {THREE.Scene} scene
   * @param {AssetManager} assets
   * @param {string} type key into OBSTACLE_TYPES
   */
  constructor(scene, assets, type) {
    this.type = type;
    this.data = OBSTACLE_TYPES[type];
    this.group = new THREE.Group();
    this.root = this.group;

    let mesh;
    try {
      mesh = assets.getProp(this.data.asset, { targetHeight: this.data.height, recenterY: true });
    } catch {
      mesh = fallbackBox(this.data.height);
    }
    if (this.data.elevate) mesh.position.y += this.data.elevate;
    this.group.add(mesh);
    scene.add(this.group);

    // Measure actual model width so the hitbox matches the visual extents.
    // (Some assets have extreme aspect ratios after height-based scaling.)
    const _b = new THREE.Box3().setFromObject(this.group);
    const measuredW = _b.max.x - _b.min.x;
    this._aabbW = measuredW > 0.01 ? measuredW : this.data.aabb.w;

    this.active = false;
    this.alive = false;
  }

  reset({ x }) {
    this.group.position.set(x, 0, 0);
    this.alive = true;
    this.detonated = false;
    this.group.visible = true;
  }

  step(scrollDx) {
    this.group.position.x -= scrollDx;
    return this.group.position.x < CONFIG.DESPAWN_X;
  }

  getHitbox() {
    const a = this.data.aabb;
    return { x: this.group.position.x, y: a.yCenter, w: this._aabbW, h: a.h };
  }

  /** Top surface Y for "jump onto" semantics (solid obstacles). */
  get topY() {
    const a = this.data.aabb;
    return a.yCenter + a.h / 2;
  }
}

function fallbackBox(h) {
  const geo = new THREE.BoxGeometry(1, h, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0x884422, flatShading: true });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = h / 2;
  return m;
}
