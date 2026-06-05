import { describe, it, expect } from 'vitest';
import { intersects, centerDistance, box } from '../../src/util/aabb.js';

describe('AABB intersects (center-boxes)', () => {
  it('overlapping boxes intersect', () => {
    expect(intersects(box(0, 0, 2, 2), box(1, 0, 2, 2))).toBe(true);
  });
  it('touching edges do not intersect (strict)', () => {
    expect(intersects(box(0, 0, 2, 2), box(2, 0, 2, 2))).toBe(false);
  });
  it('separated boxes do not intersect', () => {
    expect(intersects(box(0, 0, 2, 2), box(5, 0, 2, 2))).toBe(false);
  });
  it('crouch: halved player box clears an overhead box', () => {
    const overhead = box(0, 2.6, 1.8, 1.4); // band 1.9..3.3
    const standing = box(0, 1.0, 0.9, 2.0); // top at 2.0 -> overlaps
    const crouched = box(0, 0.5, 0.9, 1.0); // top at 1.0 -> clears
    expect(intersects(standing, overhead)).toBe(true);
    expect(intersects(crouched, overhead)).toBe(false);
  });
});

describe('centerDistance', () => {
  it('computes euclidean distance between centers', () => {
    expect(centerDistance(box(0, 0, 1, 1), box(3, 4, 1, 1))).toBe(5);
  });
});
