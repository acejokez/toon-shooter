/**
 * CollisionSystem — AABB tests on the single lane (TDD §6.2). Broadphase is
 * trivial (a few dozen boxes). It applies direct resolution (takeDamage/heal/
 * despawn) AND emits typed events for ScoreSystem/HUD/juice. The pure geometry
 * lives in util/aabb (unit-tested).
 *
 * Crouch correctness: it reads the player's *current* (possibly halved) hitbox,
 * so ducking genuinely avoids overhead hits.
 */
import { intersects, centerDistance } from '../util/aabb.js';
import { CONFIG, Team } from '../config/constants.js';
import { Events } from '../core/events.js';

export class CollisionSystem {
  /**
   * @param {import('../core/events.js').EventBus} bus
   * @param {object} managers { projectiles, enemies, obstacles, pickups }
   */
  constructor(bus, { projectiles, enemies, obstacles, pickups }) {
    this.bus = bus;
    this.projectiles = projectiles;
    this.enemies = enemies;
    this.obstacles = obstacles;
    this.pickups = pickups;
  }

  /** Run all collision passes for one fixed step. */
  update(player) {
    if (!player.alive) return;
    const pbox = player.getHitbox();

    this._projectilesVsTargets();
    this._playerVsEnemyBullets(player, pbox);
    this._playerVsObstacles(player, pbox);
    this._playerVsPickups(player, pbox);
  }

  _projectilesVsTargets() {
    for (const proj of [...this.projectiles.active]) {
      if (proj.team !== Team.PLAYER) continue;
      const box = proj.getHitbox();
      let consumed = false;

      // vs enemies
      for (const enemy of this.enemies.active) {
        if (!enemy.alive) continue;
        if (intersects(box, enemy.getHitbox())) {
          const killed = enemy.takeDamage(proj.damage);
          if (killed) {
            const p = enemy.getHitbox();
            this.bus.emit(Events.ENEMY_KILLED, { kind: enemy.kind, x: p.x, y: p.y });
          }
          consumed = true;
          break;
        }
      }
      if (consumed) {
        this.projectiles.despawn(proj);
        continue;
      }

      // vs detonable obstacles (mines / barrels — strategic detonation, PRD)
      for (const obs of this.obstacles.active) {
        if (!obs.alive || !obs.data.detonable) continue;
        if (intersects(box, obs.getHitbox())) {
          this._detonate(obs, null);
          consumed = true;
          break;
        }
      }
      if (consumed) this.projectiles.despawn(proj);
    }
  }

  _playerVsEnemyBullets(player, pbox) {
    for (const proj of [...this.projectiles.active]) {
      if (proj.team !== Team.ENEMY) continue;
      if (intersects(pbox, proj.getHitbox())) {
        player.takeDamage(proj.damage);
        this.projectiles.despawn(proj);
      }
    }
  }

  _playerVsObstacles(player, pbox) {
    for (const obs of this.obstacles.active) {
      if (!obs.alive) continue;
      if (!intersects(pbox, obs.getHitbox())) continue;

      if (obs.data.aoe) {
        this._detonate(obs, player); // mine/barrel touched
      } else if (obs.data.damage) {
        // Standable solids only hurt on a SIDE hit — landing cleanly on top
        // (feet at/above the surface) is the intended counter-play, not damage.
        if (obs.data.standable) {
          const feet = pbox.y - pbox.h / 2;
          if (feet >= obs.topY - 0.12) continue;
        }
        // trap / wall / barrier / overhead — i-frames prevent multi-hit
        player.takeDamage(obs.data.damage, { breakStreak: !!obs.data.breakStreak });
        if (obs.data.breakStreak) this.bus.emit(Events.STREAK_BREAK, {});
      }
    }
  }

  _playerVsPickups(player, pbox) {
    for (const pk of [...this.pickups.active]) {
      if (intersects(pbox, pk.getHitbox())) {
        if (pk.kind === 'health') {
          player.heal(CONFIG.HEALTH_PICKUP);
          this.bus.emit(Events.PICKUP_HEALTH, { amount: CONFIG.HEALTH_PICKUP });
        } else {
          this.bus.emit(Events.PICKUP_SCRAP, { amount: CONFIG.SCRAP_PER_PICKUP });
        }
        this.pickups.despawn(pk);
      }
    }
  }

  /** Detonate a mine/barrel: AoE damage to player, enemies, and chain to other
   *  detonable obstacles. `player` may be null (shot-triggered). */
  _detonate(obs, player) {
    if (obs.detonated) return;
    obs.detonated = true;
    const center = obs.getHitbox();
    this.bus.emit(Events.MINE_DETONATE, { x: center.x, y: center.y });

    // Enemies in radius
    for (const enemy of this.enemies.active) {
      if (!enemy.alive) continue;
      if (centerDistance(center, enemy.getHitbox()) <= CONFIG.AOE_RADIUS) {
        if (enemy.takeDamage(CONFIG.AOE_DAMAGE)) {
          const p = enemy.getHitbox();
          this.bus.emit(Events.ENEMY_KILLED, { kind: enemy.kind, x: p.x, y: p.y });
        }
      }
    }
    // Player in radius
    if (player && player.alive) {
      if (centerDistance(center, player.getHitbox()) <= CONFIG.AOE_RADIUS) {
        player.takeDamage(CONFIG.AOE_DAMAGE);
      }
    }
    // Chain to nearby detonable obstacles
    for (const other of this.obstacles.active) {
      if (other === obs || !other.alive || other.detonated || !other.data.detonable) continue;
      if (centerDistance(center, other.getHitbox()) <= CONFIG.AOE_RADIUS) {
        this._detonate(other, player);
      }
    }

    obs.alive = false;
    this.obstacles.despawn(obs);
  }
}
