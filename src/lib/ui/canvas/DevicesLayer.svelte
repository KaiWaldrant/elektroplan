<script lang="ts">
  import { SYMBOL_CM } from '../../model/devices';
  import type { Id, PlacedDevice } from '../../model/types';
  import DeviceSymbol from '../symbols/DeviceSymbol.svelte';

  /** The Toestellen placed on the shown floor, drawn with their AREI symbol. */
  let { devices, selectedId }: { devices: PlacedDevice[]; selectedId: Id | undefined } = $props();
</script>

{#each devices as d (d.id)}
  {@const { at, rotation } = d.placement}
  <g class="device" class:selected={d.id === selectedId} transform="translate({at.x} {at.y}) rotate({rotation})">
    {#if d.id === selectedId}
      <circle r={SYMBOL_CM * 0.75} class="halo" />
    {/if}
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
    fill-opacity: 0.18;
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
</style>
