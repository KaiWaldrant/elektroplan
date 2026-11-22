<script lang="ts">
  import { untrack } from 'svelte';
  import { backgroundCorners } from '../model/geometry';
  import type { Id, Point } from '../model/types';
  import { selectedControl } from '../model/controls';
  import { selectedRoom } from '../model/rooms';
  import { selectedWall } from '../model/walls';
  import { store } from '../state/store.svelte';
  import type { Tool } from '../state/tools';
  import NumberDialog from './NumberDialog.svelte';
  import { isWallMounted, kindFromKey } from '../model/deviceTypes';
  import { devicesOnFloor, placeDevice, positionAt, selectedDevice } from '../model/devices';
  import { gangMembers, joinGang, joinTargetAt } from '../model/gangs';
  import BackgroundLayer from './canvas/BackgroundLayer.svelte';
  import ControlLayer from './canvas/ControlLayer.svelte';
  import DevicesLayer from './canvas/DevicesLayer.svelte';
  import { DEVICE_DRAG_TYPE, WALL_DEVICE_DRAG_TYPE } from './canvas/deviceDrag';
  import Overlay from './canvas/Overlay.svelte';
  import RoomsLayer from './canvas/RoomsLayer.svelte';
  import WallsLayer from './canvas/WallsLayer.svelte';
  import { ControlTool } from './canvas/tools/controlTool.svelte';
  import { PickTool } from './canvas/tools/pickTool.svelte';
  import { RoomTool } from './canvas/tools/roomTool.svelte';
  import { SelectTool } from './canvas/tools/selectTool.svelte';
  import type { CanvasPointer, CanvasTool } from './canvas/tools/tool';
  import { WallTool } from './canvas/tools/wallTool.svelte';
  import { SNAP_PX } from './canvas/snapping';
  import { fitView, panBy, toWorld, zoomAt, type View } from './canvas/viewport';

  let svg: SVGSVGElement;
  let widthPx = $state(800);
  let heightPx = $state(600);
  let view = $state<View>({ x: -100, y: -100, zoom: 1 });
  /** Set while the canvas is dragged to pan. */
  let pan: { screenStart: Point; viewStart: View } | null = null;
  let spaceDown = false;

  const tools = {
    select: new SelectTool(),
    wall: new WallTool(),
    room: new RoomTool(),
    control: new ControlTool(),
    measure: new PickTool('measure'),
    calibrate: new PickTool('calibrate'),
  } satisfies Record<Tool, CanvasTool>;
  const active: CanvasTool = $derived(tools[store.tool]);

  const floor = $derived(store.floor);
  const cmPerScreenPx = $derived(1 / view.zoom);
  const floorDevices = $derived(devicesOnFloor(store.project.devices, floor.id));
  const selected = $derived(selectedDevice(store.project.devices, floor.id, store.selection));
  const activeControl = $derived(selectedControl(store.project, store.selection));
  /** The Toestellen with these ids that are placed on the shown floor. */
  const onThisFloor = (ids: Id[]) => floorDevices.filter((d) => ids.includes(d.id));
  /** The Toestel a wall Toestel dragged from the palette would join if dropped now. */
  let paletteTarget = $state<string | null>(null);
  const joinTarget = $derived(paletteTarget ?? (active instanceof SelectTool ? active.joinTarget : null));
  /** Calibrating moves what is placed on the floor (ADR 0004); the dialog says so. */
  const calibrationNote = $derived.by(() => {
    const moving = [
      floor.walls.length > 0 && 'muren',
      floor.rooms.length > 0 && 'ruimtes',
      floorDevices.length > 0 && 'toestellen',
    ].filter(Boolean);
    if (!moving.length) return undefined;
    const list = moving.length > 1 ? `${moving.slice(0, -1).join(', ')} en ${moving.at(-1)}` : moving[0];
    return `De ${list} op deze verdieping schalen mee.`;
  });

  // ---------------------------------------------------------------- view
  /** The pointer position relative to the canvas's top-left corner, in screen px. */
  function screenPoint(e: { clientX: number; clientY: number }): Point {
    const r = svg.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function canvasPointer(world: Point, altKey: boolean): CanvasPointer {
    return { world, free: altKey, cmPerScreenPx, snapTolerance: SNAP_PX * cmPerScreenPx };
  }

  function fit() {
    const points = [...floor.walls.flatMap((w) => [w.a, w.b]), ...floor.rooms.flatMap((r) => r.polygon)];
    if (floor.background) points.push(...backgroundCorners(floor.background));
    view = fitView(points, { widthPx, heightPx });
  }

  $effect(() => {
    void store.fitRequest;
    void store.activeFloorId;
    untrack(fit);
  });

  $effect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      view = zoomAt(view, screenPoint(e), e.deltaY);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  });

  function startPan(e: PointerEvent) {
    pan = { screenStart: { x: e.clientX, y: e.clientY }, viewStart: { ...view } };
    svg.setPointerCapture(e.pointerId);
  }

  // ---------------------------------------------------------------- tools
  $effect(() => {
    store.hint = active.hint;
  });

  $effect(() => {
    // leaving a tool cancels its half-finished action
    const tool = active;
    return () => untrack(() => tool.cancel());
  });

  function onpointerdown(e: PointerEvent) {
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    const press = active.pointerDown(canvasPointer(toWorld(view, screenPoint(e)), e.altKey));
    if (press === 'pan') startPan(e);
    else if (press === 'capture') svg.setPointerCapture(e.pointerId);
  }

  function onpointermove(e: PointerEvent) {
    const world = toWorld(view, screenPoint(e));
    store.cursor = world;
    if (pan) {
      view = panBy(
        pan.viewStart,
        { x: e.clientX - pan.screenStart.x, y: e.clientY - pan.screenStart.y },
        view.zoom,
      );
      return;
    }
    active.pointerMove(canvasPointer(world, e.altKey));
  }

  function onpointerup() {
    pan = null;
    active.pointerUp?.();
  }

  // ---------------------------------------------------------------- Toestellen dropped from the palette
  /** The Toestel whose Combinatie a dropped Toestel joins: only wall Toestellen join, and not with Alt held. */
  function dropTarget(e: DragEvent, wallMounted: boolean): string | null {
    if (!wallMounted || e.altKey) return null;
    return joinTargetAt(store.project, floor.id, toWorld(view, screenPoint(e)), 4 * cmPerScreenPx)?.id ?? null;
  }

  function ondragover(e: DragEvent) {
    if (!e.dataTransfer?.types.includes(DEVICE_DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    // the kind key can only be read on drop, but the types list says whether it is a wall Toestel
    paletteTarget = dropTarget(e, e.dataTransfer.types.includes(WALL_DEVICE_DRAG_TYPE));
  }

  function ondrop(e: DragEvent) {
    paletteTarget = null;
    const kind = kindFromKey(e.dataTransfer?.getData(DEVICE_DRAG_TYPE) ?? '');
    if (!kind) return;
    e.preventDefault();
    const world = toWorld(view, screenPoint(e));
    const target = dropTarget(e, isWallMounted(kind));
    const { at, rotation } = positionAt(kind, floor.walls, world, e.altKey);
    const floorId = floor.id;
    let id = '';
    store.mutate((p) => {
      id = placeDevice(p, floorId, kind, at, rotation).id;
      if (target) joinGang(p, id, target, world);
    });
    store.selection = { kind: 'device', id };
  }

  function onkeydown(e: KeyboardEvent) {
    // typing in a field or a dialog is not a canvas shortcut (same rule as App's shortcuts)
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, .dialog')) return;
    if (e.key === ' ') {
      spaceDown = true;
      e.preventDefault();
      return;
    }
    const pointer = store.cursor ? canvasPointer(store.cursor, e.altKey) : null;
    if (active.keyDown?.(e, pointer)) return;
    if (e.key === 'Escape') active.cancel();
  }
</script>

<!-- capture: the active tool sees a key before App's global shortcuts (Backspace removes a corner, not the selection) -->
<svelte:window onkeydowncapture={onkeydown} onkeyup={(e) => e.key === ' ' && (spaceDown = false)} />

<div
  class="canvas"
  bind:clientWidth={widthPx}
  bind:clientHeight={heightPx}
  {ondragover}
  {ondrop}
  ondragleave={() => (paletteTarget = null)}
  role="presentation"
>
  <svg
    bind:this={svg}
    class="tool-{store.tool}"
    viewBox="{view.x} {view.y} {widthPx / view.zoom} {heightPx / view.zoom}"
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onpointerleave={() => (store.cursor = null)}
    ondblclick={() => active.doubleClick?.()}
    oncontextmenu={(e) => {
      e.preventDefault();
      active.cancel();
    }}
    role="application"
    aria-label="Plan"
  >
    <BackgroundLayer
      {view}
      worldWidth={widthPx / view.zoom}
      worldHeight={heightPx / view.zoom}
      background={floor.background}
      imageUrl={floor.background ? store.imageUrls[floor.background.blobKey] : undefined}
    />
    <RoomsLayer rooms={floor.rooms} selected={selectedRoom(floor, store.selection)} zoom={view.zoom} />
    <WallsLayer walls={floor.walls} selected={selectedWall(floor, store.selection)} zoom={view.zoom} />
    {#if activeControl}
      <ControlLayer
        lights={onThisFloor(activeControl.lightPointIds)}
        controllers={onThisFloor(activeControl.controllerIds)}
        zoom={view.zoom}
      />
    {/if}
    <DevicesLayer
      devices={floorDevices}
      selectedId={selected?.id}
      selectedGang={selected ? gangMembers(store.project, selected.id).map((d) => d.id) : []}
      targetGang={joinTarget ? gangMembers(store.project, joinTarget).map((d) => d.id) : []}
    />
    <Overlay tool={active} zoom={view.zoom} wallThickness={store.wallThickness} />
  </svg>
</div>

{#if tools.calibrate.askingDistance}
  <NumberDialog
    title="Kalibreren"
    label="Werkelijke afstand tussen de twee punten"
    note={calibrationNote}
    onconfirm={(realCm) => tools.calibrate.confirmDistance(realCm)}
    oncancel={() => tools.calibrate.cancel()}
  />
{/if}

<style>
  .canvas {
    position: relative;
    overflow: hidden;
    background: var(--canvas);
  }
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
    user-select: none;
  }
  svg.tool-wall,
  svg.tool-room,
  svg.tool-control,
  svg.tool-calibrate,
  svg.tool-measure {
    cursor: crosshair;
  }
</style>
