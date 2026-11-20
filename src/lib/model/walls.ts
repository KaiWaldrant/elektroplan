import { samePoint, withLength } from './geometry';
import type { Id, Point, Selection, Wall, WallEnd } from './types';

export function findWall(walls: Wall[], wallId: Id): Wall | undefined {
  return walls.find((w) => w.id === wallId);
}

export function selectedWall(floor: { walls: Wall[] }, selection: Selection): Wall | undefined {
  return selection?.kind === 'wall' ? findWall(floor.walls, selection.id) : undefined;
}

export function includesEnd(ends: WallEnd[], wallId: Id, end: WallEnd['end']): boolean {
  return ends.some((e) => e.wallId === wallId && e.end === end);
}

/** Every wall end lying on `p`, optionally leaving out one wall. */
export function connectedEnds(walls: Wall[], p: Point, exceptWallId?: Id): WallEnd[] {
  const ends: WallEnd[] = [];
  for (const w of walls) {
    if (w.id === exceptWallId) continue;
    if (samePoint(w.a, p)) ends.push({ wallId: w.id, end: 'a' });
    if (samePoint(w.b, p)) ends.push({ wallId: w.id, end: 'b' });
  }
  return ends;
}

/** Put the given wall ends on `to` (mutates the walls). */
export function moveEnds(walls: Wall[], ends: WallEnd[], to: Point): void {
  for (const e of ends) {
    const w = findWall(walls, e.wallId);
    if (w) w[e.end] = { ...to };
  }
}

/** Give a wall a new length by moving its end b; walls connected at b follow. Mutates `walls`. */
export function setWallLength(walls: Wall[], wallId: Id, cm: number): void {
  const w = findWall(walls, wallId);
  if (!w) return;
  const b = withLength(w, cm).b;
  moveEnds(walls, connectedEnds(walls, w.b, w.id), b);
  w.b = b;
}

/**
 * Move a wall by (dx, dy) from where all walls were when the drag began (`wallsAtStart`);
 * wall ends connected to it move along. Mutates `walls`.
 */
export function translateWall(walls: Wall[], wallsAtStart: Wall[], wallId: Id, dx: number, dy: number): void {
  const orig = findWall(wallsAtStart, wallId);
  const w = findWall(walls, wallId);
  if (!orig || !w) return;
  const shift = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
  for (const end of ['a', 'b'] as const) {
    for (const e of connectedEnds(wallsAtStart, orig[end], wallId)) {
      const from = findWall(wallsAtStart, e.wallId);
      if (from) moveEnds(walls, [e], shift(from[e.end]));
    }
  }
  w.a = shift(orig.a);
  w.b = shift(orig.b);
}
