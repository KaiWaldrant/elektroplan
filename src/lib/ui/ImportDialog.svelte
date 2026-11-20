<script lang="ts">
  import { pdfCmPerPx } from '../model/geometry';
  import { store } from '../state/store.svelte';
  import { imageSize, pdfPageCount, renderPdfPage } from '../storage/pdf';

  interface Props {
    file: File;
    onclose: () => void;
  }
  let { file, onclose }: Props = $props();

  const isPdf = $derived(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
  let pages = $state(1);
  let page = $state(1);
  let scale = $state(50);
  let busy = $state(false);
  let error = $state('');
  let data: ArrayBuffer | null = null;

  $effect(() => {
    (async () => {
      try {
        data = await file.arrayBuffer();
        if (isPdf) pages = await pdfPageCount(data);
      } catch (e) {
        error = `Kan het bestand niet lezen: ${(e as Error).message}`;
      }
    })();
  });

  async function doImport(e: SubmitEvent) {
    e.preventDefault();
    if (!data) return;
    busy = true;
    error = '';
    try {
      const base = { name: file.name, offset: { x: 0, y: 0 }, opacity: 0.6, locked: false };
      if (isPdf) {
        const r = await renderPdfPage(data, page);
        await store.setBackground(r.blob, {
          ...base,
          widthPx: r.widthPx,
          heightPx: r.heightPx,
          cmPerPx: pdfCmPerPx(r.dpi, scale),
          calibrated: true,
        });
        store.tool = 'select';
      } else {
        const blob = new Blob([data], { type: file.type || 'image/png' });
        const size = await imageSize(blob);
        await store.setBackground(blob, { ...base, ...size, cmPerPx: 1, calibrated: false });
        store.tool = 'calibrate';
      }
      onclose();
    } catch (err) {
      error = `Importeren mislukt: ${(err as Error).message}`;
    } finally {
      busy = false;
    }
  }
</script>

<div class="backdrop" role="presentation" onclick={onclose}></div>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form class="dialog" onsubmit={doImport} onkeydown={(e) => e.key === 'Escape' && onclose()}>
  <h2>Plan importeren</h2>
  <p class="muted">{file.name} — wordt alleen in deze browser bewaard.</p>
  {#if isPdf}
    {#if pages > 1}
      <label>
        Pagina
        <select bind:value={page}>
          {#each Array.from({ length: pages }, (_, i) => i + 1) as n (n)}
            <option value={n}>{n}</option>
          {/each}
        </select>
      </label>
    {/if}
    <label>
      Schaal van het plan
      <span class="row">1 : <input type="number" min="1" bind:value={scale} /></span>
    </label>
    <p class="muted">De schaal staat meestal in de titel (bv. "SCHAAL 1/50"). Daarna kan je nog kalibreren met een gekende maat.</p>
  {:else}
    <p class="muted">Een afbeelding heeft geen schaal: na het importeren klik je twee punten met een gekende afstand aan (kalibreren).</p>
  {/if}
  {#if error}<p class="error">{error}</p>{/if}
  <div class="buttons">
    <button type="button" onclick={onclose}>Annuleren</button>
    <button type="submit" class="primary" disabled={busy || !!error}>{busy ? 'Bezig…' : 'Importeren'}</button>
  </div>
</form>
