import { describe, expect, it } from 'vitest';
import { placeDevice, removeDevice, setDeviceKind } from './devices';
import {
  gangFinish,
  gangMembers,
  joinGang,
  leaveGang,
  moveGang,
  removeDeviceAndCloseGang,
  rotateGang,
  setGangFinish,
  setDeviceKindInGang,
  setGangOrientation,
  tidyGangs,
} from './gangs';
import { createFloor, createProject, removeFloor } from './project';
import type { DeviceKind, Point, Project } from './types';

const socket: DeviceKind = { type: 'socket' };
const at = (p: Project, id: string): Point | undefined => p.devices.find((d) => d.id === id)?.placement?.at;

/** A project with one floor 'f0' and wall-mounted Toestellen at the given spots, not turned (wall side down). */
function withSockets(...spots: Point[]): { p: Project; ids: string[] } {
  const p = createProject();
  p.floors[0].id = 'f0';
  const ids = spots.map((s) => placeDevice(p, 'f0', socket, s).id);
  return { p, ids };
}

describe('joinGang', () => {
  it('makes a horizontal Combinatie of two, side by side on the end where it is dropped', () => {
    const { p, ids: [a, b] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 });
    joinGang(p, b, a, { x: 110, y: 100 });
    expect(p.gangs).toEqual([{ id: expect.any(String), deviceIds: [a, b], orientation: 'horizontal' }]);
    expect(at(p, a)).toEqual({ x: 100, y: 100 });
    expect(at(p, b)).toEqual({ x: 130, y: 100 });
    expect(gangMembers(p, a).map((d) => d.id)).toEqual([a, b]);
  });

  it('puts it before the first one when dropped on that end; the others stay where they are', () => {
    const { p, ids: [a, b, c] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 }, { x: 500, y: 300 });
    joinGang(p, b, a, { x: 110, y: 100 });
    joinGang(p, c, a, { x: 95, y: 102 });
    expect(p.gangs[0].deviceIds).toEqual([c, a, b]);
    expect([at(p, c), at(p, a), at(p, b)]).toEqual([{ x: 70, y: 100 }, { x: 100, y: 100 }, { x: 130, y: 100 }]);
  });

  it('extends a Combinatie at its far end when dropped there', () => {
    const { p, ids: [a, b, c] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 }, { x: 500, y: 300 });
    joinGang(p, b, a, { x: 110, y: 100 });
    joinGang(p, c, b, { x: 135, y: 100 });
    expect(p.gangs[0].deviceIds).toEqual([a, b, c]);
    expect(at(p, c)).toEqual({ x: 160, y: 100 });
  });
});

describe('leaveGang', () => {
  it('splits a Toestel off: the rest close up and it goes beside them along the wall, a symbol apart', () => {
    const { p, ids: [a, b, c] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 }, { x: 500, y: 300 });
    joinGang(p, b, a, { x: 110, y: 100 });
    joinGang(p, c, b, { x: 135, y: 100 });
    leaveGang(p, b);
    expect(p.gangs[0].deviceIds).toEqual([a, c]);
    expect([at(p, a), at(p, c), at(p, b)]).toEqual([{ x: 100, y: 100 }, { x: 130, y: 100 }, { x: 190, y: 100 }]);
    expect(gangMembers(p, b).map((d) => d.id)).toEqual([b]);
  });

  it('puts a Toestel split off a vertical Combinatie beside it along the wall', () => {
    const { p, ids: [a, b, c] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 }, { x: 500, y: 300 });
    joinGang(p, b, a, { x: 110, y: 100 });
    joinGang(p, c, b, { x: 135, y: 100 });
    setGangOrientation(p, a, 'vertical');
    leaveGang(p, a);
    expect([at(p, b), at(p, c), at(p, a)]).toEqual([{ x: 100, y: 100 }, { x: 100, y: 70 }, { x: 160, y: 100 }]);
  });

  it('leaves no Combinatie behind when one Toestel is left', () => {
    const { p, ids: [a, b] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 });
    joinGang(p, b, a, { x: 110, y: 100 });
    leaveGang(p, a);
    expect(p.gangs).toEqual([]);
    expect(at(p, b)).toEqual({ x: 130, y: 100 });
  });
});

