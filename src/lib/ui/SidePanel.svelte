<script lang="ts">
  import { dist, withLength } from '../model/geometry';
  import { store } from '../state/store.svelte';
  import NumberDialog from './NumberDialog.svelte';

  const floor = $derived(store.floor);
  const bg = $derived(floor.background);
  const wall = $derived(
    store.selection?.kind === 'wall' ? floor.walls.find((w) => w.id === store.selection?.id) : undefined,
  );
  let lengthDialog = $state(false);

  function setWallLength(len: number) {
    const id = wall?.id;
    store.mutateFloor((f) => {
      const w = f.walls.find((x) => x.id === id);
      if (!w) return;
      const oldB = { ...w.b };
      const nb = withLength(w, len).b;
      // walls connected to the moved end follow it
      for (const o of f.walls) {
        if (o === w) continue;
        if (dist(o.a, oldB) < 0.5) o.a = { ...nb };
        if (dist(o.b, oldB) < 0.5) o.b = { ...nb };
      }
      w.b = nb;
    });
    lengthDialog = false;
  }

  function num(e: Event): number | null {
    const v = Number((e.target as HTMLInputElement).value.replace(',', '.'));
    return Number.isFinite(v) ? v : null;
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
            const v = num(e);
            if (v !== null) store.mutateFloor((f) => (f.level = v));
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
    <h3>Plan (achtergrond)</h3>
    {#if bg}
      <p class="muted">{bg.name}</p>
      <p class:warn={!bg.calibrated}>
        {bg.calibrated ? 'Geschaald' : 'Nog niet gekalibreerd'} — 1 px = {bg.cmPerPx.toFixed(3).replace('.', ',')} cm
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
            const v = num(e);
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
              const v = num(e);
              const id = wall?.id;
              if (v && v > 0) store.mutateFloor((f) => { const w = f.walls.find((x) => x.id === id); if (w) w.thickness = v; });
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
    onconfirm={setWallLength}
    oncancel={() => (lengthDialog = false)}
  />
{/if}
