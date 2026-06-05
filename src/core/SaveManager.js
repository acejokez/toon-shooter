/**
 * SaveManager — meta-progression persistence in localStorage (TDD §8.3).
 * Versioned, try/catch-wrapped with an in-memory fallback for private mode/quota.
 */
import { DEFAULT_LOADOUT } from '../config/weapons.js';

const KEY = 'toon-shooter-save';
const VERSION = 1;

function defaultSave() {
  return {
    version: VERSION,
    currency: 0,
    upgrades: {
      Pistol: { damageLvl: 0, fireRateLvl: 0 },
      Shotgun: { damageLvl: 0, fireRateLvl: 0 },
      SMG: { damageLvl: 0, fireRateLvl: 0 },
    },
    perks: {},
    loadout: [...DEFAULT_LOADOUT],
    best: { distance: 0, streak: 0 },
  };
}

export class SaveManager {
  constructor() {
    this.data = defaultSave();
    this._canPersist = true;
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = migrate(parsed);
      }
    } catch (err) {
      console.warn('SaveManager: load failed, using defaults', err);
      this._canPersist = false;
    }
    return this.data;
  }

  save() {
    if (!this._canPersist) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (err) {
      console.warn('SaveManager: save failed (quota/private mode)', err);
      this._canPersist = false;
    }
  }

  addCurrency(amount) {
    this.data.currency += amount;
    this.save();
  }

  spendCurrency(amount) {
    if (this.data.currency < amount) return false;
    this.data.currency -= amount;
    this.save();
    return true;
  }

  /** Record run results; updates bests. */
  commitRun({ distance, streak, scrap }) {
    this.data.currency += scrap;
    this.data.best.distance = Math.max(this.data.best.distance, Math.floor(distance));
    this.data.best.streak = Math.max(this.data.best.streak, streak);
    this.save();
  }

  reset() {
    this.data = defaultSave();
    this.save();
  }
}

/** Forward-compatible migration (TDD §8.3). */
function migrate(parsed) {
  const base = defaultSave();
  if (!parsed || typeof parsed !== 'object') return base;
  // Shallow-merge known fields; deeper schemas would branch on parsed.version.
  return {
    ...base,
    ...parsed,
    version: VERSION,
    upgrades: { ...base.upgrades, ...(parsed.upgrades || {}) },
    perks: { ...base.perks, ...(parsed.perks || {}) },
    best: { ...base.best, ...(parsed.best || {}) },
    loadout: Array.isArray(parsed.loadout) ? parsed.loadout : base.loadout,
  };
}

export { defaultSave, migrate };
