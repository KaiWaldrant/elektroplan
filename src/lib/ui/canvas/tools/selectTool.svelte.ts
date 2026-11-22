import { isWallMounted } from '../../../model/deviceTypes';
import { findDevice, hitDevice, positionAt, selectedDevice } from '../../../model/devices';
import { gangMembers, joinGang, joinTargetAt, moveGang, rotateGang } from '../../../model/gangs';
import { dist, hitWall } from '../../../model/geometry';
import { moveRoomCorner, roomAt, selectedRoom, translateRoom } from '../../../model/rooms';
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
  /** Dragging one corner of the selected Ruimte. */
  | (DragBase & { kind: 'corner'; roomId: Id; index: number })
  /** Dragging a whole Ruimte. */
  | (OffsetDrag & { kind: 'room'; roomId: Id; polygonAtStart: Point[] })
  /** Dragging a whole wall. */
  | (OffsetDrag & { kind: 'wall'; wallId: Id; wallsAtStart: Wall[] })
  /**
   * Dragging a Toestel, with the rest of its Combinatie. The Combinatie's first Toestel (`leadId`,
   * at `atStart` when pressed) leads and snaps to walls, so a stacked one stays against the wall. A
   * lone wall Toestel (`canJoin`) joins the Combinatie it is dropped on; `last` is where the pointer
   * was last.
   */
  | (OffsetDrag & { kind: 'device'; deviceId: Id; leadId: Id; atStart: Point; canJoin: boolean; last: Point });

/** Extra screen px around a wall that still counts as a click on it. */
const HIT_PX = 4;
/** Screen px a wall or Toestel must be dragged before it moves (so a click doesn't nudge it). */
const DRAG_START_PX = 3;

/**
 * Selects Toestellen, walls and Ruimtes and drags them (or a selected wall's ends or Ruimte's
 * corners); a press on empty canvas pans. A Ruimte is only hit where no Toestel or wall is.
 */
export class SelectTool implements CanvasTool {
  private drag: Drag | null = null;
  /** The Toestel whose Combinatie the dragged Toestel joins when it is dropped now. */
  joinTarget = $state<Id | null>(null);

  readonly hint =
    'Klik een muur, toestel of ruimte om te selecteren; sleep om te verplaatsen (een ruimte pas als ze geselecteerd is; een los toestel op een ander vormt een combinatie); R draait een toestel. Sleep de achtergrond of gebruik het muiswiel om te pannen/zoomen.';
  readonly snapMark = null;

  pointerDown(p: CanvasPointer): PressResult {
    const walls = store.floor.walls;
    const room = selectedRoom(store.floor, store.selection);
    if (room) {
      const index = room.polygon.findIndex((c) => dist(c, p.world) <= p.snapTolerance);
      if (index >= 0) {
        this.drag = { kind: 'corner', roomId: room.id, index, moved: false };
        return 'capture';
      }
    }
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
      const members = gangMembers(store.project, device.id);
      const lead = members[0] ?? device;
      this.drag = {
        kind: 'device',
        deviceId: device.id,
        leadId: lead.id,
        pointerStart: p.world,
        atStart: { ...lead.placement.at },
        canJoin: members.length === 1 && isWallMounted(device),
        last: p.world,
        moved: false,
      };
      return 'capture';
    }
    const i = hitWall(walls, p.world, HIT_PX * p.cmPerScreenPx);
    if (i < 0) return this.pressRoom(p);
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
    } else if (d?.kind === 'corner') {
      this.startMoving(d);
      const s = snapPointer(p);
      store.applyFloor((f) => moveRoomCorner(f, d.roomId, d.index, s.point));
    } else if (d?.kind === 'room') {
      const off = this.offset(d, p);
      if (off) store.applyFloor((f) => translateRoom(f, d.roomId, d.polygonAtStart, off.x, off.y));
    } else if (d?.kind === 'wall') {
      const off = this.offset(d, p);
      if (off) store.applyFloor((f) => translateWall(f.walls, d.wallsAtStart, d.wallId, Math.round(off.x), Math.round(off.y)));
    } else if (d?.kind === 'device') {
      const off = this.offset(d, p);
      const lead = findDevice(store.project.devices, d.leadId);
      if (!off || !lead) return;
      const target = { x: d.atStart.x + off.x, y: d.atStart.y + off.y };
      const { at, rotation } = positionAt(lead, store.floor.walls, target, p.free);
      store.apply((pr) => moveGang(pr, d.leadId, at, rotation));
      d.last = p.world;
      const join = d.canJoin && !p.free && joinTargetAt(store.project, store.floor.id, p.world, HIT_PX * p.cmPerScreenPx, d.deviceId);
      this.joinTarget = join ? join.id : null;
    }
  }

  pointerUp() {
    const d = this.drag;
    const target = this.joinTarget;
    if (d?.kind === 'device' && d.moved && target) store.apply((pr) => joinGang(pr, d.deviceId, target, d.last));
    this.drag = null;
    this.joinTarget = null;
  }

  keyDown(e: KeyboardEvent): boolean {
    if (e.key.toLowerCase() !== 'r' || e.ctrlKey || e.metaKey || e.altKey) return false;
    const device = selectedDevice(store.project.devices, store.floor.id, store.selection);
    if (!device) return false;
    store.mutate((pr) => rotateGang(pr, device.id));
    e.preventDefault();
    return true;
  }

  cancel() {
    this.drag = null;
    this.joinTarget = null;
  }

  /**
   * A press on no Toestel or wall: an already selected Ruimte there is dragged; otherwise the Ruimte
   * there (if any) is selected and the press pans, so Ruimtes covering the plan don't block panning.
   */
  private pressRoom(p: CanvasPointer): PressResult {
    const room = roomAt(store.floor, p.world);
    if (!room || selectedRoom(store.floor, store.selection)?.id !== room.id) {
      store.selection = room ? { kind: 'room', id: room.id } : null;
      return 'pan';
    }
    const polygonAtStart = $state.snapshot(room.polygon) as Point[];
    this.drag = { kind: 'room', roomId: room.id, pointerStart: p.world, polygonAtStart, moved: false };
    return 'capture';
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
