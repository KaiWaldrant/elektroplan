import { describe, expect, it } from 'vitest';
import type { Wall } from '../../model/types';
import { snapPoint } from './snapping';

const wall = (id: string, ax: number, ay: number, bx: number, by: number): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thickness: 10,
});

const walls = [wall('w1', 0, 0, 1000, 0)];
const tolerance = 10;

describe('snapPoint', () => {
  it('snaps to a wall end within the tolerance and marks it', () => {
    const r = snapPoint(walls, { x: 1004.3, y: 6 }, { tolerance });
    expect(r).toEqual({ point: { x: 1000, y: 0 }, mark: { x: 1000, y: 0 } });
  });

  it('prefers a wall end over the wall itself', () => {
    const r = snapPoint(walls, { x: 7, y: 2 }, { tolerance });
    expect(r.point).toEqual({ x: 0, y: 0 });
  });

  it('ignores excluded wall ends and the walls they belong to', () => {
    const r = snapPoint(walls, { x: 1004, y: 6 }, { tolerance, exclude: [{ wallId: 'w1', end: 'b' }] });
    expect(r).toEqual({ point: { x: 1004, y: 6 }, mark: null });
  });

  it('snaps onto a wall within the tolerance, rounded to whole cm', () => {
    const r = snapPoint(walls, { x: 500.4, y: 7 }, { tolerance });
    expect(r).toEqual({ point: { x: 500, y: 0 }, mark: { x: 500, y: 0 } });
  });

  it('snaps the direction from `from` to multiples of 15°', () => {
    const r = snapPoint([], { x: 100, y: 3 }, { tolerance, from: { x: 0, y: 0 } });
    expect(r).toEqual({ point: { x: 100, y: 0 }, mark: null });
  });

  it('only rounds when free (Alt), but still snaps to wall ends', () => {
    expect(snapPoint(walls, { x: 500.4, y: 7.6 }, { tolerance, from: { x: 0, y: 0 }, free: true })).toEqual({
      point: { x: 500, y: 8 },
      mark: null,
    });
    expect(snapPoint(walls, { x: 3, y: 3 }, { tolerance, free: true }).point).toEqual({ x: 0, y: 0 });
  });

  it('just rounds when nothing is near', () => {
    expect(snapPoint(walls, { x: 300.6, y: 200.2 }, { tolerance })).toEqual({ point: { x: 301, y: 200 }, mark: null });
  });

  it('returns copies, not the wall points themselves', () => {
    const r = snapPoint(walls, { x: 1, y: 1 }, { tolerance });
    expect(r.point).not.toBe(walls[0].a);
    expect(r.mark).not.toBe(walls[0].a);
  });
});
