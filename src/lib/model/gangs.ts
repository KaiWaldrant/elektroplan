import { findDevice, hitDevice, moveDevice, removeDevice, rotateDevice, setDeviceKind, SYMBOL_CM, symbolReach } from './devices';
import { isWallMounted } from './deviceTypes';
import { uid } from './project';
import type { DeviceKind, Gang, Id, Orientation, PlacedDevice, Placement, Point, Project, Wall } from './types';

/** The stored Combinatie a Toestel is in, if any. */
export function gangOf(project: Project, deviceId: Id): Gang | undefined {
  return project.gangs.find((g) => g.deviceIds.includes(deviceId));
}

/** The Toestellen of a placed Toestel's Combinatie, in order; just the Toestel itself when it is a Combinatie of one. */
export function gangMembers(project: Project, deviceId: Id): PlacedDevice[] {
  const ids = gangOf(project, deviceId)?.deviceIds ?? [deviceId];
  return ids.map((id) => findDevice(project.devices, id)).filter((d): d is PlacedDevice => !!d?.placement);
}

const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;

/**
 * The direction a Combinatie runs in, for its first Toestel turned `rotation` degrees: along the
 * wall (the symbols' +x) when horizontal, away from the wall (the symbols' -y) when vertical.
 */
function direction(orientation: Orientation, rotation: number): Point {
  const r = (rotation * Math.PI) / 180;
  return orientation === 'horizontal' ? { x: Math.cos(r), y: Math.sin(r) } : { x: Math.sin(r), y: -Math.cos(r) };
}

/**
 * How far (cm) each Toestel of a Combinatie sits from the first one, in its direction. Side by side
 * they are one symbol apart; stacked, a dedicated Contactdoos also leaves room for its appliance.
 */
function offsets(project: Project, gang: Gang): number[] {
  let next = 0;
  return gang.deviceIds.map((id) => {
    const d = findDevice(project.devices, id);
    const here = next;
    next += gang.orientation === 'horizontal' || !d ? SYMBOL_CM : symbolReach(d) + SYMBOL_CM / 2;
    return here;
  });
}

/**
 * Put the Toestellen of a Combinatie in a row, so that Toestel `fixedId` (the first one by default)
 * ends up at `place` (where it is now, by default) and all are turned like it.
 */
function layout(project: Project, gang: Gang, fixedId: Id = gang.deviceIds[0], place?: Placement): void {
  const fixed = place ?? findDevice(project.devices, fixedId)?.placement;
  if (!fixed) return;
  const { floorId, rotation } = fixed;
  const dir = direction(gang.orientation, rotation);
  const off = offsets(project, gang);
  const base = off[gang.deviceIds.indexOf(fixedId)] ?? 0;
  gang.deviceIds.forEach((id, i) => {
    const d = findDevice(project.devices, id);
    const k = off[i] - base;
    if (d) d.placement = { floorId, rotation, at: { x: Math.round(fixed.at.x + dir.x * k), y: Math.round(fixed.at.y + dir.y * k) } };
  });
}

/**
 * Add Toestel `deviceId` to the Combinatie of Toestel `targetId`, at the end nearest to `drop`
 * (where it was dropped). A lone target becomes a horizontal Combinatie of two. Side by side, the
 * others stay where they are; stacked, one added at the wall pushes the others out. Only
 * wall-mounted Toestellen join. The Combinatie keeps its own Afwerking, or else takes the one the
 * joining Toestel had on its own.
 */
export function joinGang(project: Project, deviceId: Id, targetId: Id, drop: Point): void {
  const device = findDevice(project.devices, deviceId);
  const target = findDevice(project.devices, targetId);
  if (!device?.placement || !target?.placement || !isWallMounted(device) || !isWallMounted(target)) return;
  const old = gangOf(project, deviceId);
  const ownFinish = old?.deviceIds.length === 1 ? old.finish : undefined;
  if (old) takeOut(project, old, deviceId);
  let gang = gangOf(project, targetId);
  if (!gang) {
    gang = { id: uid(), deviceIds: [targetId], orientation: 'horizontal' };
    project.gangs.push(gang);
  }
  const first = gang.deviceIds[0];
  const start = findDevice(project.devices, first)?.placement;
  if (!start) return;
  const off = offsets(project, gang);
  const t = dot({ x: drop.x - start.at.x, y: drop.y - start.at.y }, direction(gang.orientation, start.rotation));
  if (gang.finish === undefined && ownFinish !== undefined) gang.finish = ownFinish;
  if (t < off[off.length - 1] / 2) {
    gang.deviceIds.unshift(deviceId);
    if (gang.orientation === 'vertical') layout(project, gang, deviceId, start);
    else layout(project, gang, first);
  } else {
    gang.deviceIds.push(deviceId);
    layout(project, gang, first);
  }
}

/**
 * Take Toestel `deviceId` out of `gang` without moving it. The rest close up: side by side the new
 * first one stays where it is; stacked it moves to the wall. Returns the first one left, if any.
 */
function takeOut(project: Project, gang: Gang, deviceId: Id): PlacedDevice | undefined {
  const start = findDevice(project.devices, gang.deviceIds[0])?.placement;
  gang.deviceIds = gang.deviceIds.filter((id) => id !== deviceId);
  const [first] = gang.deviceIds;
  if (first && gang.orientation === 'vertical' && start) layout(project, gang, first, start);
  else if (first) layout(project, gang, first);
  if (gang.deviceIds.length === 0 || (gang.deviceIds.length === 1 && gang.finish === undefined)) {
    project.gangs = project.gangs.filter((g) => g !== gang);
  }
  const d = first ? findDevice(project.devices, first) : undefined;
  return d?.placement ? (d as PlacedDevice) : undefined;
}

