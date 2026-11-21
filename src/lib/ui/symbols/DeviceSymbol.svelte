<script lang="ts">
  import type { DeviceKind } from '../../model/types';

  /**
   * A Toestel's symbol per AREI Boek 1, Tabel 2.23 "Grafische symbolen" (sections E and G), drawn in
   * a local frame: centred on (0, 0), SYMBOL_CM (30) across, with the wall side down (+y). The caller
   * moves and turns it with a transform. Lines use the stroke of the surrounding element.
   */
  let { kind }: { kind: DeviceKind } = $props();

  /** A switch arm from the switch circle (r = 4) outward in direction `deg` (0 = up, clockwise), with its hook. */
  function arm(deg: number): string {
    const a = (deg * Math.PI) / 180;
    const d = { x: Math.sin(a), y: -Math.cos(a) };
    // the hook is perpendicular to the arm and turns outward (away from the circle's side), as in the table
    let hook = { x: -d.y, y: d.x };
    if (Math.sign(hook.x) !== Math.sign(d.x)) hook = { x: d.y, y: -d.x };
    const s = { x: d.x * 4, y: d.y * 4 };
    const e = { x: d.x * 18, y: d.y * 18 };
    return `M ${s.x} ${s.y} L ${e.x} ${e.y} l ${hook.x * 5} ${hook.y * 5}`;
  }

  // arm directions, as in the table: single pole up-right; two-way adds down-left; intermediate all four
  const ARMS = { singlePole: [30], twoWay: [30, 210], intermediate: [30, 150, 210, 330], dimmer: [] };
</script>

{#if kind.type === 'lightPoint' && kind.mount === 'ceiling'}
  <!-- Lichtpunt: a cross -->
  <path d="M -15 -15 L 15 15 M -15 15 L 15 -15" />
{:else if kind.type === 'lightPoint'}
  <!-- Wandlichtpunt: a cross with a bar on the wall side -->
  <path d="M -10 -13 L 10 7 M -10 7 L 10 -13 M -14 13 L 14 13" />
{:else if kind.type === 'pushButton'}
  <!-- Drukknop: two concentric circles -->
  <circle r="12" />
  <circle r="5" />
{:else if kind.type === 'switch'}
  <!-- Schakelaar: a small circle with hooked arms; dimmer: an arm with a small triangle -->
  <circle r="4" />
  {#each ARMS[kind.variant] as deg (deg)}
    <path d={arm(deg)} />
  {/each}
  {#if kind.variant === 'dimmer'}
    <path d="M 2 -3.5 L 9 -15.6 M 7 -12 l 8 -4 l 0 7 z" />
  {/if}
{/if}

<style>
  path,
  circle {
    fill: none;
    vector-effect: non-scaling-stroke;
  }
</style>
