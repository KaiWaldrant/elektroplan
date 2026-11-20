import { samePoint, withLength } from './geometry';
import type { Id, Point, Selection, Wall, WallEnd } from './types';

export function selectedWall(floor: { walls: Wall[] }, selection: Selection): Wall | undefined {
  return selection?.kind === 'wall' ? floor.walls.find((w) => w.id === selection.id) : undefined;
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
    const w = walls.find((x) => x.id === e.wallId);
    if (w) w[e.end] = { ...to };
  }
}

/** Give a wall a new length by moving its end b; walls connected at b follow. */
export function setWallLength(walls: Wall[], wallId: Id, cm: number): void {
  const w = walls.find((x) => x.id === wallId);
  if (!w) return;
  const ends = connectedEnds(walls, w.b);
  moveEnds(walls, ends, withLength(w, cm).b);
}

/**
 * Move a wall by (dx, dy) from where all walls were in `start` (the positions when the drag began);
 * wall ends connected to it move along. Mutates `walls`.
 */
export function translateWall(walls: Wall[], start: Wall[], wallId: Id, dx: number, dy: number): void {
  const orig = start.find((x) => x.id === wallId);
  const w = walls.find((x) => x.id === wallId);
  if (!orig || !w) return;
  const shift = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
  for (const end of ['a', 'b'] as const) {
    for (const e of connectedEnds(start, orig[end], wallId)) {
      const from = start.find((x) => x.id === e.wallId)![e.end];
      moveEnds(walls, [e], shift(from));
    }
  }
  w.a = shift(orig.a);
  w.b = shift(orig.b);
}
