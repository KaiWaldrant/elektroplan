<script lang="ts">
  import { SYMBOL_CM } from '../../model/devices';
  import type { Point } from '../../model/types';

  /** Lichtpunt per AREI Boek 1 table 2.23: a cross, SYMBOL_CM across, centred on `at` (world cm). */
  let { at }: { at: Point } = $props();
  const r = SYMBOL_CM / 2;
</script>

<line x1={at.x - r} y1={at.y - r} x2={at.x + r} y2={at.y + r} />
<line x1={at.x - r} y1={at.y + r} x2={at.x + r} y2={at.y - r} />
