/**
 * Stage — scene, camera, lights, renderer, resize (TDD §3.3, §3.4).
 * Locked side-view perspective camera; canvas sizes to its grid CELL, not the
 * window, so the right dashboard panel keeps its width.
 */
import * as THREE from 'three';
import { CONFIG } from '../config/constants.js';

export class Stage {
  /** @param {HTMLElement} container the #canvas-container grid cell */
  constructor(container) {
    this.container = container;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a1a0c); // dusty wasteland dusk

    // Depth fog for the toon look + background recession (parallax fades into it).
    this.scene.fog = new THREE.Fog(0x2a1a0c, 16, 42);

    const { clientWidth: w, clientHeight: h } = container;
    this.camera = new THREE.PerspectiveCamera(45, (w || 16) / (h || 9), 0.1, 100);
    this.cameraBase = new THREE.Vector3(CONFIG.PLAYER_X + 2, 3, 14);
    this.camera.position.copy(this.cameraBase);
    this.camera.lookAt(CONFIG.PLAYER_X + 2, 1.5, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w || 960, h || 540, false);
    container.appendChild(this.renderer.domElement);

    // Resilience: allow the browser to restore a lost WebGL context instead of
    // staying black (weak GPUs / headless / tab backgrounding).
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('WebGL context lost — awaiting restore');
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      console.warn('WebGL context restored');
    });

    this._setupLights();
    this._setupBackWall();

    // Camera shake state (skill game-patterns).
    this._shakeIntensity = 0;
    this._shakeDuration = 0;

    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(container);
  }

  _setupBackWall() {
    // Continuous industrial wall behind the far parallax band (z=-12).
    // Fills the empty background "sky" with a wasteland building facade.
    const wallGeo = new THREE.BoxGeometry(120, 10, 0.6);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a2514, roughness: 0.97, metalness: 0.05 });
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(4, 5, -13.5);
    this.scene.add(backWall);

    // Darker trim strip at the base of the wall for ground contrast.
    const trimGeo = new THREE.BoxGeometry(120, 0.5, 0.6);
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e1208, roughness: 0.98 });
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.set(4, 0.25, -13.4);
    this.scene.add(trim);
  }

  _setupLights() {
    this.scene.add(new THREE.AmbientLight(0xb89060, 0.55)); // warm dusty ambient

    const key = new THREE.DirectionalLight(0xffcc66, 1.2); // harsh low sun
    key.position.set(6, 12, 8);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x3a2810, 0.35); // dark warm shadow
    fill.position.set(-6, 4, -4);
    this.scene.add(fill);
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  shake(intensity, duration) {
    this._shakeIntensity = Math.max(this._shakeIntensity, intensity);
    this._shakeDuration = Math.max(this._shakeDuration, duration);
  }

  /** Apply decaying camera shake; call each render frame with real dt. */
  updateShake(dt) {
    if (this._shakeDuration > 0) {
      this._shakeDuration -= dt;
      const decay = Math.max(0, this._shakeDuration) / 0.3;
      const o = this._shakeIntensity * decay;
      this.camera.position.x = this.cameraBase.x + (Math.random() - 0.5) * o;
      this.camera.position.y = this.cameraBase.y + (Math.random() - 0.5) * o;
    } else {
      this.camera.position.x = this.cameraBase.x;
      this.camera.position.y = this.cameraBase.y;
      this._shakeIntensity = 0;
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this._ro.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
