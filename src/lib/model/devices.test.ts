import { describe, expect, it } from 'vitest';
import { devicesOnFloor, hitDevice, moveDevice, placeLightPoint, removeDevice, selectedDevice } from './devices';
import { createFloor, createProject, removeFloor } from './project';
import type { Project } from './types';

function twoFloors(): Project {
  const p = createProject();
  p.floors[0].id = 'f0';
  p.floors.push({ ...createFloor('Verdieping 1', 300), id: 'f1' });
  return p;
}

describe('placeLightPoint', () => {
  it('adds a Lichtpunt on the floor, at whole cm', () => {
    const p = twoFloors();
    const d = placeLightPoint(p, 'f0', { x: 120.4, y: 79.6 });
    expect(p.devices).toEqual([d]);
    expect(d).toMatchObject({ type: 'lightPoint', placement: { floorId: 'f0', at: { x: 120, y: 80 } } });
    expect(d.id).toBeTruthy();
  });
});

describe('devicesOnFloor', () => {
  it('lists only the Toestellen placed on that floor', () => {
    const p = twoFloors();
    const a = placeLightPoint(p, 'f0', { x: 0, y: 0 });
    placeLightPoint(p, 'f1', { x: 0, y: 0 });
    p.devices.push({ id: 'unplaced', type: 'lightPoint' });
    expect(devicesOnFloor(p.devices, 'f0')).toEqual([a]);
  });
});

describe('hitDevice', () => {
  it('finds the nearest Toestel on the floor within the radius', () => {
    const p = twoFloors();
    placeLightPoint(p, 'f0', { x: 0, y: 0 });
    const near = placeLightPoint(p, 'f0', { x: 20, y: 0 });
    placeLightPoint(p, 'f1', { x: 14, y: 0 });
    expect(hitDevice(p.devices, 'f0', { x: 14, y: 0 }, 15)).toBe(near);
  });
  it('is undefined when nothing is within the radius', () => {
    const p = twoFloors();
    placeLightPoint(p, 'f0', { x: 0, y: 0 });
    expect(hitDevice(p.devices, 'f0', { x: 16, y: 0 }, 15)).toBeUndefined();
  });
});

describe('moveDevice', () => {
  it('moves a Toestel to a new spot at whole cm, on the same floor', () => {
    const p = twoFloors();
    const d = placeLightPoint(p, 'f0', { x: 0, y: 0 });
    moveDevice(p.devices, d.id, { x: 50.6, y: -10.2 });
    expect(d.placement).toEqual({ floorId: 'f0', at: { x: 51, y: -10 } });
  });
});

describe('removeDevice', () => {
  it('deletes the Toestel', () => {
    const p = twoFloors();
    const d = placeLightPoint(p, 'f0', { x: 0, y: 0 });
    const keep = placeLightPoint(p, 'f0', { x: 50, y: 0 });
    removeDevice(p, d.id);
    expect(p.devices).toEqual([keep]);
  });
});

describe('selectedDevice', () => {
  it('finds the selected Toestel when it is on the shown floor', () => {
    const p = twoFloors();
    const d = placeLightPoint(p, 'f0', { x: 0, y: 0 });
    expect(selectedDevice(p.devices, 'f0', { kind: 'device', id: d.id })).toBe(d);
  });
  it('is undefined for a Toestel on another floor, a wall selection or no selection', () => {
    const p = twoFloors();
    const d = placeLightPoint(p, 'f1', { x: 0, y: 0 });
    expect(selectedDevice(p.devices, 'f0', { kind: 'device', id: d.id })).toBeUndefined();
    expect(selectedDevice(p.devices, 'f1', { kind: 'wall', id: d.id })).toBeUndefined();
    expect(selectedDevice(p.devices, 'f1', null)).toBeUndefined();
  });
});

describe('removeFloor', () => {
  it('deletes the floor and the Toestellen placed on it', () => {
    const p = twoFloors();
    placeLightPoint(p, 'f1', { x: 0, y: 0 });
    const keep = placeLightPoint(p, 'f0', { x: 0, y: 0 });
    p.devices.push({ id: 'unplaced', type: 'lightPoint' });
    removeFloor(p, 'f1');
    expect(p.floors.map((f) => f.id)).toEqual(['f0']);
    expect(p.devices.map((d) => d.id)).toEqual([keep.id, 'unplaced']);
  });
  it('never deletes the last floor', () => {
    const p = createProject();
    removeFloor(p, p.floors[0].id);
    expect(p.floors).toHaveLength(1);
  });
});
