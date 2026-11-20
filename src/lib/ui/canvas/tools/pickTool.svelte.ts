import { calibrate } from '../../../model/geometry';
import type { Point } from '../../../model/types';
import { store } from '../../../state/store.svelte';
import { SNAP_PX, snapPoint } from '../snapping';
import type { CanvasPointer, CanvasTool, PressResult } from './tool';

/**
 * Picks two points. 'measure' only shows their distance; 'calibrate' then asks for the
 * real distance (`askingDistance`) and scales the plan background to it.
 */
export class PickTool implements CanvasTool {
  /** The points clicked so far (at most two). */
  picks = $state<Point[]>([]);
  /** The pointer position as the second point, while one point is picked. */
  preview = $state<Point | null>(null);
  snapMark = $state<Point | null>(null);
  /** Calibrate only: the dialog for the real distance is open. */
  askingDistance = $state(false);

  constructor(readonly mode: 'measure' | 'calibrate') {}

  get hint(): string {
    if (this.mode === 'measure') return 'Meten: klik twee punten.';
    if (!store.floor.background) return 'Importeer eerst een plan om te kalibreren.';
    return this.picks.length === 0
      ? 'Kalibreren: klik het eerste punt van een gekende maat op het plan.'
      : 'Klik het tweede punt.';
  }

  pointerDown(p: CanvasPointer): PressResult {
    if (this.picks.length >= 2) this.picks = [];
    this.picks = [...this.picks, this.snap(p, this.picks[0] ?? null)];
    if (this.mode === 'calibrate' && this.picks.length === 2) this.askingDistance = true;
    return null;
  }

  pointerMove(p: CanvasPointer) {
    if (this.picks.length === 1) {
      this.preview = this.snap(p, this.picks[0]);
    } else {
      this.snap(p, null);
      this.preview = null;
    }
  }

  pointerUp() {}

  keyDown(): boolean {
    return false;
  }

  cancel() {
    this.picks = [];
    this.preview = null;
    this.snapMark = null;
    this.askingDistance = false;
  }

  /** Calibrate: scale the background so the two picked points are `realCm` apart, then go back to selecting. */
  confirmDistance(realCm: number) {
    const [p1, p2] = this.picks;
    if (store.floor.background && p1 && p2) {
      store.mutateFloor((f) => f.background && (f.background = calibrate(f.background, p1, p2, realCm)));
    }
    this.cancel();
    store.tool = 'select';
  }

  private snap(p: CanvasPointer, from: Point | null): Point {
    const s = snapPoint(store.floor.walls, p.world, { tolerance: SNAP_PX * p.cmPerScreenPx, from, free: p.free });
    this.snapMark = s.mark;
    return s.point;
  }
}
