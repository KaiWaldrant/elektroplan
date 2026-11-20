/**
 * Undo/redo history of snapshots. The caller owns the current state and passes it in.
 * `canUndo` and `canRedo` are reactive, so the UI can read them directly.
 */
export class History<T> {
  private past = $state.raw<T[]>([]);
  private future = $state.raw<T[]>([]);

  constructor(private readonly limit = 200) {}

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Remember `current` as an undo point; forgets the redo steps and the oldest step beyond the limit. */
  record(current: T) {
    this.past = [...this.past, current].slice(-this.limit);
    this.future = [];
  }

  /** The state to go back to, or null; `current` becomes redoable. */
  undo(current: T): T | null {
    if (this.past.length === 0) return null;
    const prev = this.past[this.past.length - 1];
    this.past = this.past.slice(0, -1);
    this.future = [...this.future, current];
    return prev;
  }

  /** The state to go forward to, or null; `current` becomes undoable. */
  redo(current: T): T | null {
    if (this.future.length === 0) return null;
    const next = this.future[this.future.length - 1];
    this.future = this.future.slice(0, -1);
    this.past = [...this.past, current];
    return next;
  }

  clear() {
    this.past = [];
    this.future = [];
  }
}