describe('joinGang from another Combinatie', () => {
  it('takes the Toestel out of its old Combinatie, which closes up', () => {
    const { p, ids: [a, b, c, d] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 }, { x: 500, y: 300 }, { x: 100, y: 400 });
    joinGang(p, b, a, { x: 110, y: 100 });
    joinGang(p, c, b, { x: 135, y: 100 });
    joinGang(p, a, d, { x: 110, y: 400 });
    expect(p.gangs.map((g) => g.deviceIds)).toEqual([[b, c], [d, a]]);
    expect([at(p, b), at(p, c), at(p, a)]).toEqual([{ x: 130, y: 100 }, { x: 160, y: 100 }, { x: 130, y: 400 }]);
  });
});

describe('setGangOrientation', () => {
  it('stacks a vertical Combinatie outward from the wall, the first one at the wall', () => {
    const { p, ids: [a, b, c] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 }, { x: 500, y: 300 });
    joinGang(p, b, a, { x: 110, y: 100 });
    joinGang(p, c, b, { x: 135, y: 100 });
    setGangOrientation(p, b, 'vertical');
    expect(p.gangs[0].orientation).toBe('vertical');
    expect([at(p, a), at(p, b), at(p, c)]).toEqual([{ x: 100, y: 100 }, { x: 100, y: 70 }, { x: 100, y: 40 }]);
    setGangOrientation(p, b, 'horizontal');
    expect([at(p, a), at(p, b), at(p, c)]).toEqual([{ x: 100, y: 100 }, { x: 130, y: 100 }, { x: 160, y: 100 }]);
  });

  it('leaves room for the appliance in front of a dedicated Contactdoos', () => {
    const { p, ids: [a, b] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 });
    p.devices[0] = { ...p.devices[0], type: 'socket', appliance: 'oven' };
    joinGang(p, b, a, { x: 110, y: 100 });
    setGangOrientation(p, a, 'vertical');
    expect(at(p, b)).toEqual({ x: 100, y: 58 });
  });

  it('follows the wall the Combinatie is turned to', () => {
    const { p, ids: [a, b] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 });
    p.devices[0].placement!.rotation = 90; // wall on the left (-x)
    joinGang(p, b, a, { x: 100, y: 110 });
    expect(at(p, b)).toEqual({ x: 100, y: 130 });
    setGangOrientation(p, a, 'vertical');
    expect(at(p, b)).toEqual({ x: 130, y: 100 });
  });

  it('puts a Toestel dropped on the wall end of a vertical Combinatie at the wall, pushing the others out', () => {
    const { p, ids: [a, b, c] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 }, { x: 500, y: 300 });
    joinGang(p, b, a, { x: 110, y: 100 });
    setGangOrientation(p, a, 'vertical');
    joinGang(p, c, a, { x: 100, y: 105 });
    expect(p.gangs[0].deviceIds).toEqual([c, a, b]);
    expect([at(p, c), at(p, a), at(p, b)]).toEqual([{ x: 100, y: 100 }, { x: 100, y: 70 }, { x: 100, y: 40 }]);
  });
});

