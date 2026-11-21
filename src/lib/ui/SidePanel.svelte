<script lang="ts">
  import { dist } from '../model/geometry';
  import { formatDecimal, parseDecimal, parsePositiveDecimal } from '../model/numbers';
  import { selectedDevice } from '../model/devices';
  import { findWall, selectedWall, setWallLength } from '../model/walls';
  import { store } from '../state/store.svelte';
  import NumberDialog from './NumberDialog.svelte';
  import { DEVICE_DRAG_TYPE } from './canvas/deviceDrag';
  import LightPointSymbol from './symbols/LightPointSymbol.svelte';

  const floor = $derived(store.floor);
  const bg = $derived(floor.background);
  const wall = $derived(selectedWall(floor, store.selection));
  const device = $derived(selectedDevice(store.project.devices, floor.id, store.selection));
  let lengthDialog = $state(false);

  function confirmWallLength(len: number) {
    const id = wall?.id;
    if (id) store.mutateFloor((f) => setWallLength(f.walls, id, len));
    lengthDialog = false;
  }

  function inputNumber(e: Event): number | null {
    return parseDecimal((e.target as HTMLInputElement).value);
  }
</script>

<aside class="side">
  <section>
    <h3>Verdiepingen</h3>
    <ul class="floors">
      {#each store.project.floors as f (f.id)}
        <li class:active={f.id === floor.id}>
          <button class="link" onclick={() => store.selectFloor(f.id)}>{f.name}</button>
          <span class="muted">{f.walls.length} muren</span>
        </li>
      {/each}
    </ul>
    <button onclick={() => store.addFloor()}>+ Verdieping</button>
  </section>

  <section>
    <h3>Deze verdieping</h3>
    <label>
      Naam
      <input
        value={floor.name}
        onchange={(e) => store.mutateFloor((f) => (f.name = (e.target as HTMLInputElement).value))}
      />
    </label>
    <label>
      Vloerpeil t.o.v. gelijkvloers
      <span class="row">
        <input
          type="number"
          value={floor.level}
          onchange={(e) => {
            const input = e.target as HTMLInputElement;
            const v = input.value.trim() === '' ? 0 : parseDecimal(input.value); // an emptied field means ground level
            if (v !== null && v !== floor.level) store.mutateFloor((f) => (f.level = v));
            input.value = String(floor.level); // also when nothing changed, so the field never stays empty or invalid
          }}
        />
        cm
      </span>
    </label>
    {#if store.project.floors.length > 1}
      <button
        class="danger"
        onclick={() => confirm(`Verdieping "${floor.name}" verwijderen?`) && store.removeFloor(floor.id)}
      >
        Verdieping verwijderen
      </button>
    {/if}
  </section>

  <section>
    <h3>Toestellen</h3>
    {#if device}
      <p>Geselecteerd: <strong>Lichtpunt</strong></p>
      <button class="danger" onclick={() => store.removeSelection()}>Toestel verwijderen <kbd>Del</kbd></button>
    {/if}
    <p class="muted">Sleep een Toestel op het plan.</p>
    <div
      class="palette-item"
      draggable="true"
      role="button"
      tabindex="-1"
      ondragstart={(e) => {
        e.dataTransfer?.setData(DEVICE_DRAG_TYPE, 'lightPoint');
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
      }}
    >
      <svg viewBox="-20 -20 40 40" width="20" height="20" aria-hidden="true">
        <LightPointSymbol at={{ x: 0, y: 0 }} />
      </svg>
      Lichtpunt
    </div>
  </section>

  <section>
    <h3>Plan (achtergrond)</h3>
    {#if bg}
      <p class="muted">{bg.name}</p>
      <p class:warn={!bg.calibrated}>
        {bg.calibrated ? 'Geschaald' : 'Nog niet gekalibreerd'} — 1 px = {formatDecimal(bg.cmPerPx, 3)} cm
      </p>
      <label>
        Doorzichtigheid
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          value={bg.opacity}
          onpointerdown={() => store.checkpoint()}
          oninput={(e) => {
            const v = inputNumber(e);
            if (v !== null) store.applyFloor((f) => f.background && (f.background.opacity = v));
          }}
        />
      </label>
      <div class="row">
        <button onclick={() => (store.tool = 'calibrate')}>Kalibreren</button>
        <button
          class="danger"
          onclick={() => confirm('Achtergrondplan verwijderen?') && store.mutateFloor((f) => delete f.background)}
        >
          Verwijderen
        </button>
      </div>
    {:else}
      <p class="muted">Nog geen plan. Gebruik "Plan importeren…" (PDF of afbeelding).</p>
    {/if}
  </section>

  <section>
    <h3>{wall ? 'Geselecteerde muur' : 'Nieuwe muren'}</h3>
    {#if wall}
      <p>
        Lengte: <strong>{Math.round(dist(wall.a, wall.b))} cm</strong>
        <button class="link" onclick={() => (lengthDialog = true)}>wijzigen</button>
      </p>
      <label>
        Dikte
        <span class="row">
          <input
            type="number"
            min="1"
            value={wall.thickness}
            onchange={(e) => {
              const v = parsePositiveDecimal((e.target as HTMLInputElement).value);
              const id = wall?.id;
              if (v !== null && id)
                store.mutateFloor((f) => {
                  const w = findWall(f.walls, id);
                  if (w) w.thickness = v;
                });
            }}
          />
          cm
        </span>
      </label>
      <button class="danger" onclick={() => store.removeSelection()}>Muur verwijderen <kbd>Del</kbd></button>
    {:else}
      <label>
        Wanddikte
        <span class="row"><input type="number" min="1" bind:value={store.wallThickness} /> cm</span>
      </label>
      <p class="muted">Tip: buitenmuren ~30 cm, binnenmuren ~10 cm.</p>
    {/if}
  </section>
</aside>

{#if lengthDialog && wall}
  <NumberDialog
    title="Muurlengte"
    label="Nieuwe lengte (beginpunt blijft staan)"
    value={Math.round(dist(wall.a, wall.b))}
    onconfirm={confirmWallLength}
    oncancel={() => (lengthDialog = false)}
  />
{/if}

<style>
  .palette-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: grab;
    user-select: none;
  }
  .palette-item svg {
    stroke: currentColor;
    stroke-width: 3;
  }
</style>
