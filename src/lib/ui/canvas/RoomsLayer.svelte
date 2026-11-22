<script lang="ts">
  import type { Point, Room } from '../../model/types';

  /** The Ruimtes of the shown floor: a light fill with the name, and the corner handles of the selected one. */
  let { rooms, selected, zoom }: { rooms: Room[]; selected: Room | undefined; zoom: number } = $props();

  const cmPerScreenPx = $derived(1 / zoom);
  const svgPoints = (poly: Point[]) => poly.map((p) => `${p.x},${p.y}`).join(' ');
  /** Middle of the outline's bounding box, for the name. */
  function middle(poly: Point[]): Point {
    const xs = poly.map((p) => p.x);
    const ys = poly.map((p) => p.y);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  }
</script>

{#each rooms as r (r.id)}
  <polygon points={svgPoints(r.polygon)} class="room" class:selected={r.id === selected?.id} />
{/each}

{#each rooms as r (r.id)}
  {@const m = middle(r.polygon)}
  <text x={m.x} y={m.y} font-size={13 * cmPerScreenPx} class="name" dominant-baseline="middle" text-anchor="middle">
    {r.name}
  </text>
{/each}

{#if selected}
  {#each selected.polygon as c, k (k)}
    <circle cx={c.x} cy={c.y} r={5 * cmPerScreenPx} class="handle" stroke-width={1.5 * cmPerScreenPx} />
  {/each}
{/if}

<style>
  .room {
    fill: var(--room);
    fill-opacity: 0.12;
    stroke: var(--room);
    stroke-width: 1;
    stroke-dasharray: 6 4;
    vector-effect: non-scaling-stroke;
  }
  .room.selected {
    fill: var(--accent);
    fill-opacity: 0.16;
    stroke: var(--accent);
    stroke-width: 2;
  }
  .name {
    fill: var(--room);
    font-family: var(--font);
    font-weight: 600;
    pointer-events: none;
  }
  .handle {
    fill: #fff;
    stroke: var(--accent);
    cursor: move;
  }
</style>
