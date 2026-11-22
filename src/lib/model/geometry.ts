import { formatDecimal } from './numbers';
import type { Background, Id, Point, Wall, WallEnd } from './types';

export const dist = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

export const samePoint = (a: Point, b: Point, tol = 0.5): boolean => dist(a, b) <= tol;

/** Snap the direction from `from` to `to` to the nearest multiple of `stepDeg`, keeping the length. */
export function snapAngle(from: Point, to: Point, stepDeg: number): Point {
  const len = dist(from, to);
  if (len === 0) return { ...to };
  const step = (stepDeg * Math.PI) / 180;
  const ang = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / step) * step;
  return { x: round2(from.x + len * Math.cos(ang)), y: round2(from.y + len * Math.sin(ang)) };
}

/** Point at `length` cm from `from` in the direction of `towards`. */
export function atLength(from: Point, towards: Point, length: number): Point {
  const len = dist(from, towards);
  if (len === 0) return { x: from.x + length, y: from.y };
  const k = length / len;
  return { x: round2(from.x + (towards.x - from.x) * k), y: round2(from.y + (towards.y - from.y) * k) };
}

/** Closest candidate within `maxDist`, or null. */
export function nearestPoint(candidates: Point[], p: Point, maxDist: number): Point | null {
  let best: Point | null = null;
  let bestD = maxDist;
  for (const c of candidates) {
    const d = dist(c, p);
    if (d <= bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

export interface Projection {
  point: Point;
  /** 0 at a, 1 at b. */
  t: number;
  dist: number;
}

export function projectOnSegment(p: Point, a: Point, b: Point): Projection {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  const point = { x: a.x + t * dx, y: a.y + t * dy };
  return { point, t, dist: dist(p, point) };
}

/** Index of the wall under `p` (within half its thickness plus `tol`), or -1. Nearest wins. */
export function hitWall(walls: Wall[], p: Point, tol: number): number {
  let best = -1;
  let bestD = Infinity;
  walls.forEach((w, i) => {
    const d = projectOnSegment(p, w.a, w.b).dist;
    if (d <= w.thickness / 2 + tol && d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

/** Corners of a wall drawn as a rectangle of its thickness, centred on a-b. */
export function wallPolygon(w: Wall): Point[] {
  const n = wallNormal(w);
  const nx = n.x * (w.thickness / 2);
  const ny = n.y * (w.thickness / 2);
  return [
    { x: w.a.x + nx, y: w.a.y + ny },
    { x: w.b.x + nx, y: w.b.y + ny },
    { x: w.b.x - nx, y: w.b.y - ny },
    { x: w.a.x - nx, y: w.a.y - ny },
  ];
}

/** How far a mitre may reach past the thicker wall's face, in thicknesses of the thinner wall; further becomes a bevel. */
const MITRE_REACH = 1.5;
/** Angles and cross products below this count as zero. */
const EPSILON = 1e-9;

/** One wall end at a corner, seen from the corner. */
interface CornerEnd {
  wall: Wall;
  end: WallEnd['end'];
  /** Unit direction from the corner along the wall. */
  along: Point;
  angle: number;
}

/**
 * The outline of every wall as drawn on the plan, by wall id. Walls whose ends share a point
 * are mitred there, so joined walls meet in a clean corner. Each polygon runs from the a end
 * to the b end, starting on the a−n side (n = `wallNormal`).
 */
export function wallShapes(walls: Wall[]): Map<Id, Point[]> {
  const ends: CornerEnd[] = [];
  for (const w of walls) {
    if (dist(w.a, w.b) === 0) continue;
    for (const end of ['a', 'b'] as const) {
      const from = w[end];
      const to = end === 'a' ? w.b : w.a;
      const len = dist(from, to);
      const along = { x: (to.x - from.x) / len, y: (to.y - from.y) / len };
      ends.push({ wall: w, end, along, angle: Math.atan2(along.y, along.x) });
    }
  }

  // Each end belongs to one corner only: the first one that reaches it.
  const caps = new Map<CornerEnd, Point[]>();
  for (const e of ends) {
    if (caps.has(e)) continue;
    const corner = e.wall[e.end];
    const meeting = ends.filter((o) => !caps.has(o) && samePoint(o.wall[o.end], corner));
    cornerCaps(meeting, corner).forEach((cap, i) => caps.set(meeting[i], cap));
  }

  // Walls of zero length have no ends above and keep their plain rectangle.
  const shapes = new Map<Id, Point[]>();
  for (const w of walls) {
    const [p0, p1, p2, p3] = wallPolygon(w);
    shapes.set(w.id, [p3, p0, p1, p2]);
  }
  for (let i = 0; i < ends.length; i += 2) shapes.set(ends[i].wall.id, [...caps.get(ends[i])!, ...caps.get(ends[i + 1])!]);
  return shapes;
}

/**
 * The end outline of each wall end in `meeting`, all lying at `corner`, in the same order.
 * A cap runs from the wall's right face to its left face (left = its direction turned a
 * quarter towards the next wall around the corner).
 */
function cornerCaps(meeting: CornerEnd[], corner: Point): Point[][] {
  const face = (e: CornerEnd, side: 'left' | 'right'): Point => {
    const half = ((side === 'left' ? 1 : -1) * e.wall.thickness) / 2;
    return { x: corner.x - e.along.y * half, y: corner.y + e.along.x * half };
  };
  if (meeting.length === 1) return [[face(meeting[0], 'right'), face(meeting[0], 'left')]];

  const order = meeting.map((_, i) => i).sort((i, j) => meeting[i].angle - meeting[j].angle);
  const rightPart: Point[][] = [];
  const leftPart: Point[][] = [];
  order.forEach((i, k) => {
    const e = meeting[i];
    const nextIndex = order[(k + 1) % order.length];
    const next = meeting[nextIndex];
    let turn = next.angle - e.angle;
    if (turn <= 0) turn += 2 * Math.PI;
    const mitre = intersectLines(face(e, 'left'), e.along, face(next, 'right'), next.along);
    if (mitre && mitreFits(mitre, corner, e, next)) {
      leftPart[i] = [mitre];
      rightPart[nextIndex] = [mitre];
    } else {
      // Bevel: on the outside of the join, close the gap between the two faces.
      leftPart[i] = turn > Math.PI + EPSILON ? [face(next, 'right'), face(e, 'left')] : [face(e, 'left')];
      rightPart[nextIndex] = [face(next, 'right')];
    }
  });
  return meeting.map((_, i) => [...rightPart[i], corner, ...leftPart[i]]);
}

/** A mitre fits when it does not spike far past the walls and stays within both walls' length. */
function mitreFits(mitre: Point, corner: Point, e: CornerEnd, next: CornerEnd): boolean {
  const thick = Math.max(e.wall.thickness, next.wall.thickness);
  const thin = Math.min(e.wall.thickness, next.wall.thickness);
  if (dist(mitre, corner) > thick / 2 + MITRE_REACH * thin) return false;
  const reach = (o: CornerEnd) => (mitre.x - corner.x) * o.along.x + (mitre.y - corner.y) * o.along.y;
  return reach(e) <= dist(e.wall.a, e.wall.b) && reach(next) <= dist(next.wall.a, next.wall.b);
}

/** Intersection of the lines p + s·u and q + t·v, or null when they are parallel. */
function intersectLines(p: Point, u: Point, q: Point, v: Point): Point | null {
  const cross = u.x * v.y - u.y * v.x;
  if (Math.abs(cross) < EPSILON) return null;
  const s = ((q.x - p.x) * v.y - (q.y - p.y) * v.x) / cross;
  return { x: p.x + s * u.x, y: p.y + s * u.y };
}

/** Keep `a`, move `b` so the wall gets the given length. */
export function withLength(w: Wall, length: number): Wall {
  return { ...w, b: atLength(w.a, w.b, length) };
}

/** cm per pixel for a PDF page rendered at `dpi`, drawn at scale 1:`scale`. */
export const pdfCmPerPx = (dpi: number, scale: number): number => (2.54 / dpi) * scale;

export function formatLength(cm: number): string {
  return cm >= 100 ? `${formatDecimal(cm / 100, 2)} m` : `${Math.round(cm)} cm`;
}

export function bounds(points: Point[]): { min: Point; max: Point } | null {
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { min: { x: Math.min(...xs), y: Math.min(...ys) }, max: { x: Math.max(...xs), y: Math.max(...ys) } };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** A point rounded to whole cm. */
export const roundPoint = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });

/** Size of the plan background in world cm. */
export function backgroundExtent(bg: Background): { width: number; height: number } {
  return { width: bg.widthPx * bg.cmPerPx, height: bg.heightPx * bg.cmPerPx };
}

/** Unit vector perpendicular to the wall (to the left of a → b in screen coordinates). */
export function wallNormal(w: Wall): Point {
  const len = dist(w.a, w.b) || 1;
  return { x: -(w.b.y - w.a.y) / len, y: (w.b.x - w.a.x) / len };
}

/** Top-left and bottom-right corner of the plan background in world cm. */
export function backgroundCorners(bg: Background): [Point, Point] {
  const { width, height } = backgroundExtent(bg);
  return [{ ...bg.offset }, { x: bg.offset.x + width, y: bg.offset.y + height }];
}

/** Whether `p` lies inside the polygon (even-odd rule; a point exactly on an edge may go either way). */
export function pointInPolygon(p: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Area of a polygon in cm², whatever the drawing direction (shoelace formula). */
export function polygonArea(polygon: Point[]): number {
  let twice = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    twice += (polygon[j].x + polygon[i].x) * (polygon[j].y - polygon[i].y);
  }
  return Math.abs(twice) / 2;
}
