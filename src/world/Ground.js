/**
 * Ground — a scrolling strip of tiles giving the treadmill its motion read
 * (TDD §3.1). The world's gameplay entities scroll left; the ground tiles
 * scroll with them and wrap so the floor appears endless.
 */
import * as THREE from 'three';
import { CONFIG } from '../config/constants.js';

const TILE = 8; // world units per tile
const TILES = 6; // enough to span the visible band + buffer
const SPAN = TILE * TILES;

export class Ground {
  constructor(scene) {
    this.group = new THREE.Group();
    this.tiles = [];

    const geo = new THREE.BoxGeometry(TILE, 0.5, 28);
    const matA = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.98 }); // cracked dirt
    const matB = new THREE.MeshStandardMaterial({ color: 0x3e2c18, roughness: 0.98 }); // darker dirt

    const startX = CONFIG.DESPAWN_X;
    for (let i = 0; i < TILES; i++) {
      const tile = new THREE.Mesh(geo, i % 2 ? matA : matB);
      tile.position.set(startX + i * TILE, -0.25, 0);
      this.group.add(tile);
      this.tiles.push(tile);
    }

    // A faint dust track for motion readability.
    const lineGeo = new THREE.BoxGeometry(SPAN, 0.02, 0.3);
    const lineMat = new THREE.MeshStandardMaterial({ color: 0x6a5038, emissive: 0x1a0e06 });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.position.set(startX + SPAN / 2, 0.02, 2);
    this.group.add(line);

    scene.add(this.group);
  }

  /** Scroll tiles left; wrap any tile that passes the despawn edge. */
  update(dx) {
    for (const tile of this.tiles) {
      tile.position.x -= dx;
      if (tile.position.x < CONFIG.DESPAWN_X - TILE / 2) {
        tile.position.x += SPAN;
      }
    }
  }
}
