import { dist } from '../../../model/geometry';
import { addRoom } from '../../../model/rooms';
import type { Point } from '../../../model/types';
import { store } from '../../../state/store.svelte';
import { snapPointer } from './snapPointer';
import type { CanvasPointer, CanvasTool, PressResult } from './tool';

/** Screen px within which a second press counts as the same corner (the two presses of a double-click, a shaky hand). */
const SAME_SPOT_PX = 4;
/** How long (ms) after closing a Ruimte a press on the same spot still belongs to the closing double-click. */
const DOUBLE_CLICK_MS = 500;

/** Draws a Ruimte: click corner after corner; a click on the first corner, a double-click or Enter closes it. */
export class RoomTool implements CanvasTool {
  /** The corners clicked so far. */
  corners = $state<Point[]>([]);
  /** Where the next corner would go. */
  preview = $state<Point | null>(null);
  snapMark = $state<Point | null>(null);
  /** The pointer is on the first corner, so a click closes the Ruimte. */
  closing = $state(false);
  /** Where and when the last Ruimte was closed by a click, so the rest of a double-click there is ignored. */
  private closedAt: { point: Point; time: number } | null = null;

  get hint(): string {
    if (this.corners.length === 0) return 'Ruimte: klik de eerste hoek (muurhoeken trekken aan).';
    if (this.corners.length < 3) return 'Klik de volgende hoek. Backspace = laatste hoek weg, Esc = stoppen. Alt = niet snappen.';
    return 'Klik de volgende hoek, of klik de eerste hoek, dubbelklik of Enter om de ruimte te sluiten.';
  }

  pointerDown(p: CanvasPointer): PressResult {
    const sameSpot = SAME_SPOT_PX * p.cmPerScreenPx;
    if (this.onFirstCorner(p)) {
      this.closedAt = { point: p.world, time: Date.now() };
      this.close();
      return null;
    }
    const c = this.closedAt;
    this.closedAt = null;
    if (c && this.corners.length === 0 && Date.now() - c.time < DOUBLE_CLICK_MS && dist(c.point, p.world) <= sameSpot)
      return null;
    const s = this.snap(p);
    const last = this.corners.at(-1);
    if (!last || dist(last, s) > sameSpot) this.corners = [...this.corners, s];
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
