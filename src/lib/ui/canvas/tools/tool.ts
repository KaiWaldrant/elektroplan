import type { Point } from '../../../model/types';

/** A pointer position as a canvas tool sees it. */
export interface CanvasPointer {
  /** Position in world cm. */
  world: Point;
  /** Alt held: don't snap (except to wall ends). */
  free: boolean;
  /** Size of one screen pixel in world cm, for screen-sized tolerances. */
  cmPerScreenPx: number;
  /** Snap distance in world cm at the current zoom. */
  snapTolerance: number;
}

/** What the canvas should do after a pointer press: capture the pointer for a drag, start panning, or nothing. */
export type PressResult = 'capture' | 'pan' | null;

/** One editor tool's behaviour on the canvas. The canvas passes it the events while it is the active tool. */
export interface CanvasTool {
  /** Help text for the current step, for the status bar. */
  readonly hint: string;
  /** Where to show the snap marker, or null. */
  readonly snapMark: Point | null;
  pointerDown(p: CanvasPointer): PressResult;
  pointerMove(p: CanvasPointer): void;
  pointerUp?(): void;
  /**
   * A key press on the canvas; `p` is the last pointer position, if the pointer is on the canvas.
   * Returns true when the tool handled the key.
   */
  keyDown?(e: KeyboardEvent, p: CanvasPointer | null): boolean;
  doubleClick?(): void;
  /** Drop the half-finished action (Esc, right-click, switching tools). */
  cancel(): void;
}
