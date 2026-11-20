import { describe, expect, it } from 'vitest';
import { fitView, panBy, toWorld, zoomAt, type View } from './viewport';

const screen = { widthPx: 800, heightPx: 600 };

describe('toWorld', () => {
  it('turns a screen point (relative to the canvas) into world cm', () => {
    const view: View = { x: -100, y: 50, zoom: 2 };
    expect(toWorld(view, { x: 0, y: 0 })).toEqual({ x: -100, y: 50 });
    expect(toWorld(view, { x: 200, y: 100 })).toEqual({ x: 0, y: 100 });
  });
});

describe('fitView', () => {
  it('centres the points and fills 90% of the screen on the tighter side', () => {
    // 1000 x 500 cm box: width is the tighter side (800/1000 < 600/500)
    const v = fitView([{ x: 0, y: 0 }, { x: 1000, y: 500 }], screen);
    expect(v.zoom).toBeCloseTo(0.72);
    const centre = toWorld(v, { x: 400, y: 300 });
    expect(centre.x).toBeCloseTo(500);
    expect(centre.y).toBeCloseTo(250);
  });
  it('treats a box smaller than 100 cm as 100 cm', () => {
    const v = fitView([{ x: 10, y: 10 }], screen);
    expect(v.zoom).toBeCloseTo(5.4); // min(800, 600) / 100 * 0.9
    const centre = toWorld(v, { x: 400, y: 300 });
    expect(centre.x).toBeCloseTo(10);
    expect(centre.y).toBeCloseTo(10);
  });
  it('shows 0..1000 x 0..800 cm when there is nothing to fit', () => {
    const v = fitView([], screen);
    expect(v.zoom).toBeCloseTo(0.675); // min(800/1000, 600/800) * 0.9
    const centre = toWorld(v, { x: 400, y: 300 });
    expect(centre.x).toBeCloseTo(500);
    expect(centre.y).toBeCloseTo(400);
  });
});

describe('zoomAt', () => {
  const view: View = { x: 0, y: 0, zoom: 1 };
  it('zooms in on wheel up and keeps the world point under the pointer in place', () => {
    const at = { x: 300, y: 200 };
    const v = zoomAt(view, at, -100);
    expect(v.zoom).toBeGreaterThan(1);
    expect(toWorld(v, at).x).toBeCloseTo(300);
    expect(toWorld(v, at).y).toBeCloseTo(200);
  });
  it('zooms out on wheel down', () => {
    expect(zoomAt(view, { x: 0, y: 0 }, 100).zoom).toBeLessThan(1);
  });
  it('keeps the zoom between 0.02 and 50', () => {
    expect(zoomAt(view, { x: 0, y: 0 }, 1e6).zoom).toBe(0.02);
    expect(zoomAt(view, { x: 0, y: 0 }, -1e6).zoom).toBe(50);
  });
});

describe('panBy', () => {
  it('moves the view against the drag, in screen px scaled by the zoom', () => {
    const start: View = { x: 100, y: 100, zoom: 2 };
    expect(panBy(start, { x: 40, y: -20 }, 2)).toEqual({ x: 80, y: 110, zoom: 2 });
  });
  it('keeps the current zoom when the wheel zoomed during the drag', () => {
    const start: View = { x: 100, y: 100, zoom: 2 };
    expect(panBy(start, { x: 40, y: -20 }, 4)).toEqual({ x: 90, y: 105, zoom: 4 });
  });
});
