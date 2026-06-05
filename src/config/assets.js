/**
 * Manifest-driven asset lookup (TDD §4.1).
 * assets.json is the source of truth; this flattens it by name and exposes
 * a URL helper that encodes the space in "Toon Shooter".
 */
import manifest from '../../assets.json';

/** Flatten every category's items into { name: item } */
function indexByName(m) {
  /** @type {Record<string, any>} */
  const flat = {};
  for (const category of Object.values(m.categories)) {
    for (const item of category.items) flat[item.name] = item;
  }
  return flat;
}

export const FLAT = indexByName(manifest);

/** glTF URL for an asset name, with the space encoded (TDD §1.1 warning). */
export function gltfUrl(name) {
  const item = FLAT[name];
  if (!item) throw new Error(`Unknown asset: ${name}`);
  return encodeURI(item.gltf);
}

export function hasAsset(name) {
  return Boolean(FLAT[name]);
}

/**
 * Slice asset set to preload before PLAYING (TDD §4.2).
 * Characters carry their own weapon meshes, so guns need no separate load.
 */
export const PRELOAD = {
  characters: ['Character_Soldier', 'Character_Enemy', 'Character_Hazmat'],
  props: [
    'BearTrap_Open',
    'Landmine',
    'SackTrench',
    'Barrier_Large',
    'ExplodingBarrel',
    'Health',
    'Structure_1',
    'Crate',
    'Pipes',
  ],
  // Background set-dressing grouped by depth band (TDD §12 non-colliding layers).
  // IMPORTANT: only use clearly-scenic props here — never obstacle-shaped items
  // (crates, cones, pallets, barrels). Those belong to gameplay obstacles at
  // Z=0; using them as decoration makes the player try to interact with a
  // non-colliding background prop.
  parallaxFar: ['Structure_3', 'Structure_4', 'WaterTank_Platform', 'Container_Long'],
  parallaxMid: ['Debris_BrokenCar', 'MetalFence', 'GasTank', 'Fence_Long'],
  parallaxNear: ['Debris_Tires', 'Debris_Pile', 'WoodPlanks', 'Pallet_Broken'],
};

PRELOAD.parallax = [...PRELOAD.parallaxFar, ...PRELOAD.parallaxMid, ...PRELOAD.parallaxNear];

export const ALL_PRELOAD = [...PRELOAD.characters, ...PRELOAD.props, ...PRELOAD.parallax];
