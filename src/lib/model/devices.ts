import { dist } from './geometry';
import { uid } from './project';
import type { Device, Id, Point, Project } from './types';

/** Size of a Toestel symbol on the plan, in cm (#10: 30 cm across, about 6 mm at 1:50). */
export const SYMBOL_CM = 30;

const round = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });

/** Add a Lichtpunt on floor `floorId` at `at` (rounded to whole cm) and return it. */
export function placeLightPoint(project: Project, floorId: Id, at: Point): Device {
  const device: Device = { id: uid(), type: 'lightPoint', placement: { floorId, at: round(at) } };
  project.devices.push(device);
  return device;
}

/** The Toestellen placed on floor `floorId`. */
export function devicesOnFloor(devices: Device[], floorId: Id): Device[] {
  return devices.filter((d) => d.placement?.floorId === floorId);
}

/** The Toestel on floor `floorId` nearest to `p` within `radius` cm, if any. */
export function hitDevice(devices: Device[], floorId: Id, p: Point, radius: number): Device | undefined {
  let best: Device | undefined;
  let bestD = radius;
  for (const d of devicesOnFloor(devices, floorId)) {
    const dd = dist(d.placement!.at, p);
    if (dd <= bestD) {
      best = d;
      bestD = dd;
    }
  }
  return best;
}

/** Move a placed Toestel to `at` (rounded to whole cm) on the same floor (mutates the device). */
export function moveDevice(devices: Device[], id: Id, at: Point): void {
  const d = devices.find((x) => x.id === id);
  if (d?.placement) d.placement = { ...d.placement, at: round(at) };
}

export function removeDevice(project: Project, id: Id): void {
  project.devices = project.devices.filter((d) => d.id !== id);
}

/** Delete a floor together with the Toestellen placed on it; the last floor is never deleted. */
export function removeFloor(project: Project, floorId: Id): void {
  if (project.floors.length <= 1) return;
  project.floors = project.floors.filter((f) => f.id !== floorId);
  project.devices = project.devices.filter((d) => d.placement?.floorId !== floorId);
}
