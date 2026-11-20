import type { Point, WallEnd } from '../../../model/types';
import { store } from '../../../state/store.svelte';
import { snapPoint, type Snap } from '../snapping';
import type { CanvasPointer } from './tool';

/** Snap the pointer to the walls of the active floor, with the pointer's tolerance and Alt state. */
export function snapPointer(p: CanvasPointer, options: { from?: Point | null; exclude?: WallEnd[] } = {}): Snap {
  return snapPoint(store.floor.walls, p.world, { tolerance: p.snapTolerance, free: p.free, ...options });
}
