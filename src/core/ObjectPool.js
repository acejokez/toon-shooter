/**
 * Generic object pool (TDD §10 GC mitigation; skill game-patterns).
 * No `new` in the game loop — spawn()/despawn() recycle instances.
 *
 * Entities are expected to expose `reset(...)` (called on spawn) and optionally
 * `active` / a mesh with `.visible`. The pool only tracks lifecycle; behavior
 * lives in the entity.
 */
export class ObjectPool {
  /**
   * @param {() => any} createFn factory for a fresh, inactive entity
   * @param {number} initialSize pre-populated count
   */
  constructor(createFn, initialSize = 10) {
    this.createFn = createFn;
    /** @type {any[]} */
    this.free = [];
    /** @type {any[]} */
    this.active = [];
    for (let i = 0; i < initialSize; i++) {
      this.free.push(this._makeHidden());
    }
  }

  /** Create an entity in the inactive/hidden state (pre-populated pool items
   *  must not render at the origin until spawned). */
  _makeHidden() {
    const obj = this.createFn();
    obj.active = false;
    if (obj.root) obj.root.visible = false;
    return obj;
  }

  /** Acquire an entity and initialize it via its reset(...) args. */
  spawn(...args) {
    const obj = this.free.pop() ?? this.createFn();
    obj.reset?.(...args);
    obj.active = true;
    if (obj.root) obj.root.visible = true;
    this.active.push(obj);
    return obj;
  }

  /** Return an entity to the pool. */
  despawn(obj) {
    const idx = this.active.indexOf(obj);
    if (idx === -1) return;
    this.active.splice(idx, 1);
    obj.active = false;
    obj.onDespawn?.();
    if (obj.root) obj.root.visible = false;
    this.free.push(obj);
  }

  /**
   * Update every active entity. The callback returns true to despawn.
   * Iterates backwards for safe in-loop removal.
   */
  updateAll(callback) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const obj = this.active[i];
      if (callback(obj)) this.despawn(obj);
    }
  }

  despawnAll() {
    for (let i = this.active.length - 1; i >= 0; i--) {
      this.despawn(this.active[i]);
    }
  }
}