describe('setGangFinish', () => {
  it('gives a Combinatie its own Afwerking instead of the project default', () => {
    const { p, ids: [a, b, c] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 }, { x: 500, y: 500 });
    p.finish = 'Niko Original wit';
    joinGang(p, b, a, { x: 110, y: 100 });
    expect(gangFinish(p, a)).toBe('Niko Original wit');
    setGangFinish(p, b, 'Niko Intense antraciet');
    expect([gangFinish(p, a), gangFinish(p, b), gangFinish(p, c)]).toEqual([
      'Niko Intense antraciet',
      'Niko Intense antraciet',
      'Niko Original wit',
    ]);
  });

  it('keeps the Afwerking of a lone Toestel as a Combinatie of one, until it is cleared', () => {
    const { p, ids: [a] } = withSockets({ x: 100, y: 100 });
    setGangFinish(p, a, 'Niko Pure staal');
    expect(p.gangs).toEqual([{ id: expect.any(String), deviceIds: [a], orientation: 'horizontal', finish: 'Niko Pure staal' }]);
    setGangFinish(p, a, '  ');
    expect(p.gangs).toEqual([]);
    expect(gangFinish(p, a)).toBeUndefined();
  });

  it('keeps a Combinatie with its own Afwerking when all but one Toestel leave', () => {
    const { p, ids: [a, b] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 });
    joinGang(p, b, a, { x: 110, y: 100 });
    setGangFinish(p, a, 'Niko Pure staal');
    leaveGang(p, b);
    expect(gangFinish(p, a)).toBe('Niko Pure staal');
    expect(gangFinish(p, b)).toBeUndefined();
  });
});

describe('moveGang', () => {
  it('moves the whole Combinatie with the Toestel that is dragged, turned as it is', () => {
    const { p, ids: [a, b, c] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 }, { x: 500, y: 300 });
    joinGang(p, b, a, { x: 110, y: 100 });
    joinGang(p, c, b, { x: 135, y: 100 });
    moveGang(p, b, { x: 200.4, y: 50 }, 90);
    expect([at(p, a), at(p, b), at(p, c)]).toEqual([{ x: 200, y: 20 }, { x: 200, y: 50 }, { x: 200, y: 80 }]);
    expect(gangMembers(p, a).map((d) => d.placement.rotation)).toEqual([90, 90, 90]);
  });

  it('moves a lone Toestel like moveDevice', () => {
    const { p, ids: [a] } = withSockets({ x: 100, y: 100 });
    moveGang(p, a, { x: 10, y: 20 });
    expect(at(p, a)).toEqual({ x: 10, y: 20 });
  });
});

describe('rotateGang', () => {
  it('turns the whole Combinatie a quarter clockwise around its first Toestel', () => {
    const { p, ids: [a, b] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 });
    joinGang(p, b, a, { x: 110, y: 100 });
    rotateGang(p, b);
    expect([at(p, a), at(p, b)]).toEqual([{ x: 100, y: 100 }, { x: 100, y: 130 }]);
    expect(gangMembers(p, a).map((d) => d.placement.rotation)).toEqual([90, 90]);
  });
});

describe('tidyGangs', () => {
  it('closes up a Combinatie after one of its Toestellen is deleted', () => {
    const { p, ids: [a, b, c] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 }, { x: 500, y: 300 });
    joinGang(p, b, a, { x: 110, y: 100 });
    joinGang(p, c, b, { x: 135, y: 100 });
    removeDevice(p, b);
    tidyGangs(p);
    expect(p.gangs[0].deviceIds).toEqual([a, c]);
    expect(at(p, c)).toEqual({ x: 130, y: 100 });
  });

  it('takes a Toestel out that is no longer wall-mounted, and drops a Combinatie left with one', () => {
    const { p, ids: [a, b] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 });
    p.devices = p.devices.map((d) => ({ ...d, type: 'fan', mount: 'wall' }) as typeof d);
    joinGang(p, b, a, { x: 110, y: 100 });
    setDeviceKind(p.devices, [], b, { type: 'fan', mount: 'ceiling' });
    tidyGangs(p);
    expect(p.gangs).toEqual([]);
  });

  it('makes room when a stacked Contactdoos gets an appliance', () => {
    const { p, ids: [a, b] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 });
    joinGang(p, b, a, { x: 110, y: 100 });
    setGangOrientation(p, a, 'vertical');
    setDeviceKind(p.devices, [], a, { type: 'socket', appliance: 'hob' });
    tidyGangs(p);
    expect(at(p, b)).toEqual({ x: 100, y: 58 });
  });

  it('drops the Combinaties of a deleted floor', () => {
    const { p, ids: [a, b] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 });
    p.floors.push(createFloor('Verdieping 1', 300));
    joinGang(p, b, a, { x: 110, y: 100 });
    removeFloor(p, 'f0');
    tidyGangs(p);
    expect(p.gangs).toEqual([]);
  });
});

