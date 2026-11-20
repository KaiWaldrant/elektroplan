<script lang="ts">
  import { backgroundExtent } from '../../model/geometry';
  import type { Background } from '../../model/types';
  import type { View } from './viewport';

  /** The grid (1 m, plus 10 cm when zoomed in) and the plan image under the walls. */
  let {
    view,
    worldWidth,
    worldHeight,
    background,
    imageUrl,
  }: {
    view: View;
    /** Visible width and height in world cm. */
    worldWidth: number;
    worldHeight: number;
    background: Background | undefined;
    imageUrl: string | undefined;
  } = $props();

  const cmPerScreenPx = $derived(1 / view.zoom);
  const extent = $derived(background ? backgroundExtent(background) : null);
</script>

<defs>
  <pattern id="grid-10" width="10" height="10" patternUnits="userSpaceOnUse">
    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="var(--grid)" stroke-width={cmPerScreenPx * 0.6} />
  </pattern>
  <pattern id="grid-100" width="100" height="100" patternUnits="userSpaceOnUse">
    {#if view.zoom > 1.5}<rect width="100" height="100" fill="url(#grid-10)" />{/if}
    <path d="M 100 0 L 0 0 0 100" fill="none" stroke="var(--grid-strong)" stroke-width={cmPerScreenPx} />
  </pattern>
</defs>
<rect x={view.x} y={view.y} width={worldWidth} height={worldHeight} fill="url(#grid-100)" />

{#if background && imageUrl}
  <image
    href={imageUrl}
    x={background.offset.x}
    y={background.offset.y}
    width={extent?.width}
    height={extent?.height}
    opacity={background.opacity}
    preserveAspectRatio="none"
    pointer-events="none"
  />
{/if}
