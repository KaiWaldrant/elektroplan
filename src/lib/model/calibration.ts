import { dist } from './geometry';
import type { Background, Floor, Point } from './types';

/**
 * Re-scale a background so the world distance between p1 and p2 becomes `realCm`.
 * p1 stays where it is on screen, so the user does not lose their place.
 */
export function calibrate(bg: Background, p1: Point, p2: Point, realCm: number): Background {
  const measured = dist(p1, p2);
  if (measured <= 0 || realCm <= 0) throw new Error('Calibration needs two different points and a positive distance');
  const cmPerPx = (bg.cmPerPx * realCm) / measured;
  const px = { x: (p1.x - bg.offset.x) / bg.cmPerPx, y: (p1.y - bg.offset.y) / bg.cmPerPx };
  return { ...bg, cmPerPx, offset: { x: p1.x - px.x * cmPerPx, y: p1.y - px.y * cmPerPx }, calibrated: true };
}

/**
 * Calibrate the floor's plan so `p1`–`p2` measures `realCm`, and move everything placed on
 * the floor with it (ADR 0004): wall ends scale around `p1` by the same factor, so they stay
 * on the same spot of the plan. Wall thickness does not come from the plan and stays.
 * Mutates `floor`; a floor without a plan is left as it is, and nothing changes if it throws.
 * New kinds of items placed on a floor (Toestellen, Ruimtes) must be scaled here too.
 */
export function calibrateFloor(floor: Floor, p1: Point, p2: Point, realCm: number): void {
  const before = floor.background;
  if (!before) return;
  const after = calibrate(before, p1, p2, realCm);
  const factor = after.cmPerPx / before.cmPerPx;
  const scale = (p: Point): Point => ({ x: p1.x + (p.x - p1.x) * factor, y: p1.y + (p.y - p1.y) * factor });
  floor.background = after;
  for (const w of floor.walls) {
    w.a = scale(w.a);
    w.b = scale(w.b);
  }
}
