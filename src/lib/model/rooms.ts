import { isSimplePolygon, pointInPolygon, polygonArea, roundPoint } from './geometry';
import { uid } from './project';
import type { Device, Floor, Id, Point, Project, Room, Selection } from './types';

/**
 * A name as a Home Assistant id: lower case, accents dropped, every run of other characters one
 * underscore, none at the ends ("Eetkamer/Keuken" → "eetkamer_keuken").
 */
export function toSnakeCase(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** The Home Assistant area of a Ruimte: the one set by hand, or else its name in snake_case. */
export function haArea(room: Room): string {
  return room.haAreaOverride ?? toSnakeCase(room.name);
}

/** Set a Ruimte's HA-area by hand (made snake_case); empty or equal to the default clears it, so it follows the name again. */
export function setHaArea(floor: Floor, roomId: Id, value: string): void {
  const room = findRoom(floor, roomId);
  if (!room) return;
  const area = toSnakeCase(value);
  if (area && area !== toSnakeCase(room.name)) room.haAreaOverride = area;
  else delete room.haAreaOverride;
}

/** Rename a Ruimte (trimmed); an empty name is refused. */
export function renameRoom(floor: Floor, roomId: Id, name: string): void {
  const room = findRoom(floor, roomId);
  if (room && name.trim()) room.name = name.trim();
}

/** Add a Ruimte with the given outline (corners rounded to whole cm) to a floor; no name gives "Ruimte n". */
export function addRoom(floor: Floor, name: string, polygon: Point[]): Room {
  const room: Room = { id: uid(), name: name.trim() || `Ruimte ${floor.rooms.length + 1}`, polygon: polygon.map(roundPoint) };
  floor.rooms.push(room);
  return room;
}

export function findRoom(floor: Floor, roomId: Id): Room | undefined {
  return floor.rooms.find((r) => r.id === roomId);
}

/** The Ruimte around `p` on a floor; of overlapping ones (a berging drawn inside a slaapkamer) the smallest. */
export function roomAt(floor: Floor, p: Point): Room | undefined {
  let best: Room | undefined;
  let bestArea = Infinity;
  for (const r of floor.rooms) {
    const area = polygonArea(r.polygon);
    if (area < bestArea && pointInPolygon(p, r.polygon)) {
      best = r;
      bestArea = area;
    }
  }
  return best;
}

/** The Ruimte of a Toestel: from its position when placed, else the one chosen by hand (if it still exists). */
export function roomOf(project: Project, device: Device): Room | undefined {
  const { placement, roomId } = device;
  if (placement) {
    const floor = project.floors.find((f) => f.id === placement.floorId);
    return floor && roomAt(floor, placement.at);
  }
  if (!roomId) return undefined;
  for (const f of project.floors) {
    const r = findRoom(f, roomId);
    if (r) return r;
  }
  return undefined;
}

/** Choose the Ruimte of an unplaced Toestel by hand (undefined clears it); a placed Toestel is left alone. */
export function setRoomOfUnplaced(project: Project, deviceId: Id, roomId: Id | undefined): void {
  const d = project.devices.find((x) => x.id === deviceId);
  if (!d || d.placement) return;
  if (roomId) d.roomId = roomId;
  else delete d.roomId;
}

/** Delete a Ruimte, and clear it from the unplaced Toestellen that chose it. */
export function removeRoom(project: Project, roomId: Id): void {
  for (const f of project.floors) f.rooms = f.rooms.filter((r) => r.id !== roomId);
  for (const d of project.devices) if (d.roomId === roomId) delete d.roomId;
}

/** Put corner `index` of a Ruimte on `to` (whole cm), unless the outline would then cross itself. Returns whether it moved. */
export function moveRoomCorner(floor: Floor, roomId: Id, index: number, to: Point): boolean {
  const r = findRoom(floor, roomId);
  if (!r || index < 0 || index >= r.polygon.length) return false;
  const polygon = r.polygon.map((c, i) => (i === index ? roundPoint(to) : c));
  if (!isSimplePolygon(polygon)) return false;
  r.polygon[index] = polygon[index];
  return true;
}

/** Move a Ruimte by (dx, dy) from its outline when the drag began (`polygonAtStart`), to whole cm. */
export function translateRoom(floor: Floor, roomId: Id, polygonAtStart: Point[], dx: number, dy: number): void {
  const r = findRoom(floor, roomId);
  if (r) r.polygon = polygonAtStart.map((p) => roundPoint({ x: p.x + dx, y: p.y + dy }));
}

/** The selected Ruimte, if it is on this floor. */
export function selectedRoom(floor: Floor, selection: Selection): Room | undefined {
  return selection?.kind === 'room' ? findRoom(floor, selection.id) : undefined;
}
