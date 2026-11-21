import { describe, expect, it } from 'vitest';
import {
  devicesOnFloor,
  hitDevice,
  moveDevice,
  placeDevice,
  positionAt,
  removeDevice,
  rotateDevice,
  selectedDevice,
  setDeviceKind,
  snapToWall,
  symbolReach,
} from './devices';
import { createFloor, createProject, removeFloor } from './project';
import type { DeviceKind, Project, Wall } from './types';

const ceiling: DeviceKind = { type: 'lightPoint', mount: 'ceiling' };
const placeLightPoint = (p: Project, floorId: string, at: { x: number; y: number }) => placeDevice(p, floorId, ceiling, at);

function twoFloors(): Project {
  const p = createProject();
  p.floors[0].id = 'f0';
  p.floors.push({ ...createFloor('Verdieping 1', 300), id: 'f1' });
  return p;
}

describe('placeDevice', () => {
  it('adds a Toestel of the given kind on the floor, at whole cm, not turned', () => {
    const p = twoFloors();
    const d = placeDevice(p, 'f0', ceiling, { x: 120.4, y: 79.6 });
    expect(p.devices).toEqual([d]);
    expect(d).toMatchObject({ type: 'lightPoint', mount: 'ceiling', placement: { floorId: 'f0', at: { x: 120, y: 80 }, rotation: 0 } });
    expect(d.id).toBeTruthy();
  });
  it('keeps the variant and the rotation it is given', () => {
    const p = twoFloors();
    const d = placeDevice(p, 'f0', { type: 'switch', variant: 'dimmer' }, { x: 0, y: 0 }, 270);
    expect(d).toMatchObject({ type: 'switch', variant: 'dimmer', placement: { rotation: 270 } });
  });
});

describe('devicesOnFloor', () => {
  it('lists only the Toestellen placed on that floor', () => {
    const p = twoFloors();
    const a = placeLightPoint(p, 'f0', { x: 0, y: 0 });
    placeLightPoint(p, 'f1', { x: 0, y: 0 });
    p.devices.push({ id: 'unplaced', ...ceiling });
    expect(devicesOnFloor(p.devices, 'f0')).toEqual([a]);
  });
});

describe('symbolReach', () => {
  it('is half the symbol size, or more for a Contactdoos with its appliance in front', () => {
    expect(symbolReach({ type: 'socket' })).toBe(15);
    expect(symbolReach({ type: 'fan', mount: 'wall' })).toBe(15);
    expect(symbolReach({ type: 'socket', appliance: 'oven' })).toBe(25);
  });
});

describe('hitDevice', () => {
  it('finds the nearest Toestel on the floor within its symbol reach plus the slack', () => {
    const p = twoFloors();
    placeLightPoint(p, 'f0', { x: 0, y: 0 });
    const near = placeLightPoint(p, 'f0', { x: 20, y: 0 });
    placeLightPoint(p, 'f1', { x: 14, y: 0 });
    expect(hitDevice(p.devices, 'f0', { x: 14, y: 0 }, 0)).toBe(near);
  });
  it('is undefined when nothing is within reach', () => {
    const p = twoFloors();
    placeLightPoint(p, 'f0', { x: 0, y: 0 });
    expect(hitDevice(p.devices, 'f0', { x: 16, y: 0 }, 0)).toBeUndefined();
    expect(hitDevice(p.devices, 'f0', { x: 16, y: 0 }, 2)).toBeDefined();
  });
  it('finds a Contactdoos by the appliance in front of it', () => {
    const p = twoFloors();
    const dedicated = placeDevice(p, 'f0', { type: 'socket', appliance: 'washingMachine' }, { x: 0, y: 0 });
    placeDevice(p, 'f0', { type: 'socket' }, { x: 100, y: 0 });
    expect(hitDevice(p.devices, 'f0', { x: 0, y: -22 }, 0)).toBe(dedicated);
    expect(hitDevice(p.devices, 'f0', { x: 100, y: -22 }, 0)).toBeUndefined();
  });
});

