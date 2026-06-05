/**
 * AnimController — crossfading animation state machine for a single character
 * (skill game-patterns "Animation State Management"). Wraps an AnimationMixer
 * and a clip set; switch() handles fade-out/fade-in and one-shot clamping.
 */
import * as THREE from 'three';

export class AnimController {
  /**
   * @param {THREE.AnimationMixer} mixer
   * @param {THREE.AnimationClip[]} clips
   */
  constructor(mixer, clips) {
    this.mixer = mixer;
    this.clips = clips;
    this.current = null;
    this.currentName = null;
  }

  /** Partial, case-insensitive clip lookup (TDD §10 — names may vary). */
  find(name) {
    const n = name.toLowerCase();
    // Prefer exact match, then partial.
    return (
      this.clips.find((c) => c.name.toLowerCase() === n) ||
      this.clips.find((c) => c.name.toLowerCase().includes(n))
    );
  }

  /**
   * Crossfade to a clip.
   * @param {string} name
   * @param {{fade?:number, loop?:boolean, timeScale?:number, onFinished?:Function}} [opts]
   */
  switch(name, opts = {}) {
    if (name === this.currentName && opts.force !== true) return this.current;
    const clip = this.find(name);
    if (!clip) return null;

    const { fade = 0.15, loop = true, timeScale = 1 } = opts;
    const action = this.mixer.clipAction(clip);
    action.reset();
    action.enabled = true;
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    action.timeScale = timeScale;

    if (this.current && this.current !== action) {
      this.current.crossFadeTo(action, fade, false);
    }
    action.fadeIn(fade).play();

    this.current = action;
    this.currentName = name;

    if (opts.onFinished) {
      const handler = (e) => {
        if (e.action === action) {
          this.mixer.removeEventListener('finished', handler);
          opts.onFinished();
        }
      };
      this.mixer.addEventListener('finished', handler);
    }
    return action;
  }

  update(dt) {
    this.mixer.update(dt);
  }
}