describe('joinGang guards', () => {
  it('never takes in a ceiling Toestel', () => {
    const { p, ids: [a] } = withSockets({ x: 100, y: 100 });
    const lamp = placeDevice(p, 'f0', { type: 'lightPoint', mount: 'ceiling' }, { x: 300, y: 300 });
    joinGang(p, lamp.id, a, { x: 110, y: 100 });
    expect(p.gangs).toEqual([]);
    expect(at(p, lamp.id)).toEqual({ x: 300, y: 300 });
  });

  it('keeps the own Afwerking of a lone Toestel when the Combinatie it joins has none', () => {
    const { p, ids: [a, b] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 });
    setGangFinish(p, b, 'Niko Pure staal');
    joinGang(p, b, a, { x: 110, y: 100 });
    expect(p.gangs.map((g) => g.deviceIds)).toEqual([[a, b]]);
    expect(gangFinish(p, a)).toBe('Niko Pure staal');
  });

  it('keeps the Afwerking of the Combinatie it joins when that has its own', () => {
    const { p, ids: [a, b] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 });
    setGangFinish(p, a, 'Niko Original wit');
    setGangFinish(p, b, 'Niko Pure staal');
    joinGang(p, b, a, { x: 110, y: 100 });
    expect(gangFinish(p, b)).toBe('Niko Original wit');
  });
});

describe('removeDeviceAndCloseGang', () => {
  it('deletes the first Toestel of a vertical Combinatie and pulls the rest back to the wall', () => {
    const { p, ids: [a, b, c] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 }, { x: 500, y: 300 });
    joinGang(p, b, a, { x: 110, y: 100 });
    joinGang(p, c, b, { x: 135, y: 100 });
    setGangOrientation(p, a, 'vertical');
    removeDeviceAndCloseGang(p, a);
    expect(p.devices.map((d) => d.id)).toEqual([b, c]);
    expect([at(p, b), at(p, c)]).toEqual([{ x: 100, y: 100 }, { x: 100, y: 70 }]);
  });
});

describe('setDeviceKindInGang', () => {
  it('splits a Toestel off that becomes a ceiling one, so it does not lie on the others', () => {
    const { p, ids: [a, b] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 });
    p.devices = p.devices.map((d) => ({ ...d, type: 'fan', mount: 'wall' }) as typeof d);
    joinGang(p, b, a, { x: 110, y: 100 });
    setGangOrientation(p, a, 'vertical');
    setDeviceKindInGang(p, [], a, { type: 'fan', mount: 'ceiling' });
    expect(p.gangs).toEqual([]);
    expect(at(p, b)).toEqual({ x: 100, y: 100 });
    expect(at(p, a)).not.toEqual(at(p, b));
    expect(p.devices[0]).toMatchObject({ type: 'fan', mount: 'ceiling' });
  });

  it('makes room when a stacked Contactdoos gets an appliance', () => {
    const { p, ids: [a, b] } = withSockets({ x: 100, y: 100 }, { x: 300, y: 300 });
    joinGang(p, b, a, { x: 110, y: 100 });
    setGangOrientation(p, a, 'vertical');
    setDeviceKindInGang(p, [], a, { type: 'socket', appliance: 'oven' });
    expect(at(p, b)).toEqual({ x: 100, y: 58 });
  });
});
