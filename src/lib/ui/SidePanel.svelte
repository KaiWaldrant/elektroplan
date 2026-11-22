<script lang="ts">
  import { dist } from '../model/geometry';
  import { formatDecimal, parseDecimal, parsePositiveDecimal } from '../model/numbers';
  import { selectedDevice } from '../model/devices';
  import { findWall, selectedWall, setWallLength } from '../model/walls';
  import { store } from '../state/store.svelte';
  import NumberDialog from './NumberDialog.svelte';
  import { DEVICE_DRAG_TYPE, WALL_DEVICE_DRAG_TYPE } from './canvas/deviceDrag';
  import DeviceSymbol from './symbols/DeviceSymbol.svelte';
  import { DEVICE_TYPES, deviceLabel, isWallMounted, kindFromKey, kindKey, variantsOf } from '../model/deviceTypes';
  import {
    gangMembers,
    gangOf,
    leaveGang,
    setDeviceKindInGang,
    setGangFinish,
    setGangOrientation,
  } from '../model/gangs';
  import { haArea, renameRoom, roomOf, selectedRoom, setHaArea, toSnakeCase } from '../model/rooms';
  import type { Orientation } from '../model/types';

  const floor = $derived(store.floor);
  const bg = $derived(floor.background);
  const wall = $derived(selectedWall(floor, store.selection));
  const device = $derived(selectedDevice(store.project.devices, floor.id, store.selection));
  const room = $derived(selectedRoom(floor, store.selection));
  const deviceRoom = $derived(device ? roomOf(store.project, device) : undefined);
  const gang = $derived(device ? gangOf(store.project, device.id) : undefined);
  const gangSize = $derived(device ? gangMembers(store.project, device.id).length : 0);
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
    <h3>Project</h3>
    <label>
      Afwerking
      <input
        value={store.project.finish ?? ''}
        placeholder="bv. Niko Original wit"
        onchange={(e) => {
          const v = (e.target as HTMLInputElement).value.trim() || undefined;
          if (v !== store.project.finish)
            store.mutate((p) => {
              if (v) p.finish = v;
              else delete p.finish;
            });
        }}
      />
    </label>
  </section>

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
    <h3>Ruimtes</h3>
    {#if room}
      <label>
        Naam
        <input
          value={room.name}
          onchange={(e) => {
            const id = room?.id;
            const input = e.target as HTMLInputElement;
            if (id && input.value.trim() && input.value.trim() !== room?.name)
              store.mutateFloor((f) => renameRoom(f, id, input.value));
            input.value = room?.name ?? ''; // an emptied field shows the name again
          }}
        />
      </label>
      <label>
        Home Assistant-area
        <input
          value={room.haAreaOverride ?? ''}
          placeholder={toSnakeCase(room.name)}
          onchange={(e) => {
            const id = room?.id;
            const input = e.target as HTMLInputElement;
            if (id && toSnakeCase(input.value) !== (room?.haAreaOverride ?? toSnakeCase(room?.name ?? '')))
              store.mutateFloor((f) => setHaArea(f, id, input.value));
            input.value = room?.haAreaOverride ?? '';
          }}
        />
      </label>
      <p class="muted">Leeg = de naam in snake_case.</p>
      <button class="danger" onclick={() => store.removeSelection()}>Ruimte verwijderen <kbd>Del</kbd></button>
    {/if}
    {#if floor.rooms.length}
      <ul class="rooms">
        {#each floor.rooms as r (r.id)}
          <li class:active={r.id === room?.id}>
            <button class="link" onclick={() => (store.selection = { kind: 'room', id: r.id })}>{r.name}</button>
            <span class="muted">{haArea(r)}</span>
          </li>
        {/each}
      </ul>
    {/if}
    <p class="muted">Teken een ruimte met het gereedschap Ruimte (U); toestellen erin krijgen die ruimte.</p>
  </section>

  <section>
    <h3>Toestellen</h3>
    {#if device}
      {@const variants = variantsOf(device)}
      <p>Geselecteerd: <strong>{deviceLabel(device)}</strong></p>
      <p>Ruimte: {#if deviceRoom}<strong>{deviceRoom.name}</strong>{:else}<span class="muted">geen</span>{/if}</p>
      {#if variants.length > 1}
        <label>
          Soort
          <select
            value={kindKey(device)}
            onchange={(e) => {
              const kind = kindFromKey((e.target as HTMLSelectElement).value);
              const id = device?.id;
              if (kind && id) store.mutate((p) => setDeviceKindInGang(p, floor.walls, id, kind));
            }}
          >
            {#each variants as v (v.key)}<option value={v.key}>{v.label}</option>{/each}
          </select>
        </label>
      {/if}
      <p class="muted">R draait het toestel{gangSize > 1 ? ' met zijn combinatie' : ''} een kwartslag.</p>
      <button class="danger" onclick={() => store.removeSelection()}>Toestel verwijderen <kbd>Del</kbd></button>
      {#if isWallMounted(device)}
        <h4>Combinatie</h4>
        {#if gangSize > 1}
          <p>{gangSize} toestellen onder één afdekplaat.</p>
          <div class="row" role="radiogroup" aria-label="Richting">
            {#each [['horizontal', 'Horizontaal'], ['vertical', 'Verticaal']] as const as [o, label] (o)}
              <label class="inline">
                <input
                  type="radio"
                  name="orientation"
                  checked={gang?.orientation === o}
                  onchange={() => {
                    const id = device?.id;
                    if (id) store.mutate((p) => setGangOrientation(p, id, o as Orientation));
                  }}
                />
                {label}
              </label>
            {/each}
          </div>
          <button
            onclick={() => {
              const id = device?.id;
              if (id) store.mutate((p) => leaveGang(p, id));
            }}
          >
            Uit combinatie halen
          </button>
        {:else}
          <p class="muted">Sleep een ander wandtoestel op dit toestel om een combinatie te maken.</p>
        {/if}
        <label>
          Afwerking
          <input
            value={gang?.finish ?? ''}
            placeholder={store.project.finish ? `${store.project.finish} (project)` : 'Projectafwerking'}
            onchange={(e) => {
              const id = device?.id;
              const v = (e.target as HTMLInputElement).value;
              if (id && (v.trim() || undefined) !== gang?.finish) store.mutate((p) => setGangFinish(p, id, v));
            }}
          />
        </label>
      {/if}
    {/if}
    <p class="muted">Sleep een toestel op het plan; aan een muur klikt het vast (Alt = los).</p>
    <div class="palette">
      {#each DEVICE_TYPES as t (t.key)}
        <div
          class="palette-item"
          draggable="true"
          role="button"
          tabindex="-1"
          title={t.label}
          ondragstart={(e) => {
            e.dataTransfer?.setData(DEVICE_DRAG_TYPE, t.key);
            if (isWallMounted(t.kind)) e.dataTransfer?.setData(WALL_DEVICE_DRAG_TYPE, '1');
            if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
          }}
        >
          <svg viewBox="-27 -27 54 54" width="24" height="24" aria-hidden="true">
            <DeviceSymbol kind={t.kind} />
          </svg>
          {t.label}
        </div>
      {/each}
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
  label.inline {
    flex-direction: row;
    align-items: center;
  }
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
  .palette {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .palette-item svg {
    stroke: currentColor;
    stroke-width: 1.5;
  }
</style>
