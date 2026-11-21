import { isWallMounted } from './deviceTypes';
import { dist, projectOnSegment } from './geometry';
import { uid } from './project';
import type { Device, DeviceKind, Id, PlacedDevice, Point, Project, Selection, Wall } from './types';

/** Size of a Toestel symbol on the plan, in cm (#10: 30 cm across, about 6 mm at 1:50). */
export const SYMBOL_CM = 30;

const round = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });

/** Add a Toestel of `kind` on floor `floorId` at `at` (rounded to whole cm), turned `rotation` degrees, and return it. */
export function placeDevice(project: Project, floorId: Id, kind: DeviceKind, at: Point, rotation = 0): Device {
  const device: Device = { ...kind, id: uid(), placement: { floorId, at: round(at), rotation } };
  project.devices.push(device);
  return device;
}

/** The Toestellen placed on floor `floorId`. */
export function devicesOnFloor(devices: Device[], floorId: Id): PlacedDevice[] {
  return devices.filter((d): d is PlacedDevice => d.placement?.floorId === floorId);
}

/** The selected Toestel, if it is placed on floor `floorId` (the floor being shown). */
export function selectedDevice(devices: Device[], floorId: Id, selection: Selection): PlacedDevice | undefined {
  return selection?.kind === 'device' ? devicesOnFloor(devices, floorId).find((d) => d.id === selection.id) : undefined;
}

/** The Toestel on floor `floorId` nearest to `p` within `radius` cm, if any. */
export function hitDevice(devices: Device[], floorId: Id, p: Point, radius: number): PlacedDevice | undefined {
  let best: PlacedDevice | undefined;
  let bestD = radius;
  for (const d of devicesOnFloor(devices, floorId)) {
    const dd = dist(d.placement.at, p);
    if (dd <= bestD) {
      best = d;
      bestD = dd;
    }
  }
  return best;
}

/**
 * Move a placed Toestel to `at` (rounded to whole cm) on the same floor, and turn it to `rotation`
 * if given (mutates the device).
 */
export function moveDevice(devices: Device[], id: Id, at: Point, rotation?: number): void {
  const d = devices.find((x) => x.id === id);
  if (d?.placement) d.placement = { ...d.placement, at: round(at), rotation: rotation ?? d.placement.rotation };
}

/** Turn a placed Toestel 90° clockwise (mutates the device). */
export function rotateDevice(devices: Device[], id: Id): void {
  const d = devices.find((x) => x.id === id);
  if (d?.placement) d.placement = { ...d.placement, rotation: (d.placement.rotation + 90) % 360 };
}

/** Change what kind of Toestel it is (e.g. its variant), keeping its id and placement. */
export function setDeviceKind(devices: Device[], id: Id, kind: DeviceKind): void {
  const i = devices.findIndex((x) => x.id === id);
  if (i >= 0) devices[i] = { ...kind, id, placement: devices[i].placement };
}

/** Distance (cm) from a wall face within which a wall-mounted Toestel snaps to it. */
export const WALL_SNAP_CM = 30;

/** Where a wall-mounted Toestel goes against a wall: on the wall face, turned so its wall side faces the wall. */
export interface WallSnap {
  at: Point;
  rotation: number;
}

/**
 * Snap `p` against the face of the nearest wall whose face is within `tolerance` cm, on the side
 * of the wall where `p` is, `standoff` cm out from the face (so a symbol centred there sits beside
 * the wall). Null when no wall is near.
 */
export function snapToWall(walls: Wall[], p: Point, tolerance: number, standoff = 0): WallSnap | null {
  let best: { wall: Wall; on: Point; gap: number } | null = null;
  for (const w of walls) {
    const { point, dist: d } = projectOnSegment(p, w.a, w.b);
    const gap = d - w.thickness / 2;
    if (gap <= tolerance && (!best || gap < best.gap)) best = { wall: w, on: point, gap };
  }
  if (!best) return null;
  const { wall, on } = best;
  const len = dist(wall.a, wall.b) || 1;
  // unit normal of the wall, pointing to the side where p is
  let n = { x: -(wall.b.y - wall.a.y) / len, y: (wall.b.x - wall.a.x) / len };
  if ((p.x - on.x) * n.x + (p.y - on.y) * n.y < 0) n = { x: -n.x, y: -n.y };
  const out = wall.thickness / 2 + standoff;
  const rotation = (((Math.atan2(n.x, -n.y) * 180) / Math.PI) % 360 + 360) % 360;
  return { at: round({ x: on.x + n.x * out, y: on.y + n.y * out }), rotation: Math.round(rotation * 100) / 100 };
}

/** Delete a Toestel. */
export function removeDevice(project: Project, id: Id): void {
  project.devices = project.devices.filter((d) => d.id !== id);
}

/**
 * Where a Toestel of `kind` goes when dropped or dragged to `p`: a wall-mounted one snaps beside a
 * near wall and turns to it (unless `free`, i.e. Alt held); otherwise it stays at `p` as it is turned.
 */
export function positionAt(kind: DeviceKind, walls: Wall[], p: Point, free: boolean): { at: Point; rotation?: number } {
  if (isWallMounted(kind) && !free) {
    const snap = snapToWall(walls, p, WALL_SNAP_CM, SYMBOL_CM / 2);
    if (snap) return snap;
  }
  return { at: p };
}
