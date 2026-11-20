<script lang="ts">
  import { untrack } from 'svelte';
  import {
    atLength,
    backgroundExtent,
    bounds,
    calibrate,
    dist,
    formatLength,
    hitWall,
    nearestPoint,
    projectOnSegment,
    snapAngle,
    wallNormal,
    wallPolygon,
  } from '../model/geometry';
  import { parseDecimal } from '../model/numbers';
  import { connectedEnds, moveEnds, selectedWall as findSelectedWall, translateWall } from '../model/walls';
  import { uid } from '../model/project';
  import type { Point, Wall, WallEnd } from '../model/types';
  import { store } from '../state/store.svelte';
  import NumberDialog from './NumberDialog.svelte';

  type Drag =
    | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
    | { kind: 'end'; ends: WallEnd[]; moved: boolean }
    | { kind: 'wall'; wallId: string; start: Point; walls: Wall[]; moved: boolean };

  const SNAP_PX = 10;

  let svg: SVGSVGElement;
  let w = $state(800);
  let h = $state(600);
  let view = $state({ x: -100, y: -100, zoom: 1 }); // zoom = screen px per cm

  const floor = $derived(store.floor);
  const bg = $derived(floor.background);
  const bgUrl = $derived(bg ? store.imageUrls[bg.blobKey] : undefined);
  const px = $derived(1 / view.zoom); // one screen pixel in world cm

  let snapMark = $state<Point | null>(null);
  let chainStart = $state<Point | null>(null);
  let preview = $state<Point | null>(null);
  let lengthInput = $state('');
  let picks = $state<Point[]>([]);
  let calibDialog = $state(false);
  let drag: Drag | null = null;
  let spaceDown = false;

  const selectedWall = $derived(findSelectedWall(floor, store.selection));
  const bgExtent = $derived(bg ? backgroundExtent(bg) : null);

  // ---------------------------------------------------------------- view
  function toWorld(e: { clientX: number; clientY: number }): Point {
    const r = svg.getBoundingClientRect();
    return { x: view.x + (e.clientX - r.left) / view.zoom, y: view.y + (e.clientY - r.top) / view.zoom };
  }

  function fit() {
    const pts = floor.walls.flatMap((x) => [x.a, x.b]);
    if (bg && bgExtent) pts.push(bg.offset, { x: bg.offset.x + bgExtent.width, y: bg.offset.y + bgExtent.height });
    const b = bounds(pts) ?? { min: { x: 0, y: 0 }, max: { x: 1000, y: 800 } };
    const bw = Math.max(b.max.x - b.min.x, 100);
    const bh = Math.max(b.max.y - b.min.y, 100);
    const zoom = Math.min(w / bw, h / bh) * 0.9;
    view = { x: (b.min.x + b.max.x) / 2 - w / zoom / 2, y: (b.min.y + b.max.y) / 2 - h / zoom / 2, zoom };
  }

  $effect(() => {
    void store.fitRequest;
    void store.activeFloorId;
    untrack(fit);
  });

  $effect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toWorld(e);
      const zoom = Math.min(50, Math.max(0.02, view.zoom * Math.pow(1.0015, -e.deltaY)));
      const r = svg.getBoundingClientRect();
      view = { x: p.x - (e.clientX - r.left) / zoom, y: p.y - (e.clientY - r.top) / zoom, zoom };
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  });

  // ---------------------------------------------------------------- snapping
  function snap(p: Point, e: { altKey: boolean }, from: Point | null = null, exclude: WallEnd[] = []): Point {
    const tol = SNAP_PX * px;
    const ends: Point[] = [];
    for (const wl of floor.walls) {
      if (!exclude.some((r) => r.wallId === wl.id && r.end === 'a')) ends.push(wl.a);
      if (!exclude.some((r) => r.wallId === wl.id && r.end === 'b')) ends.push(wl.b);
    }
    const near = nearestPoint(ends, p, tol);
    if (near) {
      snapMark = { ...near };
      return { ...near };
    }
    snapMark = null;
    if (e.altKey) return round(p);
    let q = from ? snapAngle(from, p, 15) : p;
    for (const wl of floor.walls) {
      if (exclude.some((r) => r.wallId === wl.id)) continue;
      const pr = projectOnSegment(q, wl.a, wl.b);
      if (pr.dist < tol) {
        q = pr.point;
        snapMark = round(q);
        break;
      }
    }
    return round(q);
  }

  const round = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });

  // ---------------------------------------------------------------- wall drawing
  function typedLength(): number | null {
    const v = parseDecimal(lengthInput);
    return v !== null && v > 0 ? v : null;
  }

  function wallTarget(s: Point): Point {
    const len = typedLength();
    return chainStart && len ? atLength(chainStart, s, len) : s;
  }

  function addWall(a: Point, b: Point) {
    if (dist(a, b) < 1) return;
    const t = store.wallThickness;
    store.mutateFloor((f) => f.walls.push({ id: uid(), a: { ...a }, b: { ...b }, thickness: t }));
  }

  function endChain() {
    chainStart = null;
    preview = null;
    lengthInput = '';
  }

  // ---------------------------------------------------------------- pointer handling
  function onpointerdown(e: PointerEvent) {
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    const p = toWorld(e);
    switch (store.tool) {
      case 'wall': {
        const s = snap(p, e, chainStart);
        if (chainStart) {
          const t = wallTarget(s);
          addWall(chainStart, t);
          chainStart = t;
          lengthInput = '';
        } else {
          chainStart = s;
        }
        break;
      }
      case 'calibrate':
      case 'measure': {
        if (picks.length >= 2) picks = [];
        const s = snap(p, e, picks[0] ?? null);
        picks = [...picks, s];
        if (store.tool === 'calibrate' && picks.length === 2) calibDialog = true;
        break;
      }
      case 'select': {
        if (selectedWall) {
          for (const end of ['a', 'b'] as const) {
            if (dist(selectedWall[end], p) <= SNAP_PX * px) {
              drag = { kind: 'end', ends: connectedEnds(floor.walls, selectedWall[end]), moved: false };
              svg.setPointerCapture(e.pointerId);
              return;
            }
          }
        }
        const i = hitWall(floor.walls, p, 4 * px);
        if (i >= 0) {
          const wl = floor.walls[i];
          store.selection = { kind: 'wall', id: wl.id };
          drag = { kind: 'wall', wallId: wl.id, start: p, walls: $state.snapshot(floor.walls) as Wall[], moved: false };
          svg.setPointerCapture(e.pointerId);
        } else {
          store.selection = null;
          startPan(e);
        }
        break;
      }
    }
  }

  function startPan(e: PointerEvent) {
    drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
    svg.setPointerCapture(e.pointerId);
  }

  function onpointermove(e: PointerEvent) {
    const p = toWorld(e);
    store.cursor = p;
    const d = drag;
    if (d?.kind === 'pan') {
      view = { ...view, x: d.vx - (e.clientX - d.sx) / view.zoom, y: d.vy - (e.clientY - d.sy) / view.zoom };
      return;
    }
    if (d?.kind === 'end') {
      if (!d.moved) {
        store.checkpoint();
        d.moved = true;
      }
      const s = snap(p, e, null, d.ends);
      store.applyFloor((f) => moveEnds(f.walls, d.ends, s));
      return;
    }
    if (d?.kind === 'wall') {
      const dx = Math.round(p.x - d.start.x);
      const dy = Math.round(p.y - d.start.y);
      if (!d.moved && Math.hypot(dx, dy) * view.zoom < 3) return;
      if (!d.moved) {
        store.checkpoint();
        d.moved = true;
      }
      store.applyFloor((f) => translateWall(f.walls, d.walls, d.wallId, dx, dy));
      return;
    }
    if (store.tool === 'wall') {
      const s = snap(p, e, chainStart);
      preview = chainStart ? wallTarget(s) : null;
    } else if (store.tool === 'calibrate' || store.tool === 'measure') {
      preview = picks.length === 1 ? snap(p, e, picks[0]) : (snap(p, e), null);
    } else {
      snapMark = null;
    }
  }

  function onpointerup() {
    drag = null;
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === ' ') {
      spaceDown = true;
      e.preventDefault();
      return;
    }
    if (store.tool === 'wall' && chainStart) {
      if (/^[0-9.,]$/.test(e.key)) {
        lengthInput += e.key;
        if (preview && store.cursor) preview = wallTarget(snap(store.cursor, e, chainStart));
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key === 'Backspace') {
        lengthInput = lengthInput.slice(0, -1);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key === 'Enter' && preview) {
        addWall(chainStart, preview);
        chainStart = { ...preview };
        lengthInput = '';
        e.preventDefault();
        return;
      }
    }
    if (e.key === 'Escape') {
      endChain();
      picks = [];
    }
  }

  $effect(() => {
    // leaving a tool cancels its half-finished action
    void store.tool;
    untrack(() => {
      endChain();
      picks = [];
      snapMark = null;
    });
  });

  $effect(() => {
    const t = store.tool;
    const n = picks.length;
    const chain = !!chainStart;
    store.hint =
      t === 'wall'
        ? chain
          ? 'Klik het volgende punt, of typ een lengte in cm + Enter. Dubbelklik, rechtsklik of Esc om te stoppen. Alt = niet snappen.'
          : 'Klik het beginpunt van de muur.'
        : t === 'calibrate'
          ? bg
            ? n === 0
              ? 'Kalibreren: klik het eerste punt van een gekende maat op het plan.'
              : 'Klik het tweede punt.'
            : 'Importeer eerst een plan om te kalibreren.'
          : t === 'measure'
            ? 'Meten: klik twee punten.'
            : 'Klik een muur om te selecteren; sleep om te verplaatsen. Sleep de achtergrond of gebruik het muiswiel om te pannen/zoomen.';
  });

  function confirmCalibration(realCm: number) {
    const [p1, p2] = picks;
    if (bg && p1 && p2) store.mutateFloor((f) => f.background && (f.background = calibrate(f.background, p1, p2, realCm)));
    calibDialog = false;
    picks = [];
    store.tool = 'select';
  }

  const pts = (poly: Point[]) => poly.map((p) => `${p.x},${p.y}`).join(' ');

  function labelPos(wl: Wall) {
    const n = wallNormal(wl);
    const off = wl.thickness / 2 + 9 * px;
    return { x: (wl.a.x + wl.b.x) / 2 + n.x * off, y: (wl.a.y + wl.b.y) / 2 + n.y * off };
  }
