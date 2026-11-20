/** Undo/redo history of snapshots. The caller owns the current state and passes it in. */
export class History<T> {
  private past: T[] = [];
  private future: T[] = [];

  constructor(private readonly limit = 200) {}

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Remember `current` as an undo point; forgets the redo steps and the oldest step beyond the limit. */
  record(current: T) {
    this.past.push(current);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  /** The state to go back to, or null; `current` becomes redoable. */
  undo(current: T): T | null {
    const prev = this.past.pop();
    if (prev === undefined) return null;
    this.future.push(current);
    return prev;
  }

  /** The state to go forward to, or null; `current` becomes undoable. */
  redo(current: T): T | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    this.past.push(current);
    return next;
  }

  clear() {
    this.past = [];
    this.future = [];
  }
}
