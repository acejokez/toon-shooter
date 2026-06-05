import { describe, it, expect, beforeEach } from 'vitest';
import { CollisionSystem } from '../../src/systems/CollisionSystem.js';
import { EventBus, Events } from '../../src/core/events.js';
import { CONFIG, Team } from '../../src/config/constants.js';

// --- minimal fakes (only what CollisionSystem touches) ---

function fakeManager(items = []) {
  return {
    active: items,
    despawn(o) {
      const i = this.active.indexOf(o);
      if (i !== -1) this.active.splice(i, 1);
    },
  };
}

function fakePlayer(box) {
  return {
    alive: true,
    hp: CONFIG.PLAYER_HP,
    _box: box,
    getHitbox() {
      return this._box;
    },
    takeDamage(n) {
      this.hp -= n;
      return true;
    },
    heal(n) {
      this.hp += n;
    },
  };
}

function fakeProjectile(team, box, damage = 1) {
  return { team, damage, getHitbox: () => box };
}

function fakeEnemy(box, hp = 1, kind = 'ground') {
  return {
    alive: true,
    hp,
    kind,
    getHitbox: () => box,
    takeDamage(n) {
      this.hp -= n;
      if (this.hp <= 0) {
        this.alive = false;
        return true;
      }
      return false;
    },
  };
}

function fakeObstacle(box, data) {
  return { alive: true, detonated: false, data, getHitbox: () => box };
}

describe('CollisionSystem', () => {
  let bus, events;
  beforeEach(() => {
    bus = new EventBus();
    events = [];
    for (const name of Object.values(Events)) bus.on(name, (p) => events.push({ name, p }));
  });

  it('player projectile kills an overlapping enemy and emits ENEMY_KILLED', () => {
    const box = { x: 5, y: 1, w: 0.2, h: 0.2 };
    const proj = fakeProjectile(Team.PLAYER, box, 2);
    const enemy = fakeEnemy({ x: 5, y: 1, w: 1, h: 2 }, 2);
    const projectiles = fakeManager([proj]);
    const enemies = fakeManager([enemy]);
    const sys = new CollisionSystem(bus, {
      projectiles, enemies, obstacles: fakeManager(), pickups: fakeManager(),
    });

    sys.update(fakePlayer({ x: -4, y: 1, w: 0.9, h: 2 }));

    expect(enemy.alive).toBe(false);
    expect(projectiles.active).toHaveLength(0); // bullet consumed
    expect(events.some((e) => e.name === Events.ENEMY_KILLED)).toBe(true);
  });

  it('enemy bullet damages the player', () => {
    const pbox = { x: -4, y: 1, w: 0.9, h: 2 };
    const player = fakePlayer(pbox);
    const proj = fakeProjectile(Team.ENEMY, { x: -4, y: 1, w: 0.2, h: 0.2 }, 3);
    const projectiles = fakeManager([proj]);
    const sys = new CollisionSystem(bus, {
      projectiles, enemies: fakeManager(), obstacles: fakeManager(), pickups: fakeManager(),
    });

    sys.update(player);

    expect(player.hp).toBe(CONFIG.PLAYER_HP - 3);
    expect(projectiles.active).toHaveLength(0);
  });

  it('bear trap damages the player and breaks the streak', () => {
    const pbox = { x: -4, y: 0.3, w: 0.9, h: 1 };
    const player = fakePlayer(pbox);
    const trap = fakeObstacle({ x: -4, y: 0.3, w: 1, h: 0.6 }, {
      damage: CONFIG.TRAP_DAMAGE, breakStreak: true,
    });
    const sys = new CollisionSystem(bus, {
      projectiles: fakeManager(), enemies: fakeManager(), obstacles: fakeManager([trap]), pickups: fakeManager(),
    });

    sys.update(player);

    expect(player.hp).toBe(CONFIG.PLAYER_HP - CONFIG.TRAP_DAMAGE);
    expect(events.some((e) => e.name === Events.STREAK_BREAK)).toBe(true);
  });

  it('shooting a mine detonates it with AoE that also kills a nearby enemy', () => {
    const mineBox = { x: 6, y: 0.3, w: 0.8, h: 0.6 };
    const proj = fakeProjectile(Team.PLAYER, { x: 6, y: 0.3, w: 0.2, h: 0.2 });
    const mine = fakeObstacle(mineBox, { damage: CONFIG.MINE_DAMAGE, detonable: true, aoe: true });
    // Clear of the bullet path on X, but within AOE_RADIUS of the mine center.
    const enemy = fakeEnemy({ x: 7.5, y: 1, w: 1, h: 2 }, 2);
    const obstacles = fakeManager([mine]);
    const enemies = fakeManager([enemy]);
    const sys = new CollisionSystem(bus, {
      projectiles: fakeManager([proj]), enemies, obstacles, pickups: fakeManager(),
    });

    sys.update(fakePlayer({ x: -4, y: 1, w: 0.9, h: 2 }));

    expect(events.some((e) => e.name === Events.MINE_DETONATE)).toBe(true);
    expect(enemy.alive).toBe(false); // AoE splash
    expect(obstacles.active).toHaveLength(0); // mine consumed
  });

  it('health pickup heals and is consumed', () => {
    const player = fakePlayer({ x: -4, y: 1, w: 0.9, h: 2 });
    player.hp = 10;
    const pk = { kind: 'health', getHitbox: () => ({ x: -4, y: 1, w: 0.8, h: 0.8 }) };
    const pickups = fakeManager([pk]);
    const sys = new CollisionSystem(bus, {
      projectiles: fakeManager(), enemies: fakeManager(), obstacles: fakeManager(), pickups,
    });

    sys.update(player);

    expect(player.hp).toBe(10 + CONFIG.HEALTH_PICKUP);
    expect(pickups.active).toHaveLength(0);
    expect(events.some((e) => e.name === Events.PICKUP_HEALTH)).toBe(true);
  });
});
