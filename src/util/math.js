/** Small math helpers. */
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/** Mulberry32 — tiny seeded PRNG for deterministic tests (TDD §11). */
export function makeRng(seed = 1) {
  let s = seed >>> 0;
  return function rng() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a random element using the supplied rng (0..1). */
export function pick(arr, rng = Math.random) {
  return arr[Math.floor(rng() * arr.length)];
}
