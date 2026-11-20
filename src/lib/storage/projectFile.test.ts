import { describe, expect, it } from 'vitest';
import { createProject } from '../model/project';
import type { Id } from '../model/types';
import { exportProjectFile, importProjectFile } from './projectFile';

function memoryBlobs(initial: Record<Id, Blob> = {}) {
  const blobs = new Map(Object.entries(initial));
  return {
    blobs,
    getBlob: async (key: Id) => blobs.get(key),
    putBlob: async (key: Id, blob: Blob) => void blobs.set(key, blob),
  };
}

describe('project file', () => {
  it('saves a project with its plan image and opens it again', async () => {
    const p = createProject('Voorbeeldhuis');
    p.floors[0].background = {
      blobKey: 'b1', name: 'plan.png', widthPx: 10, heightPx: 10, cmPerPx: 1,
      offset: { x: 0, y: 0 }, opacity: 0.5, calibrated: false,
    };
    const source = memoryBlobs({ b1: new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/png' }) });
    const text = await exportProjectFile(p, source.getBlob);

    const target = memoryBlobs();
    const opened = await importProjectFile(text, target.putBlob);

    expect(opened.name).toBe('Voorbeeldhuis');
    const blob = target.blobs.get('b1');
    expect(blob?.type).toBe('image/png');
    expect([...new Uint8Array(await blob!.arrayBuffer())]).toEqual([1, 2, 3, 250]);
  });

  it('keeps every byte of a large plan image', async () => {
    const bytes = Uint8Array.from({ length: 300_000 }, (_, i) => (i * 7919) % 256);
    const p = createProject();
    p.floors[0].background = {
      blobKey: 'big', name: 'plan.png', widthPx: 10, heightPx: 10, cmPerPx: 1,
      offset: { x: 0, y: 0 }, opacity: 0.5, calibrated: false,
    };
    const text = await exportProjectFile(p, memoryBlobs({ big: new Blob([bytes], { type: 'image/png' }) }).getBlob);
    const target = memoryBlobs();
    await importProjectFile(text, target.putBlob);
    expect(new Uint8Array(await target.blobs.get('big')!.arrayBuffer())).toEqual(bytes);
  });

  it('also opens a plan image stored as a percent-encoded data URL', async () => {
    const text = JSON.stringify({
      format: 'elektroplan', version: 1, project: createProject(), blobs: { b1: 'data:text/plain,a%20b' },
    });
    const target = memoryBlobs();
    await importProjectFile(text, target.putBlob);
    expect(await target.blobs.get('b1')?.text()).toBe('a b');
  });

  it('rejects JSON that is not a project file', async () => {
    await expect(importProjectFile('{"foo":1}', memoryBlobs().putBlob)).rejects.toThrow(/geen geldig/);
  });

  it('only accepts embedded images, never a link', async () => {
    const text = JSON.stringify({
      format: 'elektroplan', version: 1, project: createProject(), blobs: { b1: 'https://example.com/x.png' },
    });
    await expect(importProjectFile(text, memoryBlobs().putBlob)).rejects.toThrow(/ingebedde/);
  });
});
