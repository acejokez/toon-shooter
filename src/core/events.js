/**
 * Tiny synchronous EventBus (pub/sub). Collision/score/UI talk through this so
 * the collision code stays pure and unit-testable (TDD §6.2).
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  on(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    this._listeners.get(type)?.delete(fn);
  }

  emit(type, payload) {
    const set = this._listeners.get(type);
    if (!set) return;
    // Copy to allow handlers to (un)subscribe during dispatch.
    for (const fn of [...set]) fn(payload);
  }

  clear() {
    this._listeners.clear();
  }
}

/** Canonical event names (avoid stringly-typed typos). */
export const Events = {
  PLAYER_HIT: 'player:hit',
  PLAYER_DEAD: 'player:dead',
  ENEMY_KILLED: 'enemy:killed',
  PICKUP_HEALTH: 'pickup:health',
  PICKUP_SCRAP: 'pickup:scrap',
  MINE_DETONATE: 'mine:detonate',
  WEAPON_SWAP: 'weapon:swap',
  SHOT_FIRED: 'shot:fired',
  STREAK_BREAK: 'streak:break',
  STATE_CHANGE: 'state:change',
};
