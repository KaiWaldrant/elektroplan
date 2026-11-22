import { formatDecimal } from './numbers';
import type { Background, Id, Point, Wall } from './types';

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

/** A mitre may reach at most this many wall thicknesses past the corner; a longer one becomes a bevel. */
const MITRE_LIMIT = 2;

/** One wall end at a joint, seen from the joint point. */
interface JointEnd {
  wall: Wall;
  end: 'a' | 'b';
  /** Unit direction from the joint along the wall. */
  u: Point;
  angle: number;
}

/**
 * The outline of every wall as drawn on the plan, by wall id. Walls whose ends share a point
 * are mitred there, so joined walls meet in a clean corner. Each polygon runs from the a end
 * to the b end, starting on the a−n side (n = `wallNormal`).
 */
export function wallShapes(walls: Wall[]): Map<Id, Point[]> {
  const ends: JointEnd[] = [];
  for (const w of walls) {
    if (dist(w.a, w.b) === 0) continue;
    for (const end of ['a', 'b'] as const) {
      const from = w[end];
      const to = end === 'a' ? w.b : w.a;
      const len = dist(from, to);
      const u = { x: (to.x - from.x) / len, y: (to.y - from.y) / len };
      ends.push({ wall: w, end, u, angle: Math.atan2(u.y, u.x) });
    }
  }

  const caps = new Map<JointEnd, Point[]>();
  for (const e of ends) {
    if (caps.has(e)) continue;
    const node = e.wall[e.end];
    const joint = ends.filter((o) => samePoint(o.wall[o.end], node));
    jointCaps(joint, node).forEach((cap, i) => caps.set(joint[i], cap));
  }

  const shapes = new Map<Id, Point[]>();
  for (const w of walls) {
    const [p0, p1, p2, p3] = wallPolygon(w);
    const capOf = (end: 'a' | 'b') => caps.get(ends.find((e) => e.wall === w && e.end === end)!);
    shapes.set(w.id, dist(w.a, w.b) === 0 ? [p3, p0, p1, p2] : [...capOf('a')!, ...capOf('b')!]);
  }
  return shapes;
}

/**
 * The end outline of each wall end meeting at `node`, in the order of `joint`. A cap runs
 * from the wall's −p side to its +p side, where p is its direction turned a quarter towards
 * the next wall around the joint.
 */
function jointCaps(joint: JointEnd[], node: Point): Point[][] {
  const side = (e: JointEnd, sign: 1 | -1): Point => {
    const h = (sign * e.wall.thickness) / 2;
    return { x: node.x - e.u.y * h, y: node.y + e.u.x * h };
  };
  if (joint.length === 1) return [[side(joint[0], -1), side(joint[0], 1)]];

  const order = joint.map((_, i) => i).sort((i, j) => joint[i].angle - joint[j].angle);
  const minusSide: Point[][] = [];
  const plusSide: Point[][] = [];
  order.forEach((i, k) => {
    const e = joint[i];
    const nextIndex = order[(k + 1) % order.length];
    const next = joint[nextIndex];
    let turn = next.angle - e.angle;
    if (turn <= 0) turn += 2 * Math.PI;
    const mitre = intersectLines(side(e, 1), e.u, side(next, -1), next.u);
    if (mitre && dist(mitre, node) <= MITRE_LIMIT * Math.max(e.wall.thickness, next.wall.thickness)) {
      plusSide[i] = [mitre];
      minusSide[nextIndex] = [mitre];
    } else {
      // Bevel: on the outside of the join, close the gap between the two faces.
      plusSide[i] = turn > Math.PI + 1e-6 ? [side(next, -1), side(e, 1)] : [side(e, 1)];
      minusSide[nextIndex] = [side(next, -1)];
    }
  });
  return joint.map((_, i) => [...minusSide[i], node, ...plusSide[i]]);
}

/** Intersection of the lines p + s·u and q + t·v, or null when they are parallel. */
function intersectLines(p: Point, u: Point, q: Point, v: Point): Point | null {
  const cross = u.x * v.y - u.y * v.x;
  if (Math.abs(cross) < 1e-9) return null;
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
