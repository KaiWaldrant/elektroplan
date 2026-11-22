import { describe, expect, it } from 'vitest';
import { calibrate, calibrateFloor } from './calibration';
import { PROJECT_VERSION, type Background, type Device, type Floor, type Point, type Project, type Wall } from './types';

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
  rooms: [{ id: 'r1', name: 'Keuken', polygon: [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 400 }] }],
  ...over,
});

const lightPoint = (id: string, floorId: string, x: number, y: number): Device => ({
  id,
  type: 'lightPoint',
  mount: 'ceiling',
  placement: { floorId, at: { x, y }, rotation: 0 },
});

/** A project with floor 'f' (plan, walls, one Lichtpunt), floor 'other' (one Lichtpunt) and an unplaced Lichtpunt. */
const project = (over: Partial<Floor> = {}): Project => ({
  version: PROJECT_VERSION,
  id: 'p',
  name: 'Voorbeeld',
  floors: [floor(over), { id: 'other', name: 'Verdieping 1', level: 300, walls: [], rooms: [] }],
  devices: [lightPoint('d1', 'f', 300, 300), lightPoint('d2', 'other', 300, 300), { id: 'd3', type: 'lightPoint', mount: 'ceiling' }],
  gangs: [],
  createdAt: '',
  updatedAt: '',
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
    const pr = project();
    const expected = calibrate(pr.floors[0].background!, p1, p2, 500);
    calibrateFloor(pr, 'f', p1, p2, 500);
    expect(pr.floors[0].background).toEqual(expected);
  });

  it('keeps every wall end, Ruimte corner and Toestel on the same spot of the plan', () => {
    const pr = project();
    const f = pr.floors[0];
    const points = () => [...f.walls.flatMap((w) => [w.a, w.b]), ...f.rooms[0].polygon, pr.devices[0].placement!.at];
    const before = points().map((p) => onPlan(f.background!, p));
    calibrateFloor(pr, 'f', p1, p2, 500);
    const after = points().map((p) => onPlan(f.background!, p));
    after.forEach((p, i) => {
      expect(p.x).toBeCloseTo(before[i].x);
      expect(p.y).toBeCloseTo(before[i].y);
    });
  });

  it('scales wall lengths by the calibration factor, around the first point', () => {
    const pr = project();
    calibrateFloor(pr, 'f', p1, p2, 500); // factor 2.5
    const [w1, w2] = pr.floors[0].walls;
    expect(w1.a.x).toBeCloseTo(100);
    expect(w1.a.y).toBeCloseTo(100);
    expect(w1.b.x).toBeCloseTo(1100);
    expect(w2.b.y).toBeCloseTo(850);
    expect(pr.devices[0].placement!.at.x).toBeCloseTo(600);
    expect(pr.devices[0].placement!.rotation).toBe(0);
  });

  it('keeps the wall thickness', () => {
    const pr = project();
    calibrateFloor(pr, 'f', p1, p2, 500);
    expect(pr.floors[0].walls.map((w) => w.thickness)).toEqual([10, 10]);
  });

  it('leaves other floors and unplaced Toestellen alone', () => {
    const pr = project();
    const before = structuredClone(pr);
    calibrateFloor(pr, 'f', p1, p2, 500);
    expect(pr.floors[1]).toEqual(before.floors[1]);
    expect(pr.devices.slice(1)).toEqual(before.devices.slice(1));
  });

  it('changes nothing when the calibration is invalid (identical points)', () => {
    const pr = project();
    const before = structuredClone(pr);
    expect(() => calibrateFloor(pr, 'f', p1, { ...p1 }, 500)).toThrow();
    expect(pr).toEqual(before);
  });

  it('changes nothing on a floor without a plan, or an unknown floor', () => {
    const pr = project({ background: undefined });
    const before = structuredClone(pr);
    calibrateFloor(pr, 'f', p1, p2, 500);
    calibrateFloor(pr, 'gone', p1, p2, 500);
    expect(pr).toEqual(before);
  });
});
