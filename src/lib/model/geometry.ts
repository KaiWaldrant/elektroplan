import { formatDecimal } from './numbers';
import type { Background, Point, Wall } from './types';

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

/** Sign of the turn a → b → c: > 0 one way, < 0 the other, 0 when the three lie on one line. */
const orient = (a: Point, b: Point, c: Point): number => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** Whether `p`, already on the line through a-b, lies within the segment's box. */
const withinBox = (p: Point, a: Point, b: Point): boolean =>
  Math.min(a.x, b.x) <= p.x && p.x <= Math.max(a.x, b.x) && Math.min(a.y, b.y) <= p.y && p.y <= Math.max(a.y, b.y);

/** Whether segments a-b and c-d share any point (crossing, touching or overlapping). */
export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;
  return (
    (o1 === 0 && withinBox(c, a, b)) ||
    (o2 === 0 && withinBox(d, a, b)) ||
    (o3 === 0 && withinBox(a, c, d)) ||
    (o4 === 0 && withinBox(b, c, d))
  );
}

/**
 * Whether the closed outline does not cross or touch itself: edges meet only at their shared corner.
 * Needed for `pointInPolygon` (even-odd rule) to mean "inside the room".
 */
export function isSimplePolygon(polygon: Point[]): boolean {
  const n = polygon.length;
  if (n < 3) return false;
  const edge = (i: number): [Point, Point] => [polygon[i], polygon[(i + 1) % n]];
  for (let i = 0; i < n; i++) {
    const [a, b] = edge(i);
    if (samePoint(a, b, 0)) return false;
    // The next edge shares corner b; it must not run back along this one.
    const c = polygon[(i + 2) % n];
    if (orient(a, b, c) === 0 && (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y) < 0) return false;
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // the last edge shares corner 0 with the first
      const [c2, d2] = edge(j);
      if (segmentsIntersect(a, b, c2, d2)) return false;
    }
  }
  return true;
}
