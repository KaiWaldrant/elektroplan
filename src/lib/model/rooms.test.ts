import { describe, expect, it } from 'vitest';
import { placeDevice } from './devices';
import { createFloor, createProject, removeFloor } from './project';
import {
  addRoom,
  findRoom,
  haArea,
  moveRoomCorner,
  removeRoom,
  roomAt,
  roomOf,
  setHaArea,
  setRoomOfUnplaced,
  toSnakeCase,
  translateRoom,
} from './rooms';
import type { Device, Point, Project } from './types';

const rect = (x: number, y: number, w: number, h: number): Point[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

/** Floor 'f0' with a living room (0,0 – 600×400) and a storeroom drawn inside it (400,0 – 200×100); floor 'f1' empty. */
function house(): Project {
  const p = createProject();
  p.floors[0].id = 'f0';
  p.floors.push({ ...createFloor('Verdieping 1', 300), id: 'f1' });
  addRoom(p.floors[0], 'Leefruimte', rect(0, 0, 600, 400)).id = 'living';
  addRoom(p.floors[0], 'Berging', rect(400, 0, 200, 100)).id = 'store';
  return p;
}

const unplaced = (p: Project): Device => {
  const d: Device = { id: 'u', type: 'socket' };
  p.devices.push(d);
  return d;
};

describe('toSnakeCase', () => {
  it.each([
    ['Badkamer', 'badkamer'],
    ['Slaapkamer 1', 'slaapkamer_1'],
    ['Eetkamer/Keuken', 'eetkamer_keuken'],
    ['WC (boven)', 'wc_boven'],
    ['  Bureau  ', 'bureau'],
    ['Kinderkamer Ève', 'kinderkamer_eve'],
    ['Ééndraad--kast', 'eendraad_kast'],
    ['already_snake', 'already_snake'],
    ['', ''],
    ['!!!', ''],
  ])('%j → %j', (name, expected) => {
    expect(toSnakeCase(name)).toBe(expected);
  });
});

describe('haArea', () => {
  it('defaults to the name in snake_case, and follows a rename', () => {
    const room = addRoom(createFloor('x'), 'Slaapkamer 1', rect(0, 0, 10, 10));
    expect(haArea(room)).toBe('slaapkamer_1');
    room.name = 'Slaapkamer Noor';
    expect(haArea(room)).toBe('slaapkamer_noor');
  });

  it('uses its own HA-area once set, in snake_case', () => {
    const room = addRoom(createFloor('x'), 'Slaapkamer 1', rect(0, 0, 10, 10));
    setHaArea(room, 'Master Bedroom');
    expect(haArea(room)).toBe('master_bedroom');
    room.name = 'Grote slaapkamer';
    expect(haArea(room)).toBe('master_bedroom');
  });

  it('goes back to the default when emptied or set to the default', () => {
    const room = addRoom(createFloor('x'), 'Bureau', rect(0, 0, 10, 10));
    setHaArea(room, 'office');
    setHaArea(room, '  ');
    expect(room.haArea).toBeUndefined();
    setHaArea(room, 'office');
    setHaArea(room, 'Bureau');
    expect(room.haArea).toBeUndefined();
  });
});

describe('addRoom', () => {
  it('adds a Ruimte with the given outline, rounded to whole cm', () => {
    const f = createFloor('x');
    const room = addRoom(f, 'Keuken', [
      { x: 0.4, y: 0 },
      { x: 100.6, y: 0 },
      { x: 100, y: 99.5 },
    ]);
    expect(f.rooms).toEqual([room]);
    expect(room.polygon).toEqual([
      { x: 0, y: 0 },
      { x: 101, y: 0 },
      { x: 100, y: 100 },
    ]);
  });

  it('names an unnamed Ruimte "Ruimte n"', () => {
    const f = createFloor('x');
    addRoom(f, '', rect(0, 0, 10, 10));
    expect(addRoom(f, ' ', rect(0, 0, 10, 10)).name).toBe('Ruimte 2');
  });
});

describe('roomAt', () => {
  it('finds the Ruimte around a point', () => {
    expect(roomAt(house().floors[0], { x: 100, y: 300 })?.id).toBe('living');
  });

  it('picks the smallest of overlapping Ruimtes', () => {
    expect(roomAt(house().floors[0], { x: 500, y: 50 })?.id).toBe('store');
  });

  it('is undefined outside every Ruimte', () => {
    expect(roomAt(house().floors[0], { x: 700, y: 50 })).toBeUndefined();
  });
});

describe('roomOf', () => {
  it('takes the Ruimte of a placed Toestel from its position', () => {
    const p = house();
    const d = placeDevice(p, 'f0', { type: 'socket' }, { x: 100, y: 300 });
    expect(roomOf(p, d)?.id).toBe('living');
  });

  it('ignores Ruimtes on other floors', () => {
    const p = house();
    const d = placeDevice(p, 'f1', { type: 'socket' }, { x: 100, y: 300 });
    expect(roomOf(p, d)).toBeUndefined();
  });

  it('ignores a chosen Ruimte once the Toestel is placed', () => {
    const p = house();
    const d = placeDevice(p, 'f0', { type: 'socket' }, { x: 700, y: 300 });
    d.roomId = 'living';
    expect(roomOf(p, d)).toBeUndefined();
  });

  it('takes the chosen Ruimte of an unplaced Toestel, on any floor', () => {
    const p = house();
    const d = unplaced(p);
    expect(roomOf(p, d)).toBeUndefined();
    setRoomOfUnplaced(p, 'u', 'store');
    expect(roomOf(p, d)?.id).toBe('store');
    setRoomOfUnplaced(p, 'u', undefined);
    expect(d.roomId).toBeUndefined();
  });

  it('does not set a chosen Ruimte on a placed Toestel', () => {
    const p = house();
    const d = placeDevice(p, 'f0', { type: 'socket' }, { x: 100, y: 300 });
    setRoomOfUnplaced(p, d.id, 'store');
    expect(d.roomId).toBeUndefined();
  });

  it('is undefined when the chosen Ruimte is gone with its floor', () => {
    const p = house();
    p.floors.reverse(); // so floor f0 is not the last one
    const d = unplaced(p);
    setRoomOfUnplaced(p, 'u', 'living');
    removeFloor(p, 'f0');
    expect(roomOf(p, d)).toBeUndefined();
  });
});

describe('removeRoom', () => {
  it('deletes the Ruimte and clears it from the unplaced Toestellen that chose it', () => {
    const p = house();
    const d = unplaced(p);
    setRoomOfUnplaced(p, 'u', 'store');
    removeRoom(p, 'store');
    expect(p.floors[0].rooms.map((r) => r.id)).toEqual(['living']);
    expect(d.roomId).toBeUndefined();
  });
});

describe('editing the outline', () => {
  it('moves one corner, to whole cm', () => {
    const p = house();
    moveRoomCorner(p.floors[0], 'store', 2, { x: 650.4, y: 120 });
    expect(findRoom(p.floors[0], 'store')!.polygon[2]).toEqual({ x: 650, y: 120 });
  });

  it('moves the whole Ruimte from where it was when the drag began', () => {
    const p = house();
    const start = structuredClone(findRoom(p.floors[0], 'store')!.polygon);
    translateRoom(p.floors[0], 'store', start, 10, -5);
    translateRoom(p.floors[0], 'store', start, 20, -10);
    expect(findRoom(p.floors[0], 'store')!.polygon).toEqual(rect(420, -10, 200, 100));
  });
});
