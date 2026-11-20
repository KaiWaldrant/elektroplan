import { atLength, dist } from '../../../model/geometry';
import { parsePositiveDecimal } from '../../../model/numbers';
import { uid } from '../../../model/project';
import type { Point } from '../../../model/types';
import { store } from '../../../state/store.svelte';
import { snapPointer } from './snapPointer';
import type { CanvasPointer, CanvasTool, PressResult } from './tool';

/** Draws a chain of walls: click point after point, or type a length in cm + Enter. */
export class WallTool implements CanvasTool {
  /** End of the last wall drawn (or the first click); null when no chain is being drawn. */
  chainStart = $state<Point | null>(null);
  /** Where the next wall would end. */
  preview = $state<Point | null>(null);
  /** Length typed so far, in cm. */
  lengthInput = $state('');
  snapMark = $state<Point | null>(null);

  get hint(): string {
    return this.chainStart
      ? 'Klik het volgende punt, of typ een lengte in cm + Enter. Dubbelklik, rechtsklik of Esc om te stoppen. Alt = niet snappen.'
      : 'Klik het beginpunt van de muur.';
  }

  pointerDown(p: CanvasPointer): PressResult {
    const s = this.snap(p);
    if (this.chainStart) this.addWallTo(this.target(s));
    else this.chainStart = s;
    return null;
  }

  pointerMove(p: CanvasPointer) {
    const s = this.snap(p);
    this.preview = this.chainStart ? this.target(s) : null;
  }

  keyDown(e: KeyboardEvent, p: CanvasPointer | null): boolean {
    if (!this.chainStart) return false;
    if (/^[0-9.,]$/.test(e.key)) {
      this.lengthInput += e.key;
      if (this.preview && p) this.preview = this.target(this.snap(p));
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
    if (e.key === 'Backspace') {
      this.lengthInput = this.lengthInput.slice(0, -1);
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
    if (e.key === 'Enter' && this.preview) {
      this.addWallTo({ ...this.preview });
      e.preventDefault();
      return true;
    }
    return false;
  }

  /** A double-click ends the chain. */
  doubleClick() {
    this.cancel();
  }

  cancel() {
    this.chainStart = null;
    this.preview = null;
    this.lengthInput = '';
    this.snapMark = null;
  }

  private snap(p: CanvasPointer): Point {
    const s = snapPointer(p, { from: this.chainStart });
    this.snapMark = s.mark;
    return s.point;
  }

  /** `s`, or the point at the typed length in the direction of `s`. */
  private target(s: Point): Point {
    const len = parsePositiveDecimal(this.lengthInput);
    return this.chainStart && len ? atLength(this.chainStart, s, len) : s;
  }

  /** Add a wall from the chain start to `end` and continue the chain from there. */
  private addWallTo(end: Point) {
    const start = this.chainStart;
    if (start && dist(start, end) >= 1) {
      const thickness = store.wallThickness;
      store.mutateFloor((f) => f.walls.push({ id: uid(), a: { ...start }, b: { ...end }, thickness }));
    }
    this.chainStart = end;
    this.lengthInput = '';
  }
}
