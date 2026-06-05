/**
 * Hand-authored spawn chunks (TDD §6.1). Each chunk is a sequence of slots
 * spaced along +X; the SpawnDirector lays them down and they scroll left.
 * Every chunk is guaranteed *fair*: a valid jump/crouch/shoot solution exists.
 *
 * Slot kinds:
 *   { gap }                          -> empty spacing in world units
 *   { obstacle: 'wall'|'trap'|'mine'|'barrel'|'overhead' }
 *   { enemy: 'ground'|'sniper' }
 *   { pickup: 'health' }
 * Difficulty tiers gate which chunks are eligible (0 = easiest).
 */
export const CHUNKS = [
  // --- Tier 0: teaching / breathers ---
  {
    id: 'wall_basic',
    minDifficulty: 0,
    slots: [{ gap: 4 }, { obstacle: 'wall' }, { gap: 6 }],
  },
  {
    id: 'trap_single',
    minDifficulty: 0,
    slots: [{ gap: 4 }, { obstacle: 'trap' }, { gap: 6 }],
  },
  {
    id: 'lone_enemy',
    minDifficulty: 0,
    slots: [{ gap: 5 }, { enemy: 'ground' }, { gap: 6 }],
  },
  {
    id: 'health_break',
    minDifficulty: 0,
    slots: [{ gap: 4 }, { pickup: 'health' }, { gap: 5 }],
  },
  {
    id: 'crate_hop',
    minDifficulty: 0,
    slots: [{ gap: 4 }, { obstacle: 'crate' }, { gap: 6 }],
  },
  {
    id: 'crate_scrap',
    minDifficulty: 0,
    slots: [{ gap: 4 }, { obstacle: 'crate' }, { gap: 0.2 }, { pickup: 'health' }, { gap: 6 }],
  },

  // --- Tier 1: combinations ---
  {
    id: 'trap_then_wall',
    minDifficulty: 1,
    slots: [{ gap: 4 }, { obstacle: 'trap' }, { gap: 3.5 }, { obstacle: 'wall' }, { gap: 6 }],
  },
  {
    id: 'enemy_plus_health',
    minDifficulty: 1,
    slots: [{ gap: 5 }, { enemy: 'ground' }, { gap: 2 }, { pickup: 'health' }, { gap: 6 }],
  },
  {
    id: 'overhead_crouch',
    minDifficulty: 1,
    slots: [{ gap: 5 }, { obstacle: 'overhead' }, { gap: 6 }],
  },
  {
    id: 'mine_field',
    minDifficulty: 1,
    slots: [{ gap: 4 }, { obstacle: 'mine' }, { gap: 3 }, { obstacle: 'mine' }, { gap: 6 }],
  },

  // --- Tier 2: pressure ---
  {
    id: 'barrel_enemy',
    minDifficulty: 2,
    slots: [{ gap: 4 }, { obstacle: 'barrel' }, { gap: 1.5 }, { enemy: 'ground' }, { gap: 6 }],
  },
  {
    id: 'sniper_perch',
    minDifficulty: 2,
    slots: [{ gap: 5 }, { enemy: 'sniper' }, { gap: 3 }, { obstacle: 'trap' }, { gap: 6 }],
  },
  {
    id: 'gauntlet',
    minDifficulty: 2,
    slots: [
      { gap: 4 },
      { obstacle: 'wall' },
      { gap: 3.5 },
      { obstacle: 'trap' },
      { gap: 3 },
      { enemy: 'ground' },
      { gap: 7 },
    ],
  },
  {
    id: 'crate_stairs',
    minDifficulty: 2,
    slots: [
      { gap: 4 },
      { obstacle: 'crate' },
      { gap: 1.4 },
      { obstacle: 'crate' },
      { gap: 2 },
      { obstacle: 'trap' },
      { gap: 6 },
    ],
  },

  // --- Tier 3: chaos ---
  {
    id: 'double_enemy_overhead',
    minDifficulty: 3,
    slots: [
      { gap: 4 },
      { enemy: 'ground' },
      { gap: 3 },
      { obstacle: 'overhead' },
      { gap: 3 },
      { enemy: 'sniper' },
      { gap: 7 },
    ],
  },
  {
    id: 'mine_barrel_combo',
    minDifficulty: 3,
    slots: [
      { gap: 4 },
      { obstacle: 'mine' },
      { gap: 2.5 },
      { obstacle: 'barrel' },
      { gap: 3 },
      { obstacle: 'wall' },
      { gap: 7 },
    ],
  },
];

/** Difficulty band thresholds keyed by distance in meters. */
export function difficultyForDistance(meters) {
  if (meters < 150) return 0;
  if (meters < 400) return 1;
  if (meters < 800) return 2;
  return 3;
}
