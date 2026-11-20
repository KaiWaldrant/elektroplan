import { blobKeys, createFloor, createProject, parseProjectFile, uid, type ProjectFile } from '../model/project';
import type { Background, Floor, Id, Project, Selection } from '../model/types';
import { getBlob, loadLastProject, putBlob, saveProject } from '../storage/idb';

export type Tool = 'select' | 'wall' | 'calibrate' | 'measure';
export type { Selection } from '../model/types';

const HISTORY_LIMIT = 200;

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
  saveState = $state<'saved' | 'saving' | 'error'>('saved');
  canUndo = $state(false);
  canRedo = $state(false);
  /** Cursor position in world cm, for the status bar. */
  cursor = $state<{ x: number; y: number } | null>(null);
  /** Help text for the current tool step, for the status bar. */
  hint = $state('');
  /** Bump to ask the canvas to fit the view. */
  fitRequest = $state(0);

  private past: string[] = [];
  private future: string[] = [];
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.activeFloorId = this.project.floors[0].id;
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

  /** The project as a JSON string, for the undo history. */
  private snapshot(): string {
    return JSON.stringify($state.snapshot(this.project));
  }

  /** Record an undo point without changing anything (e.g. at the start of a drag). */
  checkpoint() {
    this.past.push(this.snapshot());
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.future = [];
    this.syncHistoryFlags();
  }

  /** Change without a new undo point (used while dragging). */
  apply(fn: (p: Project) => void) {
    fn(this.project);
    this.project.updatedAt = new Date().toISOString();
    this.scheduleSave();
  }

  undo() {
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push(this.snapshot());
    this.restore(prev);
  }

  redo() {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.snapshot());
    this.restore(next);
  }

  private restore(json: string) {
    this.project = JSON.parse(json);
    if (!this.project.floors.some((f) => f.id === this.activeFloorId)) this.activeFloorId = this.project.floors[0].id;
    this.selection = null;
    this.syncHistoryFlags();
    this.scheduleSave();
  }

  private syncHistoryFlags() {
    this.canUndo = this.past.length > 0;
    this.canRedo = this.future.length > 0;
  }

  private scheduleSave() {
    this.saveState = 'saving';
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => {
      try {
        await saveProject($state.snapshot(this.project) as Project);
        this.saveState = 'saved';
      } catch (e) {
        console.error(e);
        this.saveState = 'error';
      }
    }, 400);
  }

  // ---------------------------------------------------------------- project lifecycle
  async loadLast() {
    const p = await loadLastProject();
    if (p) await this.setProject(p);
  }

  async setProject(p: Project) {
    for (const url of Object.values(this.imageUrls)) URL.revokeObjectURL(url);
    this.imageUrls = {};
    this.project = p;
    this.activeFloorId = p.floors[0]?.id ?? '';
    this.selection = null;
    this.past = [];
    this.future = [];
    this.syncHistoryFlags();
    for (const key of blobKeys(p)) {
      const blob = await getBlob(key);
      if (blob) this.imageUrls[key] = URL.createObjectURL(blob);
    }
  }

  async newProject() {
    await this.setProject(createProject());
    this.scheduleSave();
  }

  async exportFile(): Promise<Blob> {
    const blobs: Record<Id, string> = {};
    for (const key of blobKeys(this.project)) {
      const b = await getBlob(key);
      if (b) blobs[key] = await blobToDataUrl(b);
    }
    const file: ProjectFile = { format: 'elektroplan', version: 1, project: $state.snapshot(this.project) as Project, blobs };
    return new Blob([JSON.stringify(file)], { type: 'application/json' });
  }

  async importFile(text: string) {
    const f = parseProjectFile(text);
    for (const [key, dataUrl] of Object.entries(f.blobs)) await putBlob(key, await (await fetchDataUrl(dataUrl)).blob());
    await this.setProject(f.project);
    this.scheduleSave();
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
    this.selection = null;
  }

  // ---------------------------------------------------------------- floors
  addFloor() {
    const top = Math.max(...this.project.floors.map((f) => f.level));
    const f = createFloor(`Verdieping ${this.project.floors.length}`, top + 300);
    this.mutate((p) => p.floors.push(f));
    this.activeFloorId = f.id;
  }

  removeFloor(id: Id) {
    if (this.project.floors.length <= 1) return;
    this.mutate((p) => (p.floors = p.floors.filter((f) => f.id !== id)));
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
    const floorId = this.activeFloorId;
    this.mutate((p) => onFloor(p, floorId, (f) => (f.background = { ...bg, blobKey: key })));
    this.fitRequest++;
  }
}

export const store = new Store();

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
}

/** data: URLs are decoded locally; this is not a network request. */
function fetchDataUrl(dataUrl: string): Promise<Response> {
  if (!dataUrl.startsWith('data:')) throw new Error('Alleen ingebedde afbeeldingen zijn toegestaan.');
  const [head, body] = dataUrl.split(',', 2);
  const mime = head.slice(5).split(';')[0] || 'application/octet-stream';
  const bin = head.includes(';base64') ? atob(body) : decodeURIComponent(body);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return Promise.resolve(new Response(new Blob([bytes], { type: mime })));
}
