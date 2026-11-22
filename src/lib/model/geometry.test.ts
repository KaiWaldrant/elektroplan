import { describe, expect, it } from 'vitest';
import {
  atLength,
  pointInPolygon,
  polygonArea,
  backgroundCorners,
  backgroundExtent,
  dist,
  formatLength,
  hitWall,
  nearestPoint,
  pdfCmPerPx,
  projectOnSegment,
  snapAngle,
  wallNormal,
  wallPolygon,
  wallShapes,
  withLength,
} from './geometry';
import type { Background, Point, Wall } from './types';

const bg = (over: Partial<Background> = {}): Background => ({
  blobKey: 'k',
  name: 'plan',
  widthPx: 1000,
  heightPx: 800,
  cmPerPx: 1,
  offset: { x: 0, y: 0 },
  opacity: 0.5,
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

const wall = (id: string, a: Point, b: Point, thickness = 20): Wall => ({ id, a, b, thickness });

/** Compare polygons point by point, allowing float noise. */
function expectPolygon(actual: Point[] | undefined, expected: Point[]) {
  expect(actual?.map((p) => [round(p.x), round(p.y)])).toEqual(expected.map((p) => [round(p.x), round(p.y)]));
}
/** Round to 0.001; `+ 0` turns -0 into 0 so toEqual does not trip on it. */
const round = (v: number) => Math.round(v * 1000) / 1000 + 0;

describe('wallShapes', () => {
  it('draws a lone wall as its plain rectangle', () => {
    const shapes = wallShapes([wall('w', { x: 0, y: 0 }, { x: 100, y: 0 })]);
    expectPolygon(shapes.get('w'), [
      { x: 0, y: -10 },
      { x: 0, y: 10 },
      { x: 100, y: 10 },
      { x: 100, y: -10 },
    ]);
  });

  it('mitres an L-corner: both walls end on the outer and inner corner point', () => {
    const shapes = wallShapes([wall('w1', { x: 0, y: 0 }, { x: 100, y: 0 }), wall('w2', { x: 100, y: 0 }, { x: 100, y: 100 })]);
    expectPolygon(shapes.get('w1'), [
      { x: 0, y: -10 },
      { x: 0, y: 10 },
      { x: 90, y: 10 },
      { x: 100, y: 0 },
      { x: 110, y: -10 },
    ]);
    expectPolygon(shapes.get('w2'), [
      { x: 110, y: -10 },
      { x: 100, y: 0 },
      { x: 90, y: 10 },
      { x: 90, y: 100 },
      { x: 110, y: 100 },
    ]);
  });

  it('mitres walls of different thickness on the corner of their faces', () => {
    const shapes = wallShapes([
      wall('w1', { x: 0, y: 0 }, { x: 100, y: 0 }, 20),
      wall('w2', { x: 100, y: 0 }, { x: 100, y: 100 }, 10),
    ]);
    expectPolygon(shapes.get('w1'), [
      { x: 0, y: -10 },
      { x: 0, y: 10 },
      { x: 95, y: 10 },
      { x: 100, y: 0 },
      { x: 105, y: -10 },
    ]);
    expectPolygon(shapes.get('w2'), [
      { x: 105, y: -10 },
      { x: 100, y: 0 },
      { x: 95, y: 10 },
      { x: 95, y: 100 },
      { x: 105, y: 100 },
    ]);
  });

  it('ends a straight join square, with a step where the thickness changes', () => {
    const shapes = wallShapes([
      wall('w1', { x: 0, y: 0 }, { x: 100, y: 0 }, 20),
      wall('w2', { x: 100, y: 0 }, { x: 200, y: 0 }, 10),
    ]);
    expectPolygon(shapes.get('w1'), [
      { x: 0, y: -10 },
      { x: 0, y: 10 },
      { x: 100, y: 10 },
      { x: 100, y: 0 },
      { x: 100, y: -10 },
    ]);
    expectPolygon(shapes.get('w2'), [
      { x: 100, y: -5 },
      { x: 100, y: 0 },
      { x: 100, y: 5 },
      { x: 200, y: 5 },
      { x: 200, y: -5 },
    ]);
  });

  it('joins three walls at one point without a gap or overlap', () => {
    const shapes = wallShapes([
      wall('w1', { x: 0, y: 0 }, { x: 100, y: 0 }),
      wall('w2', { x: 100, y: 0 }, { x: 200, y: 0 }),
      wall('w3', { x: 100, y: 0 }, { x: 100, y: 100 }),
    ]);
    expectPolygon(shapes.get('w1'), [
      { x: 0, y: -10 },
      { x: 0, y: 10 },
      { x: 90, y: 10 },
      { x: 100, y: 0 },
      { x: 100, y: -10 },
    ]);
    expectPolygon(shapes.get('w2'), [
      { x: 100, y: -10 },
      { x: 100, y: 0 },
      { x: 110, y: 10 },
      { x: 200, y: 10 },
      { x: 200, y: -10 },
    ]);
    expectPolygon(shapes.get('w3'), [
      { x: 110, y: 10 },
      { x: 100, y: 0 },
      { x: 90, y: 10 },
      { x: 90, y: 100 },
      { x: 110, y: 100 },
    ]);
  });

  it('bevels a nearly folded join instead of a long mitre spike', () => {
    const shapes = wallShapes([wall('w1', { x: 0, y: 0 }, { x: 100, y: 0 }), wall('w2', { x: 100, y: 0 }, { x: 0, y: 20 })]);
    // A mitre would reach about 100 cm past the corner; a bevel stays within the thickness.
    for (const p of [...shapes.get('w1')!, ...shapes.get('w2')!]) expect(p.x).toBeLessThanOrEqual(110);
  });

  it('does not mitre past the far end of a wall shorter than the corner', () => {
    const shapes = wallShapes([wall('w1', { x: 0, y: 0 }, { x: 100, y: 0 }), wall('w2', { x: 100, y: 0 }, { x: 100, y: 5 })]);
    // The inner mitre (90,10) lies past w2's far end; w2 ends square there instead of crossing itself.
    expectPolygon(shapes.get('w2'), [
      { x: 110, y: -10 },
      { x: 100, y: 0 },
      { x: 90, y: 0 },
      { x: 90, y: 5 },
      { x: 110, y: 5 },
    ]);
  });

  it('limits a mitre by the thinner wall, so a thin wall gets no spike at a sharp corner', () => {
    const node = { x: 100, y: 0 };
    const shapes = wallShapes([wall('w1', { x: 0, y: 0 }, node, 40), wall('w2', node, { x: 20, y: 50 }, 5)]);
    // Away from the far ends, nothing reaches further from the corner than the thick wall's face.
    for (const p of [...shapes.get('w1')!, ...shapes.get('w2')!]) {
      if (dist(p, node) < 60) expect(dist(p, node)).toBeLessThanOrEqual(20 + 1.5 * 5);
    }
  });

  it('puts each wall end in one corner only when ends lie just apart', () => {
    const shapes = wallShapes([
      wall('w1', { x: 0, y: 0 }, { x: 100, y: 0 }),
      wall('w2', { x: 100.4, y: 0 }, { x: 100.4, y: 100 }),
      wall('w3', { x: 100.8, y: 0 }, { x: 200, y: 0 }),
    ]);
    // w1 and w2 form one corner, so w2 must end on w1's outer mitre point.
    const outer = shapes.get('w1')!.at(-1)!;
    expect(shapes.get('w2')!.some((p) => dist(p, outer) < 1e-9)).toBe(true);
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

describe('pointInPolygon', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];
  // an L-shaped room: the square without its top-right quarter
  const ell = [
    { x: 0, y: 0 },
    { x: 50, y: 0 },
    { x: 50, y: 50 },
    { x: 100, y: 50 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  it('is true inside and false outside', () => {
    expect(pointInPolygon({ x: 50, y: 50 }, square)).toBe(true);
    expect(pointInPolygon({ x: 150, y: 50 }, square)).toBe(false);
    expect(pointInPolygon({ x: 50, y: -1 }, square)).toBe(false);
  });

  it('follows a concave outline', () => {
    expect(pointInPolygon({ x: 25, y: 25 }, ell)).toBe(true);
    expect(pointInPolygon({ x: 75, y: 25 }, ell)).toBe(false);
    expect(pointInPolygon({ x: 75, y: 75 }, ell)).toBe(true);
  });

  it('does not depend on the drawing direction', () => {
    expect(pointInPolygon({ x: 25, y: 75 }, [...ell].reverse())).toBe(true);
    expect(pointInPolygon({ x: 75, y: 25 }, [...ell].reverse())).toBe(false);
  });

  it('is false for fewer than three corners', () => {
    expect(pointInPolygon({ x: 0, y: 0 }, square.slice(0, 2))).toBe(false);
  });
});

describe('polygonArea', () => {
  it('is the area in cm², whatever the drawing direction', () => {
    const rect = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 300 },
      { x: 0, y: 300 },
    ];
    expect(polygonArea(rect)).toBe(120000);
    expect(polygonArea([...rect].reverse())).toBe(120000);
  });
});
