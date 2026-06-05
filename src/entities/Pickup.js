/**
 * Pickup — pooled `Health` (+HP) and `Scrap` (currency) (TDD §5.6).
 * Scrap has no dedicated mesh, so it's a procedural emissive coin (TDD §12).
 * Bobs/rotates for readability.
 */
import * as THREE from 'three';
import { CONFIG } from '../config/constants.js';

export class Pickup {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../core/AssetManager.js').AssetManager} assets
   * @param {'health'|'scrap'} kind
   */
  constructor(scene, assets, kind) {
    this.kind = kind;
    this.group = new THREE.Group();
    this.root = this.group;

    let mesh;
    if (kind === 'health') {
      try {
        mesh = assets.getProp('Health', { targetHeight: CONFIG.HEIGHTS.pickup, recenterY: true });
      } catch {
        mesh = healthFallback();
      }
    } else {
      mesh = scrapCoin();
    }
    this.mesh = mesh;
    this.group.add(mesh);
    scene.add(this.group);

    this.active = false;
    this._t = 0;
    this.baseY = 0.8;
  }

  reset({ x }) {
    this.group.position.set(x, this.baseY, 0);
    this._t = Math.random() * Math.PI * 2;
  }

  step(scrollDx, dt) {
    this.group.position.x -= scrollDx;
    this._t += dt * 3;
    this.group.position.y = this.baseY + Math.sin(this._t) * 0.18;
    this.mesh.rotation.y += dt * 2.5;
    return this.group.position.x < CONFIG.DESPAWN_X;
  }

  getHitbox() {
    const p = this.group.position;
    return { x: p.x, y: p.y, w: 0.8, h: 0.8 };
  }
}

function healthFallback() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0x550011 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.18), mat);
  const bar2 = bar.clone();
  bar2.rotation.z = Math.PI / 2;
  g.add(bar, bar2);
  return g;
}

function scrapCoin() {
  const geo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 12);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffcc33, emissive: 0x664400, metalness: 0.7, roughness: 0.3,
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = Math.PI / 2;
  return m;
}
