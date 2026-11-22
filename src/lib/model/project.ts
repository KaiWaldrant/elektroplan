import { PROJECT_VERSION, type Floor, type Id, type Project } from './types';

export function uid(): Id {
  // randomUUID only exists in a secure context (https or localhost); the app may also be opened over plain http on a LAN.
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function createFloor(name: string, level = 0): Floor {
  return { id: uid(), name, level, walls: [], rooms: [] };
}

export function createProject(name = 'Nieuw project'): Project {
  const now = new Date().toISOString();
  return {
    version: PROJECT_VERSION,
    id: uid(),
    name,
    floors: [createFloor('Gelijkvloers', 0)],
    devices: [],
    gangs: [],
    controls: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function blobKeys(p: Project): Id[] {
  return p.floors.flatMap((f) => (f.background ? [f.background.blobKey] : []));
}

/**
 * Delete a floor together with the Toestellen placed on it; unplaced Toestellen forget a Ruimte
 * chosen on it. The last floor is never deleted.
 */
export function removeFloor(project: Project, floorId: Id): void {
  const floor = project.floors.find((f) => f.id === floorId);
  if (!floor || project.floors.length <= 1) return;
  const goneRooms = new Set(floor.rooms.map((r) => r.id));
  project.floors = project.floors.filter((f) => f.id !== floorId);
  project.devices = project.devices.filter((d) => d.placement?.floorId !== floorId);
  for (const d of project.devices) if (d.roomId && goneRooms.has(d.roomId)) delete d.roomId;
}
