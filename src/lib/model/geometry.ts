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
  const len = dist(w.a, w.b) || 1;
  const nx = (-(w.b.y - w.a.y) / len) * (w.thickness / 2);
  const ny = ((w.b.x - w.a.x) / len) * (w.thickness / 2);
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

/** cm per pixel for a PDF page rendered at `dpi`, drawn at scale 1:`scale`. */
export const pdfCmPerPx = (dpi: number, scale: number): number => (2.54 / dpi) * scale;

export function formatLength(cm: number): string {
  return cm >= 100 ? `${(cm / 100).toFixed(2).replace('.', ',')} m` : `${Math.round(cm)} cm`;
}

export function bounds(points: Point[]): { min: Point; max: Point } | null {
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { min: { x: Math.min(...xs), y: Math.min(...ys) }, max: { x: Math.max(...xs), y: Math.max(...ys) } };
}

const round2 = (v: number) => Math.round(v * 100) / 100;
