import { describe, expect, it } from 'vitest';
import { calibrate, calibrateFloor } from './calibration';
import type { Background, Floor, Point, Wall } from './types';

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

const wall = (id: string, ax: number, ay: number, bx: number, by: number): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thickness: 10,
});

const floor = (over: Partial<Floor> = {}): Floor => ({
  id: 'f',
  name: 'Gelijkvloers',
  level: 0,
  background: bg({ cmPerPx: 0.8, offset: { x: -50, y: 20 } }),
  walls: [wall('w1', 100, 100, 500, 100), wall('w2', 500, 100, 500, 400)],
  ...over,
});

/** Where a world point lies on the plan image, in image pixels. */
const onPlan = (b: Background, p: Point): Point => ({
  x: (p.x - b.offset.x) / b.cmPerPx,
  y: (p.y - b.offset.y) / b.cmPerPx,
});

const p1 = { x: 100, y: 100 };
const p2 = { x: 300, y: 100 }; // 200 cm at the current scale

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

describe('calibrateFloor', () => {
  it('calibrates the background like calibrate()', () => {
    const f = floor();
    const expected = calibrate(f.background!, p1, p2, 500);
    calibrateFloor(f, p1, p2, 500);
    expect(f.background).toEqual(expected);
  });

  it('keeps every wall end on the same spot of the plan', () => {
    const f = floor();
    const before = f.walls.flatMap((w) => [onPlan(f.background!, w.a), onPlan(f.background!, w.b)]);
    calibrateFloor(f, p1, p2, 500);
    const after = f.walls.flatMap((w) => [onPlan(f.background!, w.a), onPlan(f.background!, w.b)]);
    after.forEach((p, i) => {
      expect(p.x).toBeCloseTo(before[i].x);
      expect(p.y).toBeCloseTo(before[i].y);
    });
  });

  it('scales wall lengths by the calibration factor, around the first point', () => {
    const f = floor();
    calibrateFloor(f, p1, p2, 500); // factor 2.5
    expect(f.walls[0].a.x).toBeCloseTo(100);
    expect(f.walls[0].a.y).toBeCloseTo(100);
    expect(f.walls[0].b.x).toBeCloseTo(1100);
    expect(f.walls[1].b.y).toBeCloseTo(850);
  });

  it('keeps the wall thickness', () => {
    const f = floor();
    calibrateFloor(f, p1, p2, 500);
    expect(f.walls.map((w) => w.thickness)).toEqual([10, 10]);
  });

  it('changes nothing when the calibration is invalid (identical points)', () => {
    const f = floor();
    const before = structuredClone(f);
    expect(() => calibrateFloor(f, p1, { ...p1 }, 500)).toThrow();
    expect(f).toEqual(before);
  });

  it('changes nothing on a floor without a plan', () => {
    const f = floor({ background: undefined });
    const before = structuredClone(f);
    calibrateFloor(f, p1, p2, 500);
    expect(f).toEqual(before);
  });
});
