import type { Floor, Id, Project } from './types';

export function uid(): Id {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function createFloor(name: string, level = 0): Floor {
  return { id: uid(), name, level, walls: [] };
}

export function createProject(name = 'Nieuw project'): Project {
  const now = new Date().toISOString();
  return { version: 1, id: uid(), name, floors: [createFloor('Gelijkvloers', 0)], createdAt: now, updatedAt: now };
}

/** File format: the project plus its background images as data URLs, so one file is the whole project. */
export interface ProjectFile {
  format: 'elektroplan';
  version: 1;
  project: Project;
  blobs: Record<Id, string>;
}

export function blobKeys(p: Project): Id[] {
  return p.floors.flatMap((f) => (f.background ? [f.background.blobKey] : []));
}

export function parseProjectFile(text: string): ProjectFile {
  const data = JSON.parse(text) as Partial<ProjectFile>;
  if (data.format !== 'elektroplan' || data.version !== 1 || !data.project || !Array.isArray(data.project.floors)) {
    throw new Error('Dit is geen geldig Elektroplan-projectbestand.');
  }
  return { format: 'elektroplan', version: 1, project: data.project, blobs: data.blobs ?? {} };
}
