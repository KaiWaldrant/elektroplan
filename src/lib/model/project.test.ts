import { describe, expect, it } from 'vitest';
import { blobKeys, createProject, parseProjectFile } from './project';

describe('createProject', () => {
  it('starts with one ground floor', () => {
    const p = createProject();
    expect(p.floors).toHaveLength(1);
    expect(p.floors[0].level).toBe(0);
  });
});

describe('project file', () => {
  it('round-trips through JSON', () => {
    const p = createProject('Test');
    p.floors[0].background = {
      blobKey: 'b1', name: 'plan.pdf', widthPx: 10, heightPx: 10, cmPerPx: 1,
      offset: { x: 0, y: 0 }, opacity: 0.5, locked: false, calibrated: false,
    };
    const text = JSON.stringify({ format: 'elektroplan', version: 1, project: p, blobs: { b1: 'data:,' } });
    const f = parseProjectFile(text);
    expect(f.project.name).toBe('Test');
    expect(blobKeys(f.project)).toEqual(['b1']);
  });
  it('rejects other JSON', () => {
    expect(() => parseProjectFile('{"foo":1}')).toThrow(/geen geldig/);
  });
});
