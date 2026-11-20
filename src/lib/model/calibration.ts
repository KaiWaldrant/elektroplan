import { calibrate } from './geometry';
import type { Floor, Point } from './types';

/**
 * Calibrate the floor's plan so `p1`–`p2` measures `realCm`, and move everything placed on
 * the floor with it (ADR 0004): wall ends scale around `p1` by the same factor, so they stay
 * on the same spot of the plan. Wall thickness does not come from the plan and stays.
 * A floor without a plan is left as it is.
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
