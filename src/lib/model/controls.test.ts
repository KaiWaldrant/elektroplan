import { describe, expect, it } from 'vitest';
import {
  controlFloors,
  controlKind,
  controlMembers,
  controlOf,
  controlRole,
  haLightId,
  membersOnFloor,
  sameHaLightId,
  removeControl,
  renameControl,
  startControl,
  tidyControls,
  toggleInControl,
  previewToggle,
} from './controls';
import { placeDevice, removeDevice } from './devices';
import { createFloor, createProject, removeFloor } from './project';
import { addRoom } from './rooms';
import type { DeviceKind, Id, Project } from './types';

const light: DeviceKind = { type: 'lightPoint', mount: 'ceiling' };
const button: DeviceKind = { type: 'pushButton' };
const twoWay: DeviceKind = { type: 'switch', variant: 'twoWay' };
const socket: DeviceKind = { type: 'socket' };

/** Floor 'f0' with a Ruimte 'Leefruimte' (0,0 – 600×400); floor 'f1' empty. */
function house(): Project {
  const p = createProject();
  p.floors[0].id = 'f0';
  p.floors.push({ ...createFloor('Verdieping 1', 300), id: 'f1' });
  addRoom(p.floors[0], 'Leefruimte', [
    { x: 0, y: 0 },
    { x: 600, y: 0 },
    { x: 600, y: 400 },
    { x: 0, y: 400 },
  ]);
  return p;
}

const place = (p: Project, kind: DeviceKind, floorId = 'f0', x = 100, y = 100): Id => placeDevice(p, floorId, kind, { x, y }).id;

describe('controlRole', () => {
  it('knows what a Toestel can be in a Bediening', () => {
    expect(controlRole(light)).toBe('light');
    expect(controlRole({ type: 'lightPoint', mount: 'wall' })).toBe('light');
    expect(controlRole(button)).toBe('pushButton');
    expect(controlRole(twoWay)).toBe('switch');
    expect(controlRole({ type: 'switch', variant: 'dimmer' })).toBe('switch');
    expect(controlRole(socket)).toBeUndefined();
    expect(controlRole({ type: 'fan', mount: 'ceiling' })).toBeUndefined();
  });
});

describe('startControl', () => {
  it('starts a Bediening "Bediening n" with one Lichtpunt', () => {
    const p = house();
    const l = place(p, light);
    const c = startControl(p, l)!;
    expect(p.controls).toEqual([c]);
    expect(c).toMatchObject({ name: 'Bediening 1', lightPointIds: [l], controllerIds: [] });
    expect(controlOf(p, l)).toBe(c);
  });

  it('starts one with a Drukknop or Schakelaar as well', () => {
    const p = house();
    const b = place(p, button);
    expect(startControl(p, b)).toMatchObject({ lightPointIds: [], controllerIds: [b] });
  });

  it('refuses a Toestel that switches no light, or one already in a Bediening', () => {
    const p = house();
    const l = place(p, light);
    expect(startControl(p, place(p, socket))).toBeUndefined();
    startControl(p, l);
    expect(startControl(p, l)).toBeUndefined();
    expect(p.controls).toHaveLength(1);
  });
});

describe('toggleInControl', () => {
  it('adds Lichtpunten and Drukknoppen, and takes them out again', () => {
    const p = house();
    const [l1, l2, b] = [place(p, light), place(p, light), place(p, button)];
    const c = startControl(p, l1)!;
    expect(toggleInControl(p, c.id, l2)).toBe('added');
    expect(toggleInControl(p, c.id, b)).toBe('added');
    expect(c.lightPointIds).toEqual([l1, l2]);
    expect(c.controllerIds).toEqual([b]);
    expect(toggleInControl(p, c.id, l2)).toBe('removed');
    expect(c.lightPointIds).toEqual([l1]);
  });

  it('keeps a Lichtpunt, Drukknop or Schakelaar in at most one Bediening', () => {
    const p = house();
    const [l1, l2, b] = [place(p, light), place(p, light), place(p, button)];
    const c1 = startControl(p, l1)!;
    toggleInControl(p, c1.id, b);
    const c2 = startControl(p, l2)!;
    expect(toggleInControl(p, c2.id, l1)).toBe('inOther');
    expect(toggleInControl(p, c2.id, b)).toBe('inOther');
    expect(c2.lightPointIds).toEqual([l2]);
    expect(c2.controllerIds).toEqual([]);
  });

  it('can be asked what it would do without changing anything', () => {
    const p = house();
    const c = startControl(p, place(p, button))!;
    const before = structuredClone(p);
    expect(previewToggle(p, c.id, place(p, light))).toBe('added');
    expect(previewToggle(p, c.id, c.controllerIds[0])).toBe('removed');
    expect(previewToggle(p, c.id, place(p, twoWay))).toBe('mixed');
    expect(p.controls).toEqual(before.controls);
  });

  it('never mixes Drukknoppen and Schakelaars', () => {
    const p = house();
    const c = startControl(p, place(p, button))!;
    expect(toggleInControl(p, c.id, place(p, twoWay))).toBe('mixed');
    expect(controlKind(p, c)).toBe('pushButton');
  });

  it('refuses a Toestel that switches no light', () => {
    const p = house();
    const c = startControl(p, place(p, light))!;
    expect(toggleInControl(p, c.id, place(p, socket))).toBe('notAllowed');
  });

  it('spans floors (a stair light switched downstairs and upstairs)', () => {
    const p = house();
    const c = startControl(p, place(p, light, 'f1'))!;
    expect(toggleInControl(p, c.id, place(p, twoWay, 'f0'))).toBe('added');
    expect(toggleInControl(p, c.id, place(p, twoWay, 'f1'))).toBe('added');
    expect(controlKind(p, c)).toBe('switch');
  });

  it('deletes the Bediening when its last Toestel is taken out', () => {
    const p = house();
    const l = place(p, light);
    const c = startControl(p, l)!;
    expect(toggleInControl(p, c.id, l)).toBe('removed');
    expect(p.controls).toEqual([]);
  });
});

