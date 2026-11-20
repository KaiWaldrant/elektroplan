<script lang="ts">
  import { SYMBOL_CM } from '../../model/devices';
  import type { Device, Id } from '../../model/types';
  import LightPointSymbol from '../symbols/LightPointSymbol.svelte';

  /** The Toestellen placed on the shown floor, drawn with their AREI symbol. */
  let { devices, selectedId }: { devices: Device[]; selectedId: Id | undefined } = $props();
</script>

{#each devices as d (d.id)}
  {#if d.placement}
    <g class="device" class:selected={d.id === selectedId}>
      {#if d.id === selectedId}
        <circle cx={d.placement.at.x} cy={d.placement.at.y} r={SYMBOL_CM * 0.75} class="halo" />
      {/if}
      <LightPointSymbol at={d.placement.at} />
    </g>
  {/if}
{/each}

<style>
  .device {
    stroke: var(--dim);
    stroke-width: 2;
    stroke-linecap: round;
  }
  .device :global(line) {
    vector-effect: non-scaling-stroke;
  }
  .device.selected {
    stroke: var(--accent);
    stroke-width: 3;
  }
  .halo {
    fill: var(--accent);
    fill-opacity: 0.18;
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
</style>
