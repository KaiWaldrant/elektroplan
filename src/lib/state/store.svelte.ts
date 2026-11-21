import { removeDevice, selectedDevice } from '../model/devices';
import { tidyGangs } from '../model/gangs';
import { migrateProject } from '../model/migrate';
import { blobKeys, createFloor, createProject, removeFloor, uid } from '../model/project';
import type { Background, Floor, Id, Point, Project, Selection } from '../model/types';
import { getBlob, loadLastProject, putBlob, saveProject } from '../storage/idb';
import { exportProjectFile, importProjectFile } from '../storage/projectFile';
import { Autosave, type SaveState } from './autosave.svelte';
import { History } from './history.svelte';
import type { Tool } from './tools';

/** Run `fn` on one floor of the project, if it still exists. */
function onFloor(p: Project, floorId: Id, fn: (f: Floor) => void) {
  const f = p.floors.find((x) => x.id === floorId);
  if (f) fn(f);
}

class Store {
  project = $state<Project>(createProject());
  activeFloorId = $state<Id>('');
  tool = $state<Tool>('select');
  selection = $state<Selection>(null);
  wallThickness = $state(10);
  /** blobKey -> object URL for display */
  imageUrls = $state<Record<Id, string>>({});
  /** Cursor position in world cm, for the status bar. */
  cursor = $state<Point | null>(null);
  /** Help text for the current tool step, for the status bar. */
  hint = $state('');
  /** Bump to ask the canvas to fit the view. */
  fitRequest = $state(0);

  private history = new History<string>();
  private autosave = new Autosave(() => this.plainProject(), saveProject);

  constructor() {
    this.activeFloorId = this.project.floors[0].id;
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  get saveState(): SaveState {
    return this.autosave.state;
  }

  get floor(): Floor {
    return this.project.floors.find((f) => f.id === this.activeFloorId) ?? this.project.floors[0];
  }

  // ---------------------------------------------------------------- history + autosave
  /** Record the current state for undo, then apply `fn`. */
  mutate(fn: (p: Project) => void) {
    this.checkpoint();
    this.apply(fn);
  }

  /** The project as a plain object (no Svelte proxies), for saving and exporting. */
  private plainProject(): Project {
    return $state.snapshot(this.project) as Project;
  }

  /** The project as a JSON string, for the undo history. */
  private snapshot(): string {
    return JSON.stringify(this.plainProject());
  }

  /** Record an undo point without changing anything (e.g. at the start of a drag). */
  checkpoint() {
    this.history.record(this.snapshot());
  }

  /** Change without a new undo point (used while dragging). */
  apply(fn: (p: Project) => void) {
    fn(this.project);
    this.project.updatedAt = new Date().toISOString();
    this.autosave.schedule();
  }

  undo() {
    const prev = this.history.undo(this.snapshot());
    if (prev !== null) this.restore(prev);
  }

  redo() {
    const next = this.history.redo(this.snapshot());
    if (next !== null) this.restore(next);
  }

  private restore(json: string) {
    this.project = JSON.parse(json);
    if (!this.project.floors.some((f) => f.id === this.activeFloorId)) this.activeFloorId = this.project.floors[0].id;
    this.selection = null;
    this.autosave.schedule();
  }

  // ---------------------------------------------------------------- project lifecycle
  async loadLast() {
    const p = await loadLastProject();
    if (p) await this.setProject(migrateProject(p));
  }

  async setProject(p: Project) {
    for (const url of Object.values(this.imageUrls)) URL.revokeObjectURL(url);
    this.imageUrls = {};
    this.project = p;
    this.activeFloorId = p.floors[0]?.id ?? '';
    this.selection = null;
    this.history.clear();
    for (const key of blobKeys(p)) {
      const blob = await getBlob(key);
      if (blob) this.imageUrls[key] = URL.createObjectURL(blob);
    }
  }

  async newProject() {
    await this.setProject(createProject());
    this.autosave.schedule();
  }

  async exportFile(): Promise<Blob> {
    const text = await exportProjectFile(this.plainProject(), getBlob);
    return new Blob([text], { type: 'application/json' });
  }

  async importFile(text: string) {
    await this.setProject(await importProjectFile(text, putBlob));
    this.autosave.schedule();
  }

  /** mutate() scoped to the active floor. */
  mutateFloor(fn: (f: Floor) => void) {
    const id = this.activeFloorId;
    this.mutate((p) => onFloor(p, id, fn));
  }

  applyFloor(fn: (f: Floor) => void) {
    const id = this.activeFloorId;
    this.apply((p) => onFloor(p, id, fn));
  }

  removeSelection() {
    const sel = this.selection;
    if (sel?.kind === 'wall') this.mutateFloor((f) => (f.walls = f.walls.filter((w) => w.id !== sel.id)));
    const device = selectedDevice(this.project.devices, this.activeFloorId, sel);
    if (device)
      this.mutate((p) => {
        removeDevice(p, device.id);
        tidyGangs(p);
      });
    this.selection = null;
  }

  // ---------------------------------------------------------------- floors
  addFloor() {
    const top = Math.max(...this.project.floors.map((f) => f.level));
    const f = createFloor(`Verdieping ${this.project.floors.length}`, top + 300);
    this.mutate((p) => p.floors.push(f));
    this.activeFloorId = f.id;
    this.selection = null;
  }

  removeFloor(id: Id) {
    if (this.project.floors.length <= 1) return;
    this.mutate((p) => {
      removeFloor(p, id);
      tidyGangs(p);
    });
    if (this.activeFloorId === id) this.activeFloorId = this.project.floors[0].id;
    this.selection = null;
  }

  selectFloor(id: Id) {
    this.activeFloorId = id;
    this.selection = null;
  }

  // ---------------------------------------------------------------- background
  async setBackground(blob: Blob, bg: Omit<Background, 'blobKey'>) {
    const key = uid();
    await putBlob(key, blob);
    this.imageUrls[key] = URL.createObjectURL(blob);
    this.mutateFloor((f) => (f.background = { ...bg, blobKey: key }));
    this.fitRequest++;
  }
}

export const store = new Store();
