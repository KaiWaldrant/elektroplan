import { describe, expect, it } from 'vitest';
import { migrateProject } from './migrate';
import { createProject } from './project';

const v1 = () => ({
  version: 1,
  id: 'p1',
  name: 'Voorbeeldhuis',
  floors: [{ id: 'f1', name: 'Gelijkvloers', level: 0, walls: [] }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('migrateProject', () => {
  it('gives a version 1 project an empty list of Toestellen and makes it version 2', () => {
    expect(migrateProject(v1())).toEqual({ ...v1(), version: 2, devices: [] });
  });

  it('leaves a current project as it is', () => {
    const p = createProject();
    expect(migrateProject(structuredClone(p))).toEqual(p);
  });

  it('refuses a project from a newer version of the app', () => {
    expect(() => migrateProject({ ...v1(), version: 3 })).toThrow('nieuwere versie');
  });

  it('refuses something that is not a project', () => {
    expect(() => migrateProject({ name: 'x' })).toThrow();
    expect(() => migrateProject(null)).toThrow();
  });
});

describe('createProject', () => {
  it('starts at the current version without Toestellen', () => {
    const p = createProject();
    expect(p.version).toBe(2);
    expect(p.devices).toEqual([]);
  });
});
