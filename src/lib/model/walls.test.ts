import { describe, expect, it } from 'vitest';
import { wallNormal } from './geometry';
import { connectedEnds, moveEnds, selectedWall, setWallLength, translateWall } from './walls';
import type { Wall } from './types';

const wall = (id: string, ax: number, ay: number, bx: number, by: number): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thickness: 10,
});

describe('wallNormal', () => {
  it('is the unit vector perpendicular to the wall', () => {
    const n1 = wallNormal(wall('w', 0, 0, 100, 0));
    expect([n1.x + 0, n1.y]).toEqual([0, 1]);
    const n2 = wallNormal(wall('w', 0, 0, 0, 50));
    expect([n2.x, n2.y + 0]).toEqual([-1, 0]);
  });
});

describe('selectedWall', () => {
  const floor = { walls: [wall('w1', 0, 0, 100, 0), wall('w2', 100, 0, 100, 100)] };
  it('finds the selected wall by id', () => {
    expect(selectedWall(floor, { kind: 'wall', id: 'w2' })?.id).toBe('w2');
  });
  it('is undefined without a selection or for an unknown id', () => {
    expect(selectedWall(floor, null)).toBeUndefined();
    expect(selectedWall(floor, { kind: 'wall', id: 'gone' })).toBeUndefined();
  });
});

describe('connectedEnds', () => {
  const walls = [wall('w1', 0, 0, 100, 0), wall('w2', 100, 0, 100, 100), wall('w3', 200, 0, 100, 0)];
  it('lists every wall end at a point', () => {
    expect(connectedEnds(walls, { x: 100, y: 0 })).toEqual([
      { wallId: 'w1', end: 'b' },
      { wallId: 'w2', end: 'a' },
      { wallId: 'w3', end: 'b' },
    ]);
  });
  it('can leave one wall out', () => {
    expect(connectedEnds(walls, { x: 100, y: 0 }, 'w1')).toEqual([
      { wallId: 'w2', end: 'a' },
      { wallId: 'w3', end: 'b' },
    ]);
  });
});

describe('moveEnds', () => {
  it('moves the given wall ends to one point and leaves the rest', () => {
    const walls = [wall('w1', 0, 0, 100, 0), wall('w2', 100, 0, 100, 100)];
    moveEnds(walls, [{ wallId: 'w1', end: 'b' }, { wallId: 'w2', end: 'a' }], { x: 120, y: 10 });
    expect(walls[0].a).toEqual({ x: 0, y: 0 });
    expect(walls[0].b).toEqual({ x: 120, y: 10 });
    expect(walls[1].a).toEqual({ x: 120, y: 10 });
    expect(walls[1].b).toEqual({ x: 100, y: 100 });
  });
});

describe('setWallLength', () => {
  it('moves end b to the new length and connected walls follow', () => {
    const walls = [wall('w1', 0, 0, 100, 0), wall('w2', 100, 0, 100, 100), wall('w3', 0, 0, 0, 100)];
    setWallLength(walls, 'w1', 250);
    expect(walls[0].b).toEqual({ x: 250, y: 0 });
    expect(walls[1].a).toEqual({ x: 250, y: 0 });
    expect(walls[2].a).toEqual({ x: 0, y: 0 });
  });
});

describe('translateWall', () => {
  it('moves a wall from its start position and drags the connected ends along', () => {
    const start = [wall('w1', 0, 0, 100, 0), wall('w2', 100, 0, 100, 100), wall('w3', 500, 500, 600, 500)];
    const walls = structuredClone(start);
    translateWall(walls, start, 'w1', 10, 20);
    expect(walls[0].a).toEqual({ x: 10, y: 20 });
    expect(walls[0].b).toEqual({ x: 110, y: 20 });
    expect(walls[1].a).toEqual({ x: 110, y: 20 });
    expect(walls[1].b).toEqual({ x: 100, y: 100 });
    expect(walls[2]).toEqual(start[2]);
  });
  it('is measured from the start position, so repeated calls do not add up', () => {
    const start = [wall('w1', 0, 0, 100, 0)];
    const walls = structuredClone(start);
    translateWall(walls, start, 'w1', 10, 0);
    translateWall(walls, start, 'w1', 15, 0);
    expect(walls[0].a).toEqual({ x: 15, y: 0 });
  });
});
