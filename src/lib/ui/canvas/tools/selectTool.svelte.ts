import { hitDevice, moveDevice, SYMBOL_CM } from '../../../model/devices';
import { dist, hitWall } from '../../../model/geometry';
import { connectedEnds, moveEnds, selectedWall, translateWall } from '../../../model/walls';
import type { Id, Point, Wall, WallEnd } from '../../../model/types';
import { store } from '../../../state/store.svelte';
import { snapPointer } from './snapPointer';
import type { CanvasPointer, CanvasTool, PressResult } from './tool';

type Drag =
  /** Dragging a selected wall's end, together with the wall ends joined to it. */
  | { kind: 'end'; ends: WallEnd[]; moved: boolean }
  /** Dragging a whole wall. */
  | { kind: 'wall'; wallId: Id; pointerStart: Point; wallsAtStart: Wall[]; moved: boolean }
  /** Dragging a Toestel. */
  | { kind: 'device'; deviceId: Id; pointerStart: Point; atStart: Point; moved: boolean };

/** Extra screen px around a wall that still counts as a click on it. */
const HIT_PX = 4;
/** Screen px a wall must be dragged before it moves (so a click doesn't nudge it). */
const DRAG_START_PX = 3;

/** Selects Toestellen and walls and drags them (or a selected wall's ends); a press on empty canvas pans. */
export class SelectTool implements CanvasTool {
  private drag: Drag | null = null;

  readonly hint =
    'Klik een muur of Toestel om te selecteren; sleep om te verplaatsen. Sleep de achtergrond of gebruik het muiswiel om te pannen/zoomen.';
  readonly snapMark = null;

  pointerDown(p: CanvasPointer): PressResult {
    const walls = store.floor.walls;
    const selected = selectedWall(store.floor, store.selection);
    if (selected) {
      for (const end of ['a', 'b'] as const) {
        if (dist(selected[end], p.world) <= p.snapTolerance) {
          this.drag = { kind: 'end', ends: connectedEnds(walls, selected[end]), moved: false };
          return 'capture';
        }
      }
    }
    const device = hitDevice(store.project.devices, store.floor.id, p.world, SYMBOL_CM / 2 + HIT_PX * p.cmPerScreenPx);
    if (device?.placement) {
      store.selection = { kind: 'device', id: device.id };
      this.drag = {
        kind: 'device',
        deviceId: device.id,
        pointerStart: p.world,
        atStart: { ...device.placement.at },
        moved: false,
      };
      return 'capture';
    }
    const i = hitWall(walls, p.world, HIT_PX * p.cmPerScreenPx);
    if (i < 0) {
      store.selection = null;
      return 'pan';
    }
    const wall = walls[i];
    store.selection = { kind: 'wall', id: wall.id };
    this.drag = {
      kind: 'wall',
      wallId: wall.id,
      pointerStart: p.world,
      wallsAtStart: $state.snapshot(walls) as Wall[],
      moved: false,
    };
    return 'capture';
  }

  pointerMove(p: CanvasPointer) {
    const d = this.drag;
    if (d?.kind === 'end') {
      this.startMoving(d);
      const s = snapPointer(p, { exclude: d.ends });
      store.applyFloor((f) => moveEnds(f.walls, d.ends, s.point));
    } else if (d?.kind === 'wall') {
      const dx = Math.round(p.world.x - d.pointerStart.x);
      const dy = Math.round(p.world.y - d.pointerStart.y);
      if (!d.moved && Math.hypot(dx, dy) / p.cmPerScreenPx < DRAG_START_PX) return;
      this.startMoving(d);
      store.applyFloor((f) => translateWall(f.walls, d.wallsAtStart, d.wallId, dx, dy));
    } else if (d?.kind === 'device') {
      const dx = p.world.x - d.pointerStart.x;
      const dy = p.world.y - d.pointerStart.y;
      if (!d.moved && Math.hypot(dx, dy) / p.cmPerScreenPx < DRAG_START_PX) return;
      this.startMoving(d);
      store.apply((pr) => moveDevice(pr.devices, d.deviceId, { x: d.atStart.x + dx, y: d.atStart.y + dy }));
    }
  }

  pointerUp() {
    this.drag = null;
  }

  cancel() {
    this.drag = null;
  }

  /** The first move of a drag records one undo point for the whole drag. */
  private startMoving(d: Drag) {
    if (d.moved) return;
    store.checkpoint();
    d.moved = true;
  }
}
