<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from './lib/state/store.svelte';
  import { toolForKey } from './lib/state/tools';
  import Canvas from './lib/ui/Canvas.svelte';
  import ImportDialog from './lib/ui/ImportDialog.svelte';
  import SidePanel from './lib/ui/SidePanel.svelte';
  import Toolbar from './lib/ui/Toolbar.svelte';

  let importFile = $state<File | null>(null);

  onMount(() => {
    store.loadLast().then(() => store.fitRequest++);
  });

  function onkeydown(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, .dialog')) return;
    const k = e.key.toLowerCase();
    const tool = toolForKey(k);
    if ((e.ctrlKey || e.metaKey) && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) store.redo();
      else store.undo();
    } else if ((e.ctrlKey || e.metaKey) && k === 'y') {
      e.preventDefault();
      store.redo();
    } else if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    } else if (tool) store.tool = tool;
    else if (k === 'f') store.fitRequest++;
    else if ((k === 'delete' || k === 'backspace') && store.selection) {
      e.preventDefault();
      store.removeSelection();
    }
  }

  const formatCm = (v: number) => Math.round(v).toString();
</script>

<svelte:window {onkeydown} />

<div class="app">
  <Toolbar onimport={(f) => (importFile = f)} />
  <SidePanel />
  <Canvas />
  <footer class="status">
    <span>{store.floor.name}</span>
    <span>{store.cursor ? `x ${formatCm(store.cursor.x)} cm · y ${formatCm(store.cursor.y)} cm` : ''}</span>
    <span class="hint">{store.hint}</span>
  </footer>
</div>

{#if importFile}
  <ImportDialog file={importFile} onclose={() => (importFile = null)} />
{/if}
