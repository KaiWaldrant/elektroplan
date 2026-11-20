import { describe, expect, it } from 'vitest';
import {
  atLength,
  backgroundCorners,
  backgroundExtent,
  calibrate,
  dist,
  formatLength,
  hitWall,
  nearestPoint,
  pdfCmPerPx,
  projectOnSegment,
  snapAngle,
  wallNormal,
  wallPolygon,
  withLength,
} from './geometry';
import type { Background, Wall } from './types';

const bg = (over: Partial<Background> = {}): Background => ({
  blobKey: 'k',
  name: 'plan',
  widthPx: 1000,
  heightPx: 800,
  cmPerPx: 1,
  offset: { x: 0, y: 0 },
  opacity: 0.5,
  locked: false,
  calibrated: false,
  ...over,
});

describe('snapAngle', () => {
  it('snaps a nearly horizontal line to horizontal, keeping its length', () => {
    const p = snapAngle({ x: 0, y: 0 }, { x: 100, y: 4 }, 15);
    expect(p.y).toBeCloseTo(0);
    expect(p.x).toBeCloseTo(Math.hypot(100, 4), 1);
  });
  it('snaps to 45 degrees', () => {
    const p = snapAngle({ x: 0, y: 0 }, { x: 100, y: 95 }, 45);
    expect(p.x).toBeCloseTo(p.y, 1);
  });
});

describe('atLength / withLength', () => {
  it('places a point at an exact distance along a direction', () => {
    expect(atLength({ x: 0, y: 0 }, { x: 10, y: 0 }, 368)).toEqual({ x: 368, y: 0 });
  });
  it('changes a wall length and keeps its start point', () => {
    const w: Wall = { id: 'w', a: { x: 10, y: 10 }, b: { x: 10, y: 50 }, thickness: 10 };
    const r = withLength(w, 428);
    expect(r.a).toEqual(w.a);
    expect(dist(r.a, r.b)).toBeCloseTo(428);
  });
});

describe('nearestPoint', () => {
  it('returns the closest point within range and null outside it', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    expect(nearestPoint(pts, { x: 8, y: 1 }, 5)).toEqual({ x: 10, y: 0 });
    expect(nearestPoint(pts, { x: 50, y: 50 }, 5)).toBeNull();
  });
});

describe('projectOnSegment / hitWall', () => {
  it('clamps the projection to the segment', () => {
    const pr = projectOnSegment({ x: -5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(pr.t).toBe(0);
    expect(pr.dist).toBeCloseTo(Math.hypot(5, 3));
  });
  it('hits a wall within half its thickness plus tolerance', () => {
    const walls: Wall[] = [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, thickness: 20 }];
    expect(hitWall(walls, { x: 50, y: 12 }, 3)).toBe(0);
    expect(hitWall(walls, { x: 50, y: 20 }, 3)).toBe(-1);
  });
});

describe('wallPolygon', () => {
  it('builds a rectangle of the wall thickness around the centre line', () => {
    const poly = wallPolygon({ id: 'w', a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, thickness: 20 });
    const ys = poly.map((p) => p.y).sort((a, b) => a - b);
    expect(ys).toEqual([-10, -10, 10, 10]);
  });
});

describe('calibrate', () => {
  it('rescales so the measured distance becomes the real distance, keeping p1 fixed', () => {
    const before = bg({ cmPerPx: 1, offset: { x: 0, y: 0 } });
    const p1 = { x: 100, y: 100 };
    const p2 = { x: 300, y: 100 }; // 200 cm at current scale
    const after = calibrate(before, p1, p2, 709);
    expect(after.cmPerPx).toBeCloseTo(709 / 200);
    expect(after.calibrated).toBe(true);
    // image pixel under p1 stays under p1
    const pxBefore = (p1.x - before.offset.x) / before.cmPerPx;
    expect(after.offset.x + pxBefore * after.cmPerPx).toBeCloseTo(p1.x);
    // and p2's pixel is now 709 cm from p1
    const px2 = (p2.x - before.offset.x) / before.cmPerPx;
    expect(after.offset.x + px2 * after.cmPerPx - p1.x).toBeCloseTo(709);
  });
  it('rejects a zero-length measurement', () => {
    expect(() => calibrate(bg(), { x: 1, y: 1 }, { x: 1, y: 1 }, 100)).toThrow();
  });
});

describe('pdfCmPerPx / formatLength', () => {
  it('converts a 1:50 PDF rendered at 72 dpi', () => {
    // 1 pt = 1/72 inch = 0.03528 cm on paper -> x50
    expect(pdfCmPerPx(72, 50)).toBeCloseTo(1.7639, 3);
  });
  it('formats lengths in Belgian notation', () => {
    expect(formatLength(368)).toBe('3,68 m');
    expect(formatLength(45)).toBe('45 cm');
  });
});

describe('backgroundExtent', () => {
  it('gives the plan size in cm from its pixel size and scale', () => {
    expect(backgroundExtent(bg({ widthPx: 1000, heightPx: 800, cmPerPx: 2.5 }))).toEqual({ width: 2500, height: 2000 });
  });
});

describe('backgroundCorners', () => {
  it('gives the top-left and bottom-right corner in world cm', () => {
    const corners = backgroundCorners(bg({ widthPx: 1000, heightPx: 800, cmPerPx: 2, offset: { x: -50, y: 10 } }));
    expect(corners).toEqual([{ x: -50, y: 10 }, { x: 1950, y: 1610 }]);
  });
});

describe('wallNormal', () => {
  it('is the unit vector perpendicular to the wall', () => {
    const n1 = wallNormal({ id: 'w', a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, thickness: 10 });
    expect(n1.x).toBeCloseTo(0);
    expect(n1.y).toBeCloseTo(1);
    const n2 = wallNormal({ id: 'w', a: { x: 0, y: 0 }, b: { x: 0, y: 50 }, thickness: 10 });
    expect(n2.x).toBeCloseTo(-1);
    expect(n2.y).toBeCloseTo(0);
  });
});
