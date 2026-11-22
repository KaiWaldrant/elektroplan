import { describe, expect, it } from 'vitest';
import { migrateProject } from './migrate';
import { createProject } from './project';

const floorV1 = () => ({ id: 'f1', name: 'Gelijkvloers', level: 0, walls: [] });
const v1 = () => ({
  version: 1,
  id: 'p1',
  name: 'Voorbeeldhuis',
  floors: [floorV1()],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

/** v1() brought to the current version, without the data the steps add to the project itself. */
const current = () => ({ ...v1(), version: 7, floors: [{ ...floorV1(), rooms: [] }] });

describe('migrateProject', () => {
  it('gives a version 1 project an empty list of Toestellen and makes it current', () => {
    expect(migrateProject(v1())).toEqual({ ...current(), devices: [], gangs: [], controls: [] });
  });

  it('makes the Lichtpunten of a version 2 project ceiling Lichtpunten, not turned', () => {
    const v2 = {
      ...v1(),
      version: 2,
      devices: [
        { id: 'd1', type: 'lightPoint', placement: { floorId: 'f1', at: { x: 10, y: 20 } } },
        { id: 'd2', type: 'lightPoint' },
      ],
    };
    expect(migrateProject(v2)).toEqual({
      ...current(),
      gangs: [],
      controls: [],
      devices: [
        { id: 'd1', type: 'lightPoint', mount: 'ceiling', placement: { floorId: 'f1', at: { x: 10, y: 20 }, rotation: 0 } },
        { id: 'd2', type: 'lightPoint', mount: 'ceiling' },
      ],
    });
  });

  it('keeps the Toestellen of a version 3 project as they are (version 4 only adds kinds)', () => {
    const devices = [
      { id: 'd1', type: 'switch', variant: 'twoWay', placement: { floorId: 'f1', at: { x: 10, y: 20 }, rotation: 90 } },
      { id: 'd2', type: 'lightPoint', mount: 'wall' },
    ];
    expect(migrateProject({ ...v1(), version: 3, devices })).toEqual({ ...current(), devices, gangs: [], controls: [] });
  });

  it('gives a version 4 project no Combinaties, so every Toestel is a Combinatie of one', () => {
    const devices = [{ id: 'd1', type: 'socket', placement: { floorId: 'f1', at: { x: 10, y: 20 }, rotation: 90 } }];
    expect(migrateProject({ ...v1(), version: 4, devices })).toEqual({ ...current(), devices, gangs: [], controls: [] });
  });

  it('gives every floor of a version 5 project no Ruimtes', () => {
    const v5 = { ...v1(), version: 5, devices: [], gangs: [], floors: [floorV1(), { ...floorV1(), id: 'f2' }] };
    expect(migrateProject(v5)).toEqual({
      ...v5,
      version: 7,
      controls: [],
      floors: [
        { ...floorV1(), rooms: [] },
        { ...floorV1(), id: 'f2', rooms: [] },
      ],
    });
  });

  it('gives a version 6 project no Bedieningen', () => {
    const v6 = { ...current(), version: 6, devices: [], gangs: [] };
    expect(migrateProject(v6)).toEqual({ ...v6, version: 7, controls: [] });
  });

  it('leaves a current project as it is', () => {
    const p = createProject();
    expect(migrateProject(structuredClone(p))).toEqual(p);
  });

  it('refuses a project from a newer version of the app', () => {
    expect(() => migrateProject({ ...v1(), version: 8 })).toThrow('nieuwere versie');
  });

  it('refuses something that is not a project', () => {
    expect(() => migrateProject({ name: 'x' })).toThrow();
    expect(() => migrateProject(null)).toThrow();
  });
});

describe('createProject', () => {
  it('starts at the current version without Toestellen, Combinaties or Ruimtes', () => {
    const p = createProject();
    expect(p.version).toBe(7);
    expect(p.controls).toEqual([]);
    expect(p.floors[0].rooms).toEqual([]);
    expect(p.devices).toEqual([]);
    expect(p.gangs).toEqual([]);
  });
});
