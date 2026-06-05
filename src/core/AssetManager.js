/**
 * AssetManager — load once, clone many (TDD §4.2).
 *
 *  - One GLTFLoader, results cached by name.
 *  - Animated characters cloned via SkeletonUtils (Object3D.clone breaks skinning).
 *  - Static props share geometry/material (shallow clone) to keep draw calls low.
 *  - Models are normalized to a target height + faced the right way ONCE at load.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { gltfUrl } from '../config/assets.js';

export class AssetManager {
  constructor() {
    this.loader = new GLTFLoader();
    /** @type {Map<string, import('three/addons/loaders/GLTFLoader.js').GLTF>} */
    this.cache = new Map();
  }

  /** Load a single glTF by manifest name (cached). */
  async load(name) {
    if (this.cache.has(name)) return this.cache.get(name);
    const url = gltfUrl(name);
    const gltf = await this.loader.loadAsync(url);
    this.cache.set(name, gltf);
    return gltf;
  }

  /**
   * Preload a list of names, reporting progress 0..1.
   * @param {string[]} names
   * @param {(loaded:number, total:number) => void} [onProgress]
   */
  async preload(names, onProgress) {
    let loaded = 0;
    const total = names.length;
    await Promise.all(
      names.map(async (name) => {
        await this.load(name);
        loaded++;
        onProgress?.(loaded, total);
      }),
    );
  }

  /**
   * Get an animated character clone.
   * @returns {{ root: THREE.Object3D, mixer: THREE.AnimationMixer, animations: THREE.AnimationClip[] }}
   */
  getCharacter(name, { targetHeight = 2.0, face = 'right' } = {}) {
    const gltf = this.cache.get(name);
    if (!gltf) throw new Error(`Character not preloaded: ${name}`);
    const root = skeletonClone(gltf.scene);
    normalizeModel(root, targetHeight, face);
    const mixer = new THREE.AnimationMixer(root);
    return { root, mixer, animations: gltf.animations };
  }

  /**
   * Get a static prop clone (geometry/material shared with the prototype).
   * @returns {THREE.Object3D}
   */
  getProp(name, { targetHeight = null, fit = 'height', face = 'none', recenterY = true } = {}) {
    const gltf = this.cache.get(name);
    if (!gltf) throw new Error(`Prop not preloaded: ${name}`);
    const root = gltf.scene.clone(true); // shallow: shares geometry + material
    if (targetHeight != null) normalizeModel(root, targetHeight, face, recenterY, fit);
    return root;
  }

  /** Toggle a named child mesh's visibility (used for embedded weapon swap). */
  static setChildVisible(root, childName, visible) {
    const child = root.getObjectByName(childName);
    if (child) child.visible = visible;
    return child;
  }
}

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();

/**
 * Normalize a model to a target world size, recenter on X/Z (and bottom on Y so
 * it sits on the ground), and face +X ('right') or -X ('left').
 *
 * `fit` controls what `target` measures:
 *   - 'height' (default): scale so the model is `target` units TALL. Correct for
 *     characters and gameplay obstacles (a 2u wall must be 2u tall).
 *   - 'max': scale so the LARGEST bounding dimension is `target`. Required for
 *     flat/wide scenery (cars, fences, debris) — height-fit would explode their
 *     width and tear multi-part meshes apart.
 * (Pattern: normalizeModel from skill game-patterns.)
 */
export function normalizeModel(model, target, faceDirection = 'right', recenterY = true, fit = 'height') {
  // Measure pre-scale.
  _box.setFromObject(model);
  _box.getSize(_size);
  const denom = fit === 'max' ? Math.max(_size.x, _size.y, _size.z) || 1 : _size.y || 1;
  const scale = target / denom;
  model.scale.setScalar(scale);

  // Re-measure after scaling to recenter.
  _box.setFromObject(model);
  _box.getSize(_size);
  _box.getCenter(_center);
  model.position.x -= _center.x;
  model.position.z -= _center.z;
  if (recenterY) {
    // Place the model's feet at Y=0.
    model.position.y -= _box.min.y;
  }

  if (faceDirection === 'right') model.rotation.y = Math.PI / 2;
  else if (faceDirection === 'left') model.rotation.y = -Math.PI / 2;

  return model;
}

/** Measured world-space size of an object (helper for hitbox sizing). */
export function measureSize(object, out = new THREE.Vector3()) {
  _box.setFromObject(object);
  return _box.getSize(out);
}
