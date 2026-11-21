<script lang="ts">
  import type { DeviceKind, SwitchVariant } from '../../model/types';

  /**
   * A Toestel's symbol per AREI Boek 1, Tabel 2.23 "Grafische symbolen" (sections E and G), drawn in
   * a local frame: centred on (0, 0), SYMBOL_CM (30) across, with the wall side down (+y). The caller
   * moves and turns it with a transform. Lines use the stroke of the surrounding element, dots its
   * colour. A dedicated Contactdoos draws its appliance in front of it, reaching to y = -25.
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
  const ARMS: Record<SwitchVariant, number[]> = {
    singlePole: [30],
    twoWay: [30, 210],
    intermediate: [30, 150, 210, 330],
    dimmer: [],
  };
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
{:else if kind.type === 'socket'}
  <!-- Contactdoos with earth and child protection: leg along the wall, stem, cup to the room,
       earth bar across the stem, feet on the cup -->
  <path d="M -14 15 L 0 15 L 0 7 M -8 10 L 8 10 M -13 -2 L -9 -2 A 9 9 0 0 0 9 -2 L 13 -2" />
  {#if kind.appliance}
    <!-- the Gebruikstoestel in front of it (section G): a square with its pictogram -->
    <rect x="-10" y="-25" width="20" height="20" />
    {#if kind.appliance === 'washingMachine'}
      <circle cy="-15" r="7" />
      <circle class="dot" cy="-15" r="2.5" />
    {:else if kind.appliance === 'dryer'}
      <circle cx="-3" cy="-19" r="3" />
      <circle cx="3" cy="-19" r="3" />
      <circle class="dot" cy="-10.5" r="2.5" />
    {:else if kind.appliance === 'dishwasher'}
      <circle cy="-15" r="4" />
      <path d="M -10 -25 L -2.8 -17.8 M 10 -25 L 2.8 -17.8 M -10 -5 L -2.8 -12.2 M 10 -5 L 2.8 -12.2" />
    {:else if kind.appliance === 'oven'}
      <path d="M -10 -21 L 10 -21" />
      <circle class="dot" cy="-12.5" r="2.5" />
    {:else if kind.appliance === 'hob'}
      <circle class="dot" cx="-4.5" cy="-19.5" r="2.5" />
      <circle class="dot" cx="4.5" cy="-19.5" r="2.5" />
      <circle class="dot" cx="4.5" cy="-10.5" r="2.5" />
    {/if}
  {/if}
{:else if kind.type === 'dataOutlet'}
  <!-- Datacontactdoos: a lead from the wall to a bar with its ends turned to the room -->
  <path d="M 0 15 L 0 2 M -8 -6 L -8 2 L 8 2 L 8 -6" />
{:else if kind.type === 'fan'}
  <!-- Ventilator: a square with two touching circles; on a wall with its lead to the wall -->
  {@const cy = kind.mount === 'wall' ? -5 : 0}
  {#if kind.mount === 'wall'}
    <path d="M 0 15 L 0 5" />
  {/if}
  <rect x="-10" y={cy - 10} width="20" height="20" />
  <circle cx="-4" {cy} r="4" />
  <circle cx="4" {cy} r="4" />
{/if}

<style>
  path,
  circle,
  rect {
    fill: none;
    vector-effect: non-scaling-stroke;
  }
  .dot {
    fill: currentColor;
    stroke: none;
  }
</style>
