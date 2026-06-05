/**
 * Pure 2D AABB helpers. Boxes are {x, y, w, h} where (x, y) is the CENTER and
 * (w, h) the full width/height. Everything in gameplay is an AABB on Z=0
 * (TDD §6.2), which keeps collision pure and unit-testable.
 */

/** Do two center-boxes overlap? */
export function intersects(a, b) {
  return (
    Math.abs(a.x - b.x) * 2 < a.w + b.w &&
    Math.abs(a.y - b.y) * 2 < a.h + b.h
  );
}

/** Euclidean distance between box centers (for AoE radius checks). */
export function centerDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

/** Make a center-box. */
export function box(x, y, w, h) {
  return { x, y, w, h };
}
