import { findDevice } from './devices';
import { uid } from './project';
import { haArea, roomOf, toSnakeCase } from './rooms';
import type { Control, DeviceKind, Id, Project, Selection } from './types';

/** What switches the Lichtpunten of a Bediening: Drukknoppen or Schakelaars. */
export type ControllerRole = 'pushButton' | 'switch';

/** What a Toestel can be in a Bediening: a Lichtpunt, or what switches it. */
export type ControlRole = 'light' | ControllerRole;

const isController = (role: ControlRole | undefined): role is ControllerRole => role === 'pushButton' || role === 'switch';

/** What a Toestel of this kind can be in a Bediening; undefined for one that has nothing to do with light. */
export function controlRole(kind: DeviceKind): ControlRole | undefined {
  if (kind.type === 'lightPoint') return 'light';
  if (kind.type === 'pushButton' || kind.type === 'switch') return kind.type;
  return undefined;
}

/** The role of Toestel `deviceId`; undefined when it is gone or has nothing to do with light. */
function roleOf(project: Project, deviceId: Id): ControlRole | undefined {
  const d = findDevice(project.devices, deviceId);
  return d && controlRole(d);
}

export function findControl(project: Project, controlId: Id): Control | undefined {
  return project.controls.find((c) => c.id === controlId);
}

/** All Toestellen of a Bediening: its Lichtpunten, then what switches them. */
export function controlMembers(control: Control): Id[] {
  return [...control.lightPointIds, ...control.controllerIds];
}

/** The Bediening a Toestel is in, if any. */
export function controlOf(project: Project, deviceId: Id): Control | undefined {
  return project.controls.find((c) => controlMembers(c).includes(deviceId));
}

/** Whether a Bediening is switched by Drukknoppen or by Schakelaars; undefined while it has neither. */
export function controlKind(project: Project, control: Control): ControllerRole | undefined {
  return control.controllerIds.map((id) => roleOf(project, id)).find(isController);
}

/** The Toestellen of a Bediening placed on floor `floorId`. */
export function membersOnFloor(project: Project, control: Control, floorId: Id): Id[] {
  return controlMembers(control).filter((id) => findDevice(project.devices, id)?.placement?.floorId === floorId);
}

/** The floors a Bediening's Toestellen are placed on, in the order of its Toestellen. */
export function controlFloors(project: Project, control: Control): Id[] {
  const floors = controlMembers(control).map((id) => findDevice(project.devices, id)?.placement?.floorId);
  return [...new Set(floors.filter((f): f is Id => !!f))];
}

/** The list of a Bediening a Toestel of this role goes in. */
const listFor = (control: Control, role: ControlRole): Id[] =>
  role === 'light' ? control.lightPointIds : control.controllerIds;

/**
 * Start a new Bediening "Bediening n" with one Toestel. Undefined (nothing changes) when the
 * Toestel has nothing to do with light or is already in a Bediening.
 */
export function startControl(project: Project, deviceId: Id): Control | undefined {
  const role = roleOf(project, deviceId);
  if (!role || controlOf(project, deviceId)) return undefined;
  const control: Control = { id: uid(), name: nextName(project), lightPointIds: [], controllerIds: [] };
  listFor(control, role).push(deviceId);
  project.controls.push(control);
  return control;
}

/** "Bediening n" with the lowest n not yet used. */
function nextName(project: Project): string {
  const names = new Set(project.controls.map((c) => c.name));
  let n = 1;
  while (names.has(`Bediening ${n}`)) n++;
  return `Bediening ${n}`;
}

/** What toggleInControl does with a Toestel, or why it refuses it. */
export type ToggleResult = 'added' | 'removed' | 'notAllowed' | 'inOther' | 'mixed';

/**
 * What toggleInControl would do, without changing anything: add the Toestel, take it out, or refuse
 * it because it has nothing to do with light ('notAllowed'), is in another Bediening ('inOther'), or
 * is a Schakelaar where Drukknoppen switch, or the other way round ('mixed').
 */
export function previewToggle(project: Project, controlId: Id, deviceId: Id): ToggleResult {
  const control = findControl(project, controlId);
  const role = roleOf(project, deviceId);
  if (!control || !role) return 'notAllowed';
  if (listFor(control, role).includes(deviceId)) return 'removed';
  if (controlOf(project, deviceId)) return 'inOther';
  const kind = controlKind(project, control);
  return isController(role) && kind && kind !== role ? 'mixed' : 'added';
}

/**
 * Add a Toestel to a Bediening, or take it out when it is in it already; a Bediening left without
 * Toestellen is deleted. Refused cases (see previewToggle) change nothing.
 */
export function toggleInControl(project: Project, controlId: Id, deviceId: Id): ToggleResult {
  const result = previewToggle(project, controlId, deviceId);
  if (result !== 'added' && result !== 'removed') return result;
  // previewToggle found both, or it would have refused
  const control = findControl(project, controlId)!;
  const list = listFor(control, roleOf(project, deviceId)!);
  if (result === 'added') list.push(deviceId);
  else {
    list.splice(list.indexOf(deviceId), 1);
    if (controlMembers(control).length === 0) removeControl(project, controlId);
  }
  return result;
}

/** Delete a Bediening; its Toestellen stay. */
export function removeControl(project: Project, controlId: Id): void {
  project.controls = project.controls.filter((c) => c.id !== controlId);
}

/** Rename a Bediening (trimmed); refused when the name gives no `<thing>` for Home Assistant (empty, only signs). */
export function renameControl(project: Project, controlId: Id, name: string): void {
  const c = findControl(project, controlId);
  if (c && toSnakeCase(name)) c.name = name.trim();
}

/**
 * Bring the Bedieningen in line with the Toestellen after Toestellen were deleted outside this module
 * (one Toestel, or a floor with its Toestellen): drop the Toestellen that are gone, and Bedieningen left empty.
 */
export function tidyControls(project: Project): void {
  for (const c of project.controls) {
    c.lightPointIds = c.lightPointIds.filter((id) => roleOf(project, id) === 'light');
    c.controllerIds = c.controllerIds.filter((id) => isController(roleOf(project, id)));
  }
  project.controls = project.controls.filter((c) => controlMembers(c).length > 0);
}

/**
 * The Home Assistant entity id of a Bediening: `light.<area>_<thing>`, with the HA-area of the
 * Ruimte of its first Lichtpunt that is in one and the name in snake_case; without `<area>_` when
 * none of its Lichtpunten is in a Ruimte.
 */
export function haLightId(project: Project, control: Control): string {
  const room = control.lightPointIds
    .map((id) => findDevice(project.devices, id))
    .map((d) => d && roomOf(project, d))
    .find((r) => !!r);
  const thing = toSnakeCase(control.name);
  return `light.${room ? `${haArea(room)}_${thing}` : thing}`;
}

/** The other Bedieningen that would get the same Home Assistant entity id (a clash in Home Assistant). */
export function sameHaLightId(project: Project, control: Control): Control[] {
  const id = haLightId(project, control);
  return project.controls.filter((c) => c.id !== control.id && haLightId(project, c) === id);
}

/** The selected Bediening, if any. */
export function selectedControl(project: Project, selection: Selection): Control | undefined {
  return selection?.kind === 'control' ? findControl(project, selection.id) : undefined;
}
