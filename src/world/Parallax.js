/**
 * Parallax — randomized, non-colliding background depth layers (TDD §3.3, §12).
 * Three depth bands scroll at fractions of the base speed; each slot picks a
 * random prop from its band's pool, with jittered scale/Z/Y, and re-randomizes
 * on wrap so the skyline never looks uniform.
 */
import * as THREE from 'three';
import { CONFIG } from '../config/constants.js';
import { pick } from '../util/math.js';

const WRAP_LEFT = CONFIG.DESPAWN_X - 4;
const WRAP_RIGHT = CONFIG.SPAWN_X + 8;
const SPAN = WRAP_RIGHT - WRAP_LEFT;

// speed: scroll fraction · z: depth · size: target MAX dimension · spacing
// `size` fits the largest bounding dimension (fit:'max') so flat/wide props
// (cars, fences, debris) stay sane instead of exploding when height-normalized.
// Depth dimming is handled by scene fog (no per-instance material clones), which
// keeps GPU memory flat as props recycle on wrap.
const BANDS = {
  far: { speed: 0.18, z: -12, size: 9, gap: [2, 5] },
  mid: { speed: 0.42, z: -7, size: 5, gap: [2, 5] },
  // Near band sits clearly BEHIND the gameplay plane (z=0) and small, so it
  // reads as background clutter — never mistaken for a landable obstacle.
  near: { speed: 0.62, z: -5, size: 3, gap: [3, 6] },
};

export class Parallax {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../core/AssetManager.js').AssetManager} assets
   * @param {{far:string[], mid:string[], near:string[]}} pools
   */
  constructor(scene, assets, pools) {
    this.assets = assets;
    this.pools = pools;
    this.group = new THREE.Group();
    this.items = [];

    for (const band of Object.keys(BANDS)) this._fillBand(band);
    scene.add(this.group);
  }

  _fillBand(band) {
    const cfg = BANDS[band];
    let x = WRAP_LEFT + Math.random() * 4;
    while (x < WRAP_RIGHT) {
      const holder = new THREE.Group();
      this.group.add(holder);
      const item = { holder, band, speed: cfg.speed };
      this._dress(item, x);
      this.items.push(item);
      x += cfg.gap[0] + Math.random() * (cfg.gap[1] - cfg.gap[0]);
    }
  }

  /** Place a freshly-randomized prop into an item's holder at world X. */
  _dress(item, x) {
    const cfg = BANDS[item.band];
    item.holder.clear();
    const name = pick(this.pools[item.band] ?? this.pools.mid);
    const s = cfg.size * (0.8 + Math.random() * 0.4);

    let mesh;
    try {
      // fit:'max' keeps flat/wide props from exploding; shares cached geo/mats.
      mesh = this.assets.getProp(name, { targetHeight: s, fit: 'max', recenterY: true });
    } catch {
      mesh = fallback(s);
    }
    if (Math.random() < 0.5) mesh.rotation.y += Math.PI; // mirror for variety

    item.holder.add(mesh);
    item.holder.position.set(x, 0, cfg.z);
  }

  /** @param {number} baseDx world units the foreground moved this step */
  update(baseDx) {
    for (const item of this.items) {
      item.holder.position.x -= baseDx * item.speed;
      if (item.holder.position.x < WRAP_LEFT) {
        // Wrap to the right edge and re-randomize the prop.
        this._dress(item, item.holder.position.x + SPAN);
      }
    }
  }
}

function fallback(h) {
  const geo = new THREE.ConeGeometry(0.8, h, 6);
  const mat = new THREE.MeshStandardMaterial({ color: 0x2c3a26, flatShading: true });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = h / 2;
  const g = new THREE.Group();
  g.add(m);
  return g;
}
