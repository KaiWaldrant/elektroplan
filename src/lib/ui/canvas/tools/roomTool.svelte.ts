import { dist } from '../../../model/geometry';
import { addRoom } from '../../../model/rooms';
import type { Point } from '../../../model/types';
import { store } from '../../../state/store.svelte';
import { snapPointer } from './snapPointer';
import type { CanvasPointer, CanvasTool, PressResult } from './tool';

/** Draws a Ruimte: click corner after corner; a click on the first corner, a double-click or Enter closes it. */
export class RoomTool implements CanvasTool {
  /** The corners clicked so far. */
  corners = $state<Point[]>([]);
  /** Where the next corner would go. */
  preview = $state<Point | null>(null);
  snapMark = $state<Point | null>(null);
  /** The pointer is on the first corner, so a click closes the Ruimte. */
  closing = $state(false);

  get hint(): string {
    if (this.corners.length === 0) return 'Ruimte: klik de eerste hoek (muurhoeken trekken aan).';
    if (this.corners.length < 3) return 'Klik de volgende hoek. Backspace = laatste hoek weg, Esc = stoppen. Alt = niet snappen.';
    return 'Klik de volgende hoek, of klik de eerste hoek, dubbelklik of Enter om de ruimte te sluiten.';
  }

  pointerDown(p: CanvasPointer): PressResult {
    if (this.onFirstCorner(p)) {
      this.close();
      return null;
    }
    const s = this.snap(p);
    const last = this.corners.at(-1);
    // a new outline drops the selection, so Backspace (last corner away) cannot also delete the Ruimte drawn before
    if (!last) store.selection = null;
    // the presses of a double-click land on the same spot: one corner
    if (!last || dist(last, s) >= 1) this.corners = [...this.corners, s];
    return null;
  }

  pointerMove(p: CanvasPointer) {
    this.closing = this.onFirstCorner(p);
    const s = this.snap(p);
    this.preview = this.corners.length ? (this.closing ? this.corners[0] : s) : null;
  }

  keyDown(e: KeyboardEvent): boolean {
    if (this.corners.length === 0) return false;
    if (e.key === 'Enter') {
      this.close();
    } else if (e.key === 'Backspace') {
      this.corners = this.corners.slice(0, -1);
      if (this.corners.length === 0) this.preview = null;
    } else return false;
    e.preventDefault();
    e.stopPropagation();
    return true;
  }

  doubleClick() {
    this.close();
  }

  cancel() {
    this.corners = [];
    this.preview = null;
    this.snapMark = null;
    this.closing = false;
  }

  private onFirstCorner(p: CanvasPointer): boolean {
    return this.corners.length >= 3 && dist(this.corners[0], p.world) <= p.snapTolerance;
  }

  /** Add the Ruimte (at least three corners) and select it, so it can be named. */
  private close() {
    const corners = this.corners;
    this.cancel();
    if (corners.length < 3) return;
    let id = '';
    store.mutateFloor((f) => (id = addRoom(f, '', corners).id));
    store.selection = { kind: 'room', id };
  }

  private snap(p: CanvasPointer) {
    const s = snapPointer(p, { from: this.corners.at(-1) ?? null });
    this.snapMark = s.mark;
    return s.point;
  }
}
