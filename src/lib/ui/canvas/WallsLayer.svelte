<script lang="ts">
  import { dist, formatLength, wallNormal, wallPolygon } from '../../model/geometry';
  import type { Point, Wall } from '../../model/types';

  /** The walls, their length labels and the end handles of the selected wall. */
  let { walls, selected, zoom }: { walls: Wall[]; selected: Wall | undefined; zoom: number } = $props();

  const cmPerScreenPx = $derived(1 / zoom);
  /** Walls shorter than this on screen get no length label. */
  const LABEL_MIN_PX = 45;

  const svgPoints = (poly: Point[]) => poly.map((p) => `${p.x},${p.y}`).join(' ');

  function labelPos(w: Wall): Point {
    const n = wallNormal(w);
    const off = w.thickness / 2 + 9 * cmPerScreenPx;
    return { x: (w.a.x + w.b.x) / 2 + n.x * off, y: (w.a.y + w.b.y) / 2 + n.y * off };
  }
</script>

{#each walls as w (w.id)}
  <polygon points={svgPoints(wallPolygon(w))} class="wall" class:selected={w.id === selected?.id} />
{/each}

{#each walls as w (w.id)}
  {#if dist(w.a, w.b) * zoom > LABEL_MIN_PX}
    {@const lp = labelPos(w)}
    <text x={lp.x} y={lp.y} font-size={11 * cmPerScreenPx} class="dim" dominant-baseline="middle" text-anchor="middle">
      {formatLength(dist(w.a, w.b))}
    </text>
  {/if}
{/each}

{#if selected}
  {#each [selected.a, selected.b] as e, k (k)}
    <circle cx={e.x} cy={e.y} r={5 * cmPerScreenPx} class="handle" stroke-width={1.5 * cmPerScreenPx} />
  {/each}
{/if}

<style>
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
  .handle {
    fill: #fff;
    stroke: var(--accent);
    cursor: move;
  }
</style>
