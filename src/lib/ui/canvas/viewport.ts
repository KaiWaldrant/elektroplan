import { bounds } from '../../model/geometry';
import type { Point, SizePx } from '../../model/types';

/** What the canvas shows: `x`/`y` is the world point (cm) at the top-left corner, `zoom` is screen px per cm. */
export interface View {
  x: number;
  y: number;
  zoom: number;
}

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 50;
/** Shown when there is nothing to fit. */
const EMPTY_BOX = { min: { x: 0, y: 0 }, max: { x: 1000, y: 800 } };
/** Smallest box side fitView zooms to, in cm. */
const MIN_FIT_CM = 100;
/** Part of the screen the fitted box fills. */
const FIT_MARGIN = 0.9;

/** The world point (cm) at screen point `screen`, measured from the canvas's top-left corner. */
export function toWorld(view: View, screen: Point): Point {
  return { x: view.x + screen.x / view.zoom, y: view.y + screen.y / view.zoom };
}

/** A view that centres `points` and fits them on a screen of `size`. */
export function fitView(points: Point[], size: SizePx): View {
  const b = bounds(points) ?? EMPTY_BOX;
  const width = Math.max(b.max.x - b.min.x, MIN_FIT_CM);
  const height = Math.max(b.max.y - b.min.y, MIN_FIT_CM);
  const zoom = Math.min(size.widthPx / width, size.heightPx / height) * FIT_MARGIN;
  return {
    x: (b.min.x + b.max.x) / 2 - size.widthPx / zoom / 2,
    y: (b.min.y + b.max.y) / 2 - size.heightPx / zoom / 2,
    zoom,
  };
}

/** Zoom for one wheel step, keeping the world point under `screen` in place. */
export function zoomAt(view: View, screen: Point, wheelDeltaY: number): View {
  const anchor = toWorld(view, screen);
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * Math.pow(1.0015, -wheelDeltaY)));
  return { x: anchor.x - screen.x / zoom, y: anchor.y - screen.y / zoom, zoom };
}

/**
 * The view after dragging the canvas by `screenDelta` px since `viewStart`, at the current `zoom`
 * (the wheel may have zoomed during the drag).
 */
export function panBy(viewStart: View, screenDelta: Point, zoom: number): View {
  return { x: viewStart.x - screenDelta.x / zoom, y: viewStart.y - screenDelta.y / zoom, zoom };
}
