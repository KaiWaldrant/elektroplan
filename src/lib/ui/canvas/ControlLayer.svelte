<script lang="ts">
  import { symbolReach } from '../../model/devices';
  import type { PlacedDevice } from '../../model/types';

  /**
   * The selected Bediening on the shown floor: a halo on each of its Toestellen and a dashed line from
   * every Drukknop or Schakelaar to every Lichtpunt. Drawn under the symbols.
   */
  let { lights, controllers, zoom }: { lights: PlacedDevice[]; controllers: PlacedDevice[]; zoom: number } = $props();

  const cmPerScreenPx = $derived(1 / zoom);
</script>

{#each [...lights, ...controllers] as d (d.id)}
  <circle cx={d.placement.at.x} cy={d.placement.at.y} r={symbolReach(d) + 7.5} class="halo" />
{/each}
{#each controllers as c (c.id)}
  {#each lights as l (l.id)}
    <line
      x1={c.placement.at.x}
      y1={c.placement.at.y}
      x2={l.placement.at.x}
      y2={l.placement.at.y}
      class="link"
      stroke-width={1.5 * cmPerScreenPx}
      stroke-dasharray="{6 * cmPerScreenPx} {4 * cmPerScreenPx}"
    />
  {/each}
{/each}

<style>
  .halo {
    fill: var(--control);
    fill-opacity: 0.18;
    stroke: var(--control);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  .link {
    stroke: var(--control);
  }
</style>
