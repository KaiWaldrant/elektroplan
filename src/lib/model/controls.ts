import { findDevice } from './devices';
import { uid } from './project';
import { haArea, roomOf, toSnakeCase } from './rooms';
import type { Control, DeviceKind, Id, Project, Selection } from './types';

/** What a Toestel of this kind can be in a Bediening: a Lichtpunt, or what switches it; undefined for the rest. */
export type ControlRole = 'light' | 'pushButton' | 'switch';

export function controlRole(kind: DeviceKind): ControlRole | undefined {
  if (kind.type === 'lightPoint') return 'light';
  if (kind.type === 'pushButton' || kind.type === 'switch') return kind.type;
  return undefined;
}

export function findControl(project: Project, controlId: Id): Control | undefined {
  return project.controls.find((c) => c.id === controlId);
}

/** The Bediening a Toestel is in, if any. */
export function controlOf(project: Project, deviceId: Id): Control | undefined {
  return project.controls.find((c) => c.lightPointIds.includes(deviceId) || c.controllerIds.includes(deviceId));
}

/** Whether a Bediening is switched by Drukknoppen or by Schakelaars; undefined while it has neither. */
export function controlKind(project: Project, control: Control): 'pushButton' | 'switch' | undefined {
  for (const id of control.controllerIds) {
    const d = findDevice(project.devices, id);
    const role = d && controlRole(d);
    if (role === 'pushButton' || role === 'switch') return role;
  }
  return undefined;
}

/** The list of a Bediening a Toestel of this role goes in. */
const listFor = (control: Control, role: ControlRole): Id[] =>
  role === 'light' ? control.lightPointIds : control.controllerIds;

/**
 * Start a new Bediening "Bediening n" with one Toestel. Undefined (nothing changes) when the
 * Toestel switches no light or is already in a Bediening.
 */
export function startControl(project: Project, deviceId: Id): Control | undefined {
  const d = findDevice(project.devices, deviceId);
  const role = d && controlRole(d);
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

/** What toggleInControl did, or why it refused. */
export type ToggleResult = 'added' | 'removed' | 'notAllowed' | 'inOther' | 'mixed';

/**
 * What toggleInControl would do, without changing anything: add the Toestel, take it out, or refuse
 * it because it switches no light ('notAllowed'), is in another Bediening ('inOther'), or is a
 * Schakelaar where Drukknoppen switch, or the other way round ('mixed').
 */
export function toggleResult(project: Project, controlId: Id, deviceId: Id): ToggleResult {
  const control = findControl(project, controlId);
  const d = findDevice(project.devices, deviceId);
  const role = d && controlRole(d);
  if (!control || !role) return 'notAllowed';
  if (listFor(control, role).includes(deviceId)) return 'removed';
  if (controlOf(project, deviceId)) return 'inOther';
  const kind = controlKind(project, control);
  return role !== 'light' && kind && kind !== role ? 'mixed' : 'added';
}

/**
 * Add a Toestel to a Bediening, or take it out when it is in it already; a Bediening left without
 * Toestellen is deleted. Refused cases (see toggleResult) change nothing.
 */
export function toggleInControl(project: Project, controlId: Id, deviceId: Id): ToggleResult {
  const result = toggleResult(project, controlId, deviceId);
  const control = findControl(project, controlId);
  const d = findDevice(project.devices, deviceId);
  const role = d && controlRole(d);
  if (!control || !role) return result;
  const list = listFor(control, role);
  if (result === 'added') list.push(deviceId);
  if (result === 'removed') {
    list.splice(list.indexOf(deviceId), 1);
    if (control.lightPointIds.length + control.controllerIds.length === 0) removeControl(project, controlId);
  }
  return result;
}

/** Delete a Bediening; its Toestellen stay. */
export function removeControl(project: Project, controlId: Id): void {
  project.controls = project.controls.filter((c) => c.id !== controlId);
}

/** Rename a Bediening (trimmed); an empty name is refused. */
export function renameControl(project: Project, controlId: Id, name: string): void {
  const c = findControl(project, controlId);
  if (c && name.trim()) c.name = name.trim();
}

/**
 * Bring the Bedieningen in line with the Toestellen after they changed outside this module (Toestel
 * or floor deleted, kind changed): drop Toestellen that are gone or can no longer be in their list,
 * and Bedieningen left empty.
 */
export function tidyControls(project: Project): void {
  for (const c of project.controls) {
    const keep = (want: (r: ControlRole | undefined) => boolean) => (id: Id) => {
      const d = findDevice(project.devices, id);
      return !!d && want(controlRole(d));
    };
    c.lightPointIds = c.lightPointIds.filter(keep((r) => r === 'light'));
    c.controllerIds = c.controllerIds.filter(keep((r) => r === 'pushButton' || r === 'switch'));
  }
  project.controls = project.controls.filter((c) => c.lightPointIds.length + c.controllerIds.length > 0);
}

/**
 * The Home Assistant entity id of a Bediening: `light.<area>_<thing>`, with the HA-area of the
 * Ruimte of its first Lichtpunt and the name in snake_case; without `<area>_` when there is no Ruimte.
 */
export function haLightId(project: Project, control: Control): string {
  const first = control.lightPointIds.map((id) => findDevice(project.devices, id)).find((d) => !!d);
  const room = first && roomOf(project, first);
  const thing = toSnakeCase(control.name);
  return `light.${room ? `${haArea(room)}_${thing}` : thing}`;
}

/** The selected Bediening, if any. */
export function selectedControl(project: Project, selection: Selection): Control | undefined {
  return selection?.kind === 'control' ? findControl(project, selection.id) : undefined;
}