/**
 * Split Toestel `deviceId` off its Combinatie: the rest close up and it goes beside them along the
 * wall, one symbol apart, so it is clearly on its own plate.
 */
export function leaveGang(project: Project, deviceId: Id): void {
  const gang = gangOf(project, deviceId);
  const device = findDevice(project.devices, deviceId);
  if (!gang || !device?.placement) return;
  const first = takeOut(project, gang, deviceId);
  if (!first) return;
  const { floorId, at, rotation } = first.placement;
  const rowEnd = gang.orientation === 'horizontal' ? Math.max(...offsets(project, gang)) : 0;
  const along = direction('horizontal', rotation);
  const k = rowEnd + 2 * SYMBOL_CM;
  device.placement = { floorId, rotation, at: { x: Math.round(at.x + along.x * k), y: Math.round(at.y + along.y * k) } };
}

/** Lay the Combinatie of Toestel `deviceId` out side by side or stacked, from where its first Toestel is. */
export function setGangOrientation(project: Project, deviceId: Id, orientation: Orientation): void {
  const gang = gangOf(project, deviceId);
  if (!gang) return;
  gang.orientation = orientation;
  layout(project, gang);
}

/** The Afwerking of Toestel `deviceId`'s Combinatie: its own, or else the project default. */
export function gangFinish(project: Project, deviceId: Id): string | undefined {
  return gangOf(project, deviceId)?.finish ?? project.finish;
}

/**
 * Give the Combinatie of Toestel `deviceId` its own Afwerking, or back to the project default when
 * `finish` is blank. A lone Toestel keeps its Afwerking as a stored Combinatie of one.
 */
export function setGangFinish(project: Project, deviceId: Id, finish: string | undefined): void {
  const name = finish?.trim() || undefined;
  let gang = gangOf(project, deviceId);
  if (!gang) {
    if (!name) return;
    gang = { id: uid(), deviceIds: [deviceId], orientation: 'horizontal' };
    project.gangs.push(gang);
  }
  if (name) gang.finish = name;
  else delete gang.finish;
  if (gang.deviceIds.length === 1 && !name) project.gangs = project.gangs.filter((g) => g !== gang);
}

/**
 * Move Toestel `deviceId` to `at` (whole cm), turned to `rotation` if given, and the rest of its
 * Combinatie with it.
 */
export function moveGang(project: Project, deviceId: Id, at: Point, rotation?: number): void {
  moveDevice(project.devices, deviceId, at, rotation);
  const gang = gangOf(project, deviceId);
  if (gang) layout(project, gang, deviceId);
}

/** Turn the Combinatie of Toestel `deviceId` a quarter clockwise, around its first Toestel. */
export function rotateGang(project: Project, deviceId: Id): void {
  const gang = gangOf(project, deviceId);
  rotateDevice(project.devices, gang?.deviceIds[0] ?? deviceId);
  if (gang) layout(project, gang);
}

/**
 * Bring the Combinaties in line with the Toestellen after a change made outside this module (floor
 * deleted, calibration; Toestellen deleted or changed in kind directly): take out Toestellen that are gone or no longer wall-mounted, drop
 * Combinaties that are left empty or alone without their own Afwerking, and lay the rest out again.
 */
export function tidyGangs(project: Project): void {
  for (const gang of [...project.gangs]) {
    const first = findDevice(project.devices, gang.deviceIds[0])?.placement;
    for (const id of gang.deviceIds) {
      const d = findDevice(project.devices, id);
      const keep = d?.placement && isWallMounted(d) && (!first || d.placement.floorId === first.floorId);
      if (!keep) takeOut(project, gang, id);
    }
    if (project.gangs.includes(gang)) layout(project, gang);
  }
}

/**
 * The wall-mounted Toestel on floor `floorId` within its symbol reach plus `slack` cm of `p`, that a
 * Toestel dropped there would join; never one of the Combinatie of Toestel `excludeId`.
 */
export function joinTargetAt(project: Project, floorId: Id, p: Point, slack: number, excludeId?: Id): PlacedDevice | undefined {
  const skip = new Set(excludeId ? gangMembers(project, excludeId).map((d) => d.id) : []);
  const candidates = project.devices.filter((d) => !skip.has(d.id) && isWallMounted(d));
  return hitDevice(candidates, floorId, p, slack);
}

/** Delete Toestel `deviceId`; its Combinatie closes up as when it is split off (stacked: back to the wall). */
export function removeDeviceAndCloseGang(project: Project, deviceId: Id): void {
  const gang = gangOf(project, deviceId);
  if (gang) takeOut(project, gang, deviceId);
  removeDevice(project, deviceId);
}

/**
 * Change what kind of Toestel `deviceId` is (see setDeviceKind). One that is no longer wall-mounted
 * is split off its Combinatie first; otherwise the Combinatie is laid out again (a dedicated
 * Contactdoos takes more room when stacked).
 */
export function setDeviceKindInGang(project: Project, walls: Wall[], deviceId: Id, kind: DeviceKind): void {
  if (!isWallMounted(kind)) leaveGang(project, deviceId);
  setDeviceKind(project.devices, walls, deviceId, kind);
  const gang = gangOf(project, deviceId);
  if (gang) layout(project, gang);
}
