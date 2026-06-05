import { describe, it, expect } from 'vitest';
import { CONFIG } from '../../src/config/constants.js';
import { resolveWeapon, upgradeCost } from '../../src/config/weapons.js';
import { difficultyForDistance } from '../../src/config/spawnPatterns.js';
import { migrate, defaultSave } from '../../src/core/SaveManager.js';
import { makeRng } from '../../src/util/math.js';

describe('weapons: resolveWeapon applies upgrade levels to a copy', () => {
  it('returns base stats with no upgrades', () => {
    const w = resolveWeapon('Pistol', {});
    expect(w.damage).toBe(1);
    expect(w.name).toBe('Pistol');
  });
  it('adds per-level deltas without mutating the base table', () => {
    const rec = { Pistol: { damageLvl: 2, fireRateLvl: 1 } };
    const w = resolveWeapon('Pistol', rec);
    expect(w.damage).toBe(1 + 2 * 1);
    expect(w.fireRate).toBeCloseTo(4 + 1 * 0.15);
    // base unchanged
    expect(resolveWeapon('Pistol', {}).damage).toBe(1);
  });
  it('upgrade cost grows with level', () => {
    expect(upgradeCost('damage', 1)).toBeGreaterThan(upgradeCost('damage', 0));
  });
});

describe('difficulty curve ramps with distance', () => {
  it('is monotonic non-decreasing', () => {
    const samples = [0, 100, 200, 500, 900].map(difficultyForDistance);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }
    expect(difficultyForDistance(0)).toBe(0);
    expect(difficultyForDistance(1000)).toBe(3);
  });
});

describe('SaveManager migrate is forward-compatible', () => {
  it('fills defaults for partial blobs', () => {
    const m = migrate({ currency: 50 });
    expect(m.currency).toBe(50);
    expect(m.version).toBe(1);
    expect(m.upgrades.Pistol).toEqual({ damageLvl: 0, fireRateLvl: 0 });
    expect(Array.isArray(m.loadout)).toBe(true);
  });
  it('returns defaults for garbage', () => {
    expect(migrate(null)).toEqual(defaultSave());
  });
});

describe('seeded RNG is deterministic', () => {
  it('same seed -> same sequence', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    for (let i = 0; i < 5; i++) expect(a()).toBe(b());
  });
  it('different seeds diverge', () => {
    expect(makeRng(1)()).not.toBe(makeRng(2)());
  });
});

describe('jump arc clears a 2u wall (tuning contract, TDD §13)', () => {
  it('peak height exceeds wall height with the configured gravity/velocity', () => {
    // Replicates Player gravity integration over fixed steps.
    let y = 0;
    let vy = CONFIG.JUMP_VELOCITY;
    let peak = 0;
    const h = CONFIG.FIXED_STEP;
    for (let i = 0; i < 1000 && (vy > 0 || y > 0); i++) {
      vy -= CONFIG.GRAVITY * h;
      y += vy * h;
      peak = Math.max(peak, y);
    }
    expect(peak).toBeGreaterThan(CONFIG.HEIGHTS.wall);
  });
});
