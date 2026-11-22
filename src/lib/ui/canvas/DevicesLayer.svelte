<script lang="ts">
  import { symbolReach } from '../../model/devices';
  import type { Id, PlacedDevice } from '../../model/types';
  import DeviceSymbol from '../symbols/DeviceSymbol.svelte';

  /**
   * The Toestellen placed on the shown floor, drawn with their AREI symbol. The selected Toestel's
   * Combinatie gets a halo, and so does the Combinatie a dragged Toestel would join (`targetGang`).
   */
  let {
    devices,
    selectedId,
    selectedGang,
    targetGang,
  }: { devices: PlacedDevice[]; selectedId: Id | undefined; selectedGang: Id[]; targetGang: Id[] } = $props();
</script>

<!-- halos first, so a halo never covers the symbol next to it in a Combinatie -->
{#each devices as d (d.id)}
  {#if selectedGang.includes(d.id) || targetGang.includes(d.id)}
    <circle
      cx={d.placement.at.x}
      cy={d.placement.at.y}
      r={symbolReach(d) + 7.5}
      class="halo"
      class:target={targetGang.includes(d.id)}
    />
  {/if}
{/each}
{#each devices as d (d.id)}
  {@const { at, rotation } = d.placement}
  <g class="device" class:selected={d.id === selectedId} transform="translate({at.x} {at.y}) rotate({rotation})">
    <DeviceSymbol kind={d} />
  </g>
{/each}

<style>
  .device {
    color: var(--dim);
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }
  .device.selected {
    color: var(--accent);
    stroke-width: 3;
  }
  .halo {
    fill: var(--accent);
    stroke: var(--accent);
    fill-opacity: 0.18;
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  .halo.target {
    fill-opacity: 0.32;
    stroke-dasharray: 4 3;
  }
</style>
