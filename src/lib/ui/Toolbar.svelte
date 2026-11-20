<script lang="ts">
  import { store, type Tool } from '../state/store.svelte';

  interface Props {
    onimport: (file: File) => void;
  }
  let { onimport }: Props = $props();

  let planInput: HTMLInputElement;
  let projectInput: HTMLInputElement;
  let error = $state('');

  const tools: { id: Tool; label: string; key: string }[] = [
    { id: 'select', label: 'Selecteren', key: 'V' },
    { id: 'wall', label: 'Muur', key: 'W' },
    { id: 'measure', label: 'Meten', key: 'M' },
    { id: 'calibrate', label: 'Kalibreren', key: 'C' },
  ];

  async function save() {
    const blob = await store.exportFile();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${store.project.name.replace(/[^\w\- ]+/g, '').trim() || 'project'}.elektroplan.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function open(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!file) return;
    try {
      error = '';
      await store.importFile(await file.text());
    } catch (err) {
      error = (err as Error).message;
    }
  }

  function pickPlan(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (file) onimport(file);
  }

  async function newProject() {
    if (confirm('Nieuw project starten? Het huidige project blijft bewaard zolang je het opslaat als bestand.')) {
      await store.newProject();
    }
  }
</script>

<header class="toolbar">
  <input class="project-name" bind:value={store.project.name} aria-label="Projectnaam" />

  <div class="group">
    <button onclick={newProject}>Nieuw</button>
    <button onclick={() => projectInput.click()}>Openen…</button>
    <button onclick={save}>Opslaan als bestand</button>
  </div>

  <div class="group">
    <button onclick={() => store.undo()} disabled={!store.canUndo} title="Ongedaan maken (Ctrl+Z)">↶</button>
    <button onclick={() => store.redo()} disabled={!store.canRedo} title="Opnieuw (Ctrl+Shift+Z)">↷</button>
  </div>

  <div class="group tools" role="radiogroup" aria-label="Gereedschap">
    {#each tools as t (t.id)}
      <button
        class:active={store.tool === t.id}
        role="radio"
        aria-checked={store.tool === t.id}
        onclick={() => (store.tool = t.id)}
        title="{t.label} ({t.key})"
      >
        {t.label} <kbd>{t.key}</kbd>
      </button>
    {/each}
  </div>

  <div class="group">
    <button onclick={() => planInput.click()}>Plan importeren…</button>
    <button onclick={() => store.fitRequest++} title="Passend maken (F)">Passend <kbd>F</kbd></button>
  </div>

  <span class="save-state {store.saveState}">
    {store.saveState === 'saved' ? 'Lokaal bewaard' : store.saveState === 'saving' ? 'Bewaren…' : 'Bewaren mislukt'}
  </span>
  {#if error}<span class="error">{error}</span>{/if}

  <input bind:this={planInput} type="file" accept=".pdf,image/png,image/jpeg,image/webp" hidden onchange={pickPlan} />
  <input bind:this={projectInput} type="file" accept=".json,application/json" hidden onchange={open} />
</header>
