import { nearestPoint, projectOnSegment, snapAngle } from '../../model/geometry';
import { includesEnd } from '../../model/walls';
import type { Point, Wall, WallEnd } from '../../model/types';

/** Screen distance (px) within which points snap; callers turn it into cm for the current zoom. */
export const SNAP_PX = 10;
/** Angle step (degrees) for directions drawn from a start point. */
const ANGLE_STEP_DEG = 15;

export interface SnapOptions {
  /** Snap distance in world cm. */
  tolerance: number;
  /** Start of the line being drawn; its direction snaps to 15° steps. */
  from?: Point | null;
  /** Wall ends being dragged: never snap to them, nor onto their walls. */
  exclude?: WallEnd[];
  /** Alt held: only wall ends snap, otherwise just round. */
  free?: boolean;
}

export interface Snap {
  /** Where the point goes, in world cm. */
  point: Point;
  /** Where to show the snap marker, or null when nothing snapped. */
  mark: Point | null;
}

const round = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });

/**
 * Snap `p` in this order: to a nearby wall end, else (unless `free`) the direction from `from`
 * to 15° steps and then onto a nearby wall. The result is rounded to whole cm, except at a wall end.
 */
export function snapPoint(walls: Wall[], p: Point, { tolerance, from = null, exclude = [], free = false }: SnapOptions): Snap {
  const ends: Point[] = [];
  for (const w of walls) {
    if (!includesEnd(exclude, w.id, 'a')) ends.push(w.a);
    if (!includesEnd(exclude, w.id, 'b')) ends.push(w.b);
  }
  const end = nearestPoint(ends, p, tolerance);
  if (end) return { point: { ...end }, mark: { ...end } };
  if (free) return { point: round(p), mark: null };

  const q = from ? snapAngle(from, p, ANGLE_STEP_DEG) : p;
  for (const w of walls) {
    if (exclude.some((e) => e.wallId === w.id)) continue;
    const onWall = projectOnSegment(q, w.a, w.b);
    if (onWall.dist < tolerance) {
      const point = round(onWall.point);
      return { point, mark: { ...point } };
    }
  }
  return { point: round(q), mark: null };
}