describe('moveDevice', () => {
  it('moves a Toestel to a new spot at whole cm, on the same floor', () => {
    const p = twoFloors();
    const d = placeLightPoint(p, 'f0', { x: 0, y: 0 });
    moveDevice(p.devices, d.id, { x: 50.6, y: -10.2 });
    expect(d.placement).toEqual({ floorId: 'f0', at: { x: 51, y: -10 }, rotation: 0 });
  });
  it('can also turn it, e.g. when it snaps to a wall', () => {
    const p = twoFloors();
    const d = placeLightPoint(p, 'f0', { x: 0, y: 0 });
    moveDevice(p.devices, d.id, { x: 5, y: 5 }, 180);
    expect(d.placement?.rotation).toBe(180);
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
    p.devices.push({ id: 'unplaced', ...ceiling });
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

describe('rotateDevice', () => {
  it('turns a Toestel 90° clockwise, back to 0 after a full turn', () => {
    const p = twoFloors();
    const d = placeLightPoint(p, 'f0', { x: 0, y: 0 });
    rotateDevice(p.devices, d.id);
    expect(d.placement?.rotation).toBe(90);
    rotateDevice(p.devices, d.id);
    rotateDevice(p.devices, d.id);
    rotateDevice(p.devices, d.id);
    expect(d.placement?.rotation).toBe(0);
  });
});

describe('setDeviceKind', () => {
  const walls: Wall[] = [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10 }];

  it('changes the variant and keeps id and placement', () => {
    const p = twoFloors();
    const d = placeDevice(p, 'f0', { type: 'switch', variant: 'singlePole' }, { x: 5, y: 200 }, 90);
    setDeviceKind(p.devices, walls, d.id, { type: 'switch', variant: 'twoWay' });
    expect(p.devices[0]).toEqual({ id: d.id, type: 'switch', variant: 'twoWay', placement: d.placement });
  });
  it('drops fields of the old kind', () => {
    const p = twoFloors();
    const d = placeLightPoint(p, 'f0', { x: 0, y: 200 });
    setDeviceKind(p.devices, walls, d.id, { type: 'pushButton' });
    expect(p.devices[0]).not.toHaveProperty('mount');
  });
  it('drops the appliance when a dedicated Contactdoos becomes a plain one', () => {
    const p = twoFloors();
    const d = placeDevice(p, 'f0', { type: 'socket', appliance: 'washingMachine' }, { x: 100, y: 20 }, 180);
    setDeviceKind(p.devices, walls, d.id, { type: 'socket' });
    expect(p.devices[0]).not.toHaveProperty('appliance');
  });
  it('turns a Ventilator back to 0 when it becomes a ceiling one', () => {
    const p = twoFloors();
    const d = placeDevice(p, 'f0', { type: 'fan', mount: 'wall' }, { x: 100, y: 20 }, 180);
    setDeviceKind(p.devices, walls, d.id, { type: 'fan', mount: 'ceiling' });
    expect(p.devices[0].placement).toEqual({ floorId: 'f0', at: { x: 100, y: 20 }, rotation: 0 });
  });
  it('turns a Toestel back to 0 when it becomes a ceiling Lichtpunt', () => {
    const p = twoFloors();
    const d = placeDevice(p, 'f0', { type: 'lightPoint', mount: 'wall' }, { x: 100, y: 20 }, 180);
    setDeviceKind(p.devices, walls, d.id, ceiling);
    expect(p.devices[0].placement).toEqual({ floorId: 'f0', at: { x: 100, y: 20 }, rotation: 0 });
  });
  it('snaps a Toestel to a near wall when it becomes wall-mounted, like a drop', () => {
    const p = twoFloors();
    const d = placeLightPoint(p, 'f0', { x: 100, y: 25 });
    setDeviceKind(p.devices, walls, d.id, { type: 'lightPoint', mount: 'wall' });
    expect(p.devices[0].placement).toEqual({ floorId: 'f0', at: { x: 100, y: 20 }, rotation: 180 });
  });
});

describe('snapToWall', () => {
  // a horizontal wall from (0,0) to (400,0), 10 cm thick
  const walls: Wall[] = [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10 }];

  it('puts the Toestel against the wall face on the pointer side, turned to face the wall', () => {
    expect(snapToWall(walls, { x: 100.4, y: 20 }, 30)).toEqual({ at: { x: 100, y: 5 }, rotation: 180 });
    expect(snapToWall(walls, { x: 100, y: -20 }, 30)).toEqual({ at: { x: 100, y: -5 }, rotation: 0 });
  });

  it('turns to follow a vertical wall', () => {
    const vertical: Wall[] = [{ id: 'v', a: { x: 0, y: 0 }, b: { x: 0, y: 400 }, thickness: 20 }];
    expect(snapToWall(vertical, { x: 25, y: 100 }, 30)).toEqual({ at: { x: 10, y: 100 }, rotation: 90 });
    expect(snapToWall(vertical, { x: -25, y: 100 }, 30)).toEqual({ at: { x: -10, y: 100 }, rotation: 270 });
  });

  it('only snaps within the tolerance from the wall face', () => {
    expect(snapToWall(walls, { x: 100, y: 34 }, 30)).toEqual({ at: { x: 100, y: 5 }, rotation: 180 });
    expect(snapToWall(walls, { x: 100, y: 36 }, 30)).toBeNull();
  });

  it('can keep the symbol centre a standoff away from the wall face', () => {
    expect(snapToWall(walls, { x: 100, y: 20 }, 30, 15)).toEqual({ at: { x: 100, y: 20 }, rotation: 180 });
    expect(snapToWall(walls, { x: 100, y: -3 }, 30, 15)).toEqual({ at: { x: 100, y: -20 }, rotation: 0 });
  });

  it('picks the nearest wall', () => {
    const two: Wall[] = [...walls, { id: 'w2', a: { x: 0, y: 50 }, b: { x: 400, y: 50 }, thickness: 10 }];
    expect(snapToWall(two, { x: 100, y: 30 }, 30)?.at).toEqual({ x: 100, y: 45 });
  });
});

describe('positionAt', () => {
  const walls: Wall[] = [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10 }];
  const sw: DeviceKind = { type: 'switch', variant: 'singlePole' };

  it('snaps a wall-mounted Toestel beside a near wall, turned to it', () => {
    expect(positionAt(sw, walls, { x: 100, y: 25 }, false)).toEqual({ at: { x: 100, y: 20 }, rotation: 180 });
  });
  it('leaves it loose away from walls, or when free (Alt)', () => {
    expect(positionAt(sw, walls, { x: 100, y: 200 }, false)).toEqual({ at: { x: 100, y: 200 } });
    expect(positionAt(sw, walls, { x: 100, y: 25 }, true)).toEqual({ at: { x: 100, y: 25 } });
  });
  it('never snaps a ceiling Lichtpunt or ceiling Ventilator', () => {
    expect(positionAt(ceiling, walls, { x: 100, y: 25 }, false)).toEqual({ at: { x: 100, y: 25 } });
    expect(positionAt({ type: 'fan', mount: 'ceiling' }, walls, { x: 100, y: 25 }, false)).toEqual({ at: { x: 100, y: 25 } });
  });
  it('snaps a Contactdoos, Datacontactdoos and wall Ventilator like any wall-mounted Toestel', () => {
    const kinds: DeviceKind[] = [{ type: 'socket', appliance: 'hob' }, { type: 'dataOutlet' }, { type: 'fan', mount: 'wall' }];
    for (const kind of kinds)
      expect(positionAt(kind, walls, { x: 100, y: 25 }, false)).toEqual({ at: { x: 100, y: 20 }, rotation: 180 });
  });
});
