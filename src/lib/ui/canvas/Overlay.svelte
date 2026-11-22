<script lang="ts">
  import { dist, formatLength } from '../../model/geometry';
  import { PickTool } from './tools/pickTool.svelte';
  import { RoomTool } from './tools/roomTool.svelte';
  import type { CanvasTool } from './tools/tool';
  import { WallTool } from './tools/wallTool.svelte';

  /** What the active tool draws on top: the wall being drawn, picked points and the snap marker. */
  let { tool, zoom, wallThickness }: { tool: CanvasTool; zoom: number; wallThickness: number } = $props();

  const cmPerScreenPx = $derived(1 / zoom);
</script>

{#if tool instanceof WallTool && tool.chainStart && tool.preview}
  {@const start = tool.chainStart}
  {@const end = tool.preview}
  <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} class="preview" stroke-width={wallThickness} />
  <text x={end.x + 10 * cmPerScreenPx} y={end.y - 10 * cmPerScreenPx} font-size={12 * cmPerScreenPx} class="live">
    {tool.lengthInput ? `${tool.lengthInput} cm ⏎` : formatLength(dist(start, end))}
  </text>
{/if}

{#if tool instanceof RoomTool && tool.corners.length > 0}
  {@const line = tool.preview ? [...tool.corners, tool.preview] : tool.corners}
  <polyline points={line.map((p) => `${p.x},${p.y}`).join(' ')} class="outline" stroke-width={1.5 * cmPerScreenPx} />
  {#each tool.corners as p, k (k)}
    <circle cx={p.x} cy={p.y} r={(k === 0 && tool.closing ? 7 : 4) * cmPerScreenPx} class="pick" />
  {/each}
{/if}

{#if tool instanceof PickTool && tool.picks.length > 0}
  {@const start = tool.picks[0]}
  {@const end = tool.picks[1] ?? tool.preview}
  {#each tool.picks as p, k (k)}
    <circle cx={p.x} cy={p.y} r={4 * cmPerScreenPx} class="pick" />
  {/each}
  {#if end}
    <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} class="measure" stroke-width={1.5 * cmPerScreenPx} />
    <text
      x={(start.x + end.x) / 2 + 8 * cmPerScreenPx}
      y={(start.y + end.y) / 2 - 8 * cmPerScreenPx}
      font-size={12 * cmPerScreenPx}
      class="live"
    >
      {formatLength(dist(start, end))}
    </text>
  {/if}
{/if}

{#if tool.snapMark}
  {@const m = tool.snapMark}
  <rect
    x={m.x - 5 * cmPerScreenPx}
    y={m.y - 5 * cmPerScreenPx}
    width={10 * cmPerScreenPx}
    height={10 * cmPerScreenPx}
    class="snap"
    stroke-width={1.5 * cmPerScreenPx}
  />
{/if}

<style>
  .live {
    fill: var(--accent);
    font-family: var(--font);
    font-weight: 600;
  }
  .preview {
    stroke: var(--accent);
    stroke-opacity: 0.45;
  }
  .measure {
    stroke: var(--accent);
    stroke-dasharray: 4 3;
  }
  .outline {
    fill: var(--room);
    fill-opacity: 0.1;
    stroke: var(--accent);
  }
  .pick {
    fill: var(--accent);
  }
  .snap {
    fill: none;
    stroke: var(--snap);
  }
</style>
