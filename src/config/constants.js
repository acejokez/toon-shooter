/**
 * CONFIG — single source of truth for every tunable number (TDD §13).
 * Balancing happens here and nowhere else.
 */
export const CONFIG = {
  // World / coordinates (TDD §3.1)
  PLAYER_X: -4,
  GROUND_Y: 0,
  SPAWN_X: 14,
  DESPAWN_X: -14,

  // Scroll / difficulty
  SCROLL_SPEED_START: 6,
  SCROLL_SPEED_MAX: 14,
  SCROLL_RAMP_PER_M: 0.01,

  // Player physics (tuned so a jump clears a ~2u wall).
  // Asymmetric gravity = snappier platformer feel: float up, drop fast.
  GRAVITY: 36, // ascent
  FALL_GRAVITY: 58, // descent (heavier => less floaty)
  JUMP_VELOCITY: 14,
  COYOTE_TIME: 0.1, // grace window to still jump after leaving a ledge
  JUMP_BUFFER: 0.12, // press-early window that fires on landing
  JUMP_CUT: 0.45, // release-early velocity multiplier (variable jump height)
  CROUCH_HITBOX_SCALE: 0.5,

  // Player stats
  PLAYER_HP: 30,
  HEALTH_PICKUP: 3,
  AP_MAX: 8,
  AP_REGEN_PER_S: 1,

  // Player hitbox (AABB, world units; centered on player anchor)
  PLAYER_W: 0.9,
  PLAYER_H: 2.0,

  // Combat
  ENEMY_CLOSING_SPEED: 1.5, // extra leftward speed on top of scroll
  ENEMY_HP: 2,
  HAZMAT_HP: 4,
  ENEMY_FIRE_INTERVAL: 2.2, // seconds between enemy shots
  HAZMAT_FIRE_INTERVAL: 2.6,
  ENEMY_TOUCH_DAMAGE: 4,
  ENEMY_BULLET_DAMAGE: 3,
  TRAP_DAMAGE: 5,
  MINE_DAMAGE: 8,
  WALL_DAMAGE: 4,
  AOE_RADIUS: 2.5,
  AOE_DAMAGE: 6,

  // Rewards
  SCRAP_PER_KILL: 5,
  SCRAP_PER_PICKUP: 3,
  SCRAP_PICKUP_CHANCE: 0.5, // chance a killed enemy drops a scrap pickup

  // Pools
  POOL: { projectiles: 64, obstacles: 24, enemies: 12, pickups: 16 },

  // Timing (TDD §7)
  FIXED_STEP: 1 / 120,
  MAX_DT: 0.1,
  METERS_PER_UNIT: 1,

  // Scale normalization targets (world units of height)
  HEIGHTS: {
    character: 2.0,
    wall: 2.0,
    pickup: 0.8,
    mine: 0.4,
    trap: 0.5,
    platform: 2.4,
    crate: 1.1,
  },

  // i-frames after taking a hit (seconds)
  HIT_INVULN: 0.8,
};

/** Game finite-state-machine states (TDD §7). */
export const GameState = {
  LOADING: 'loading',
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'gameover',
};

/** Projectile teams. */
export const Team = { PLAYER: 'player', ENEMY: 'enemy' };