</script>

<svelte:window {onkeydown} onkeyup={(e) => e.key === ' ' && (spaceDown = false)} />

<div class="canvas" bind:clientWidth={w} bind:clientHeight={h}>
  <svg
    bind:this={svg}
    class="tool-{store.tool}"
    viewBox="{view.x} {view.y} {w / view.zoom} {h / view.zoom}"
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onpointerleave={() => (store.cursor = null)}
    ondblclick={() => store.tool === 'wall' && endChain()}
    oncontextmenu={(e) => {
      e.preventDefault();
      endChain();
      picks = [];
    }}
    role="application"
    aria-label="Plan"
  >
    <defs>
      <pattern id="grid-10" width="10" height="10" patternUnits="userSpaceOnUse">
        <path d="M 10 0 L 0 0 0 10" fill="none" stroke="var(--grid)" stroke-width={px * 0.6} />
      </pattern>
      <pattern id="grid-100" width="100" height="100" patternUnits="userSpaceOnUse">
        {#if view.zoom > 1.5}<rect width="100" height="100" fill="url(#grid-10)" />{/if}
        <path d="M 100 0 L 0 0 0 100" fill="none" stroke="var(--grid-strong)" stroke-width={px} />
      </pattern>
    </defs>
    <rect x={view.x} y={view.y} width={w / view.zoom} height={h / view.zoom} fill="url(#grid-100)" />

    {#if bg && bgUrl}
      <image
        href={bgUrl}
        x={bg.offset.x}
        y={bg.offset.y}
        width={bgExtent?.width}
        height={bgExtent?.height}
        opacity={bg.opacity}
        preserveAspectRatio="none"
        pointer-events="none"
      />
    {/if}

    {#each floor.walls as wl (wl.id)}
      <polygon points={pts(wallPolygon(wl))} class="wall" class:selected={wl.id === selectedWall?.id} />
    {/each}

    {#each floor.walls as wl (wl.id)}
      {#if dist(wl.a, wl.b) * view.zoom > 45}
        {@const lp = labelPos(wl)}
        <text x={lp.x} y={lp.y} font-size={11 * px} class="dim" dominant-baseline="middle" text-anchor="middle">
          {formatLength(dist(wl.a, wl.b))}
        </text>
      {/if}
    {/each}

    {#if selectedWall}
      {#each [selectedWall.a, selectedWall.b] as e, k (k)}
        <circle cx={e.x} cy={e.y} r={5 * px} class="handle" stroke-width={1.5 * px} />
      {/each}
    {/if}

    {#if chainStart && preview}
      <line x1={chainStart.x} y1={chainStart.y} x2={preview.x} y2={preview.y} class="preview" stroke-width={store.wallThickness} />
      <text x={preview.x + 10 * px} y={preview.y - 10 * px} font-size={12 * px} class="live">
        {lengthInput ? `${lengthInput} cm ⏎` : formatLength(dist(chainStart, preview))}
      </text>
    {/if}

    {#if picks.length > 0}
      {@const end = picks[1] ?? preview}
      {#each picks as p, k (k)}
        <circle cx={p.x} cy={p.y} r={4 * px} class="pick" />
      {/each}
      {#if end}
        <line x1={picks[0].x} y1={picks[0].y} x2={end.x} y2={end.y} class="measure" stroke-width={1.5 * px} />
        <text x={(picks[0].x + end.x) / 2 + 8 * px} y={(picks[0].y + end.y) / 2 - 8 * px} font-size={12 * px} class="live">
          {formatLength(dist(picks[0], end))}
        </text>
      {/if}
    {/if}

    {#if snapMark && store.tool !== 'select'}
      <rect x={snapMark.x - 5 * px} y={snapMark.y - 5 * px} width={10 * px} height={10 * px} class="snap" stroke-width={1.5 * px} />
    {/if}
  </svg>
</div>

{#if calibDialog && picks.length === 2}
  <NumberDialog
    title="Kalibreren"
    label="Werkelijke afstand tussen de twee punten"
    onconfirm={confirmCalibration}
    oncancel={() => {
      calibDialog = false;
      picks = [];
    }}
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
  svg.tool-calibrate,
  svg.tool-measure {
    cursor: crosshair;
  }
  .wall {
    fill: var(--wall);
    stroke: var(--wall-edge);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .wall.selected {
    fill: var(--accent);
  }
  .dim {
    fill: var(--dim);
    font-family: var(--font);
  }
  .live {
    fill: var(--accent);
    font-family: var(--font);
    font-weight: 600;
  }
  .handle {
    fill: #fff;
    stroke: var(--accent);
    cursor: move;
  }
  .preview {
    stroke: var(--accent);
    stroke-opacity: 0.45;
  }
  .measure {
    stroke: var(--accent);
    stroke-dasharray: 4 3;
  }
  .pick {
    fill: var(--accent);
  }
  .snap {
    fill: none;
    stroke: var(--snap);
  }
</style>
