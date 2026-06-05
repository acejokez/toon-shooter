/**
 * SpawnDirector — controlled randomness via hand-authored chunks (TDD §6.1).
 * Lays chunks down at SPAWN_X as a "ruler" advances with the scrolled distance;
 * difficulty ramps with distance, gating which chunks are eligible and biasing
 * toward later, harder ones. All spawns go through pools.
 */
import { CONFIG } from '../config/constants.js';
import { CHUNKS, difficultyForDistance } from '../config/spawnPatterns.js';
import { makeRng, pick } from '../util/math.js';

export class SpawnDirector {
  /**
   * @param {object} managers { obstacles, enemies, pickups }
   * @param {number} seed deterministic RNG seed (TDD §11)
   */
  constructor({ obstacles, enemies, pickups }, seed = 1) {
    this.obstacles = obstacles;
    this.enemies = enemies;
    this.pickups = pickups;
    this.rng = makeRng(seed);
    this.reset();
  }

  reset(seed) {
    if (seed != null) this.rng = makeRng(seed);
    // Cursor: world X where the next slot will be placed (off-screen right).
    this._cursorX = CONFIG.SPAWN_X;
    this._scrolled = 0;
  }

  /**
   * @param {number} scrollDx world units scrolled this step
   * @param {number} meters distance travelled (for difficulty)
   */
  update(scrollDx, meters) {
    // The cursor rides the world leftward; when it passes SPAWN_X we lay the
    // next chunk so content keeps appearing just off the right edge.
    this._cursorX -= scrollDx;
    while (this._cursorX <= CONFIG.SPAWN_X) {
      this._cursorX += this._layChunk(meters, this._cursorX);
    }
  }

  /** Place a chunk starting at worldX; return its total length in world units. */
  _layChunk(meters, startX) {
    const difficulty = difficultyForDistance(meters);
    const eligible = CHUNKS.filter((c) => c.minDifficulty <= difficulty);
    // Bias toward harder chunks as difficulty rises.
    const chunk = pick(eligible, this.rng);

    // Random breathing room before every chunk so back-to-back placement
    // never piles obstacles on top of each other.
    const preGap = 4 + this.rng() * 8; // 4–12 units
    let x = startX + preGap;

    for (const slot of chunk.slots) {
      if (slot.gap != null) {
        // Jitter each gap ±30% so the exact same chunk never looks identical.
        const jitter = 1 + (this.rng() - 0.5) * 0.6;
        x += slot.gap * jitter;
        continue;
      }
      if (slot.obstacle) this.obstacles.spawn(slot.obstacle, x);
      else if (slot.enemy) this.enemies.spawn(slot.enemy, x);
      else if (slot.pickup) this.pickups.spawn(slot.pickup, x);
      x += 1.0; // slot footprint
    }
    return Math.max(2, x - startX);
  }
}