describe('tidyControls', () => {
  it('drops deleted Toestellen and Bedieningen left empty', () => {
    const p = house();
    const [l1, l2, b] = [place(p, light), place(p, light, 'f1'), place(p, button)];
    const c1 = startControl(p, l1)!;
    toggleInControl(p, c1.id, b);
    startControl(p, l2);
    removeDevice(p, b);
    removeFloor(p, 'f1');
    tidyControls(p);
    expect(p.controls).toEqual([{ ...c1, controllerIds: [] }]);
  });
});

describe('naming', () => {
  it('renames, trimmed, and refuses a name that gives no Home Assistant id', () => {
    const p = house();
    const c = startControl(p, place(p, light))!;
    renameControl(p, c.id, '  Plafond ');
    expect(c.name).toBe('Plafond');
    for (const bad of [' ', '—', '!!']) renameControl(p, c.id, bad);
    expect(c.name).toBe('Plafond');
  });

  it('takes the area from the first Lichtpunt that is in a Ruimte', () => {
    const p = house();
    const c = startControl(p, place(p, light, 'f0', 900, 900))!; // outside the Leefruimte
    toggleInControl(p, c.id, place(p, light));
    renameControl(p, c.id, 'Plafond');
    expect(haLightId(p, c)).toBe('light.leefruimte_plafond');
  });

  it('finds the other Bedieningen with the same Home Assistant id', () => {
    const p = house();
    const c1 = startControl(p, place(p, light))!;
    const c2 = startControl(p, place(p, light))!;
    const c3 = startControl(p, place(p, light, 'f0', 900, 900))!;
    for (const c of [c1, c2, c3]) renameControl(p, c.id, 'Plafond');
    expect(sameHaLightId(p, c1)).toEqual([c2]);
    expect(sameHaLightId(p, c3)).toEqual([]);
  });

  it('gives the Home Assistant light id from the Ruimte of the first Lichtpunt and the name', () => {
    const p = house();
    const c = startControl(p, place(p, light))!;
    renameControl(p, c.id, 'Plafond eettafel');
    expect(haLightId(p, c)).toBe('light.leefruimte_plafond_eettafel');
  });

  it('leaves the area out when the first Lichtpunt is in no Ruimte, or there is none yet', () => {
    const p = house();
    const c = startControl(p, place(p, light, 'f0', 900, 900))!;
    renameControl(p, c.id, 'Tuin');
    expect(haLightId(p, c)).toBe('light.tuin');
    const c2 = startControl(p, place(p, button))!;
    expect(haLightId(p, c2)).toBe('light.bediening_1'); // "Bediening 1" is free again after the rename
  });
});

describe('members', () => {
  it('lists the Toestellen of a Bediening, and where they are placed', () => {
    const p = house();
    const [l0, l1, b] = [place(p, light, 'f0'), place(p, light, 'f1'), place(p, button, 'f1')];
    const c = startControl(p, l1)!;
    toggleInControl(p, c.id, b);
    toggleInControl(p, c.id, l0);
    expect(controlMembers(c)).toEqual([l1, l0, b]);
    expect(membersOnFloor(p, c, 'f1')).toEqual([l1, b]);
    expect(controlFloors(p, c)).toEqual(['f1', 'f0']);
  });
});

describe('removeControl', () => {
  it('deletes a Bediening, leaving its Toestellen', () => {
    const p = house();
    const l = place(p, light);
    const c = startControl(p, l)!;
    removeControl(p, c.id);
    expect(p.controls).toEqual([]);
    expect(p.devices.map((d) => d.id)).toEqual([l]);
  });
});
