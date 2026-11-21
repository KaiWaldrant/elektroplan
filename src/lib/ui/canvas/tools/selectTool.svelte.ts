import {
  findDevice,
  hitDevice,
  moveDevice,
  positionAt,
  rotateDevice,
  selectedDevice,
} from '../../../model/devices';
import { dist, hitWall } from '../../../model/geometry';
import { connectedEnds, moveEnds, selectedWall, translateWall } from '../../../model/walls';
import type { Id, Point, Wall, WallEnd } from '../../../model/types';
import { store } from '../../../state/store.svelte';
import { snapPointer } from './snapPointer';
import type { CanvasPointer, CanvasTool, PressResult } from './tool';

/** What every drag tracks: whether it has started moving (one undo point per drag). */
interface DragBase {
  moved: boolean;
}

/** A drag that moves something by the pointer's offset from where it was pressed. */
interface OffsetDrag extends DragBase {
  pointerStart: Point;
}

type Drag =
  /** Dragging a selected wall's end, together with the wall ends joined to it. */
  | (DragBase & { kind: 'end'; ends: WallEnd[] })
  /** Dragging a whole wall. */
  | (OffsetDrag & { kind: 'wall'; wallId: Id; wallsAtStart: Wall[] })
  /** Dragging a Toestel. */
  | (OffsetDrag & { kind: 'device'; deviceId: Id; atStart: Point });

/** Extra screen px around a wall that still counts as a click on it. */
const HIT_PX = 4;
/** Screen px a wall or Toestel must be dragged before it moves (so a click doesn't nudge it). */
const DRAG_START_PX = 3;

/** Selects Toestellen and walls and drags them (or a selected wall's ends); a press on empty canvas pans. */
export class SelectTool implements CanvasTool {
  private drag: Drag | null = null;

  readonly hint =
    'Klik een muur of toestel om te selecteren; sleep om te verplaatsen; R draait een toestel. Sleep de achtergrond of gebruik het muiswiel om te pannen/zoomen.';
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
    const device = hitDevice(store.project.devices, store.floor.id, p.world, HIT_PX * p.cmPerScreenPx);
    if (device) {
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
      const off = this.offset(d, p);
      if (off) store.applyFloor((f) => translateWall(f.walls, d.wallsAtStart, d.wallId, Math.round(off.x), Math.round(off.y)));
    } else if (d?.kind === 'device') {
      const off = this.offset(d, p);
      const device = findDevice(store.project.devices, d.deviceId);
      if (!off || !device) return;
      const target = { x: d.atStart.x + off.x, y: d.atStart.y + off.y };
      const { at, rotation } = positionAt(device, store.floor.walls, target, p.free);
      store.apply((pr) => moveDevice(pr.devices, d.deviceId, at, rotation));
    }
  }

  pointerUp() {
    this.drag = null;
  }

  keyDown(e: KeyboardEvent): boolean {
    if (e.key.toLowerCase() !== 'r' || e.ctrlKey || e.metaKey || e.altKey) return false;
    const device = selectedDevice(store.project.devices, store.floor.id, store.selection);
    if (!device) return false;
    store.mutate((pr) => rotateDevice(pr.devices, device.id));
    e.preventDefault();
    return true;
  }

  cancel() {
    this.drag = null;
  }

  /**
   * The pointer's offset since the press, or null while it is still within the click threshold.
   * The first real move starts the drag (one undo point).
   */
  private offset(d: OffsetDrag, p: CanvasPointer): Point | null {
    const off = { x: p.world.x - d.pointerStart.x, y: p.world.y - d.pointerStart.y };
    if (!d.moved && Math.hypot(off.x, off.y) / p.cmPerScreenPx < DRAG_START_PX) return null;
    this.startMoving(d);
    return off;
  }

  /** The first move of a drag records one undo point for the whole drag. */
  private startMoving(d: DragBase) {
    if (d.moved) return;
    store.checkpoint();
    d.moved = true;
  }
}
