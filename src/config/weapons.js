/**
 * Weapon table (TDD §6.4). The Player reads these; meta-upgrades mutate copies
 * at run start. `model` is the gun-mesh node name embedded in the character glTF
 * (so swapping weapons toggles which embedded mesh is visible).
 */
export const WEAPONS = {
  Pistol: {
    name: 'Pistol',
    damage: 1,
    fireRate: 4, // shots per second
    apCost: 1,
    projSpeed: 26,
    model: 'Pistol',
  },
  Shotgun: {
    name: 'Shotgun',
    damage: 1,
    fireRate: 1.3,
    apCost: 2,
    projSpeed: 22,
    pellets: 3,
    spread: 0.18, // radians between pellets
    model: 'Shotgun',
  },
  SMG: {
    name: 'SMG',
    damage: 1,
    fireRate: 9,
    apCost: 1,
    projSpeed: 30,
    model: 'SMG',
  },
};

/** Default loadout order (slots 1-3, PRD §2.1). */
export const DEFAULT_LOADOUT = ['Pistol', 'Shotgun', 'SMG'];

/**
 * Gun meshes embedded as child nodes inside the character glTF (verified in
 * Character_Soldier.gltf). All are hidden on load; the active weapon's mesh is
 * shown — that IS the weapon mount (no separate gun model to attach).
 */
export const EMBEDDED_GUN_NODES = [
  'AK', 'GrenadeLauncher', 'Knife_1', 'Knife_2', 'Pistol', 'Revolver',
  'Revolver_Small', 'RocketLauncher', 'ShortCannon', 'Shotgun', 'Shovel',
  'SMG', 'Sniper', 'Sniper_2',
];

/** Meta-upgrade deltas applied per level (TDD §8.2). */
export const UPGRADES = {
  damage: { perLevel: 1, maxLevel: 5, baseCost: 20, costGrowth: 1.6, label: 'Damage' },
  fireRate: { perLevel: 0.15, maxLevel: 5, baseCost: 25, costGrowth: 1.6, label: 'Fire Rate' },
};

/** Cost of upgrade `key` at the given current level. */
export function upgradeCost(key, level) {
  const u = UPGRADES[key];
  return Math.round(u.baseCost * Math.pow(u.costGrowth, level));
}

/**
 * Build the effective stat block for a weapon given persisted upgrade levels.
 * Returns a fresh copy — never mutate the base table.
 */
export function resolveWeapon(weaponName, upgradeRecord = {}) {
  const base = WEAPONS[weaponName];
  if (!base) throw new Error(`Unknown weapon: ${weaponName}`);
  const lvls = upgradeRecord[weaponName] || { damageLvl: 0, fireRateLvl: 0 };
  return {
    ...base,
    damage: base.damage + lvls.damageLvl * UPGRADES.damage.perLevel,
    fireRate: base.fireRate + lvls.fireRateLvl * UPGRADES.fireRate.perLevel,
  };
}
