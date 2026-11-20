import { describe, expect, it } from 'vitest';
import { blobKeys, createProject } from './project';

describe('createProject', () => {
  it('starts with one ground floor', () => {
    const p = createProject();
    expect(p.floors).toHaveLength(1);
    expect(p.floors[0].level).toBe(0);
  });
});

describe('blobKeys', () => {
  it('lists the plan image of every floor that has one', () => {
    const p = createProject();
    p.floors.push({ id: 'f2', name: 'Verdieping 1', level: 300, walls: [] });
    p.floors[1].background = {
      blobKey: 'b2', name: 'plan.png', widthPx: 10, heightPx: 10, cmPerPx: 1,
      offset: { x: 0, y: 0 }, opacity: 0.5, calibrated: false,
    };
    expect(blobKeys(p)).toEqual(['b2']);
  });
});
