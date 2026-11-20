<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    okLabel?: string;
    okDisabled?: boolean;
    onsubmit: () => void;
    oncancel: () => void;
    children: Snippet;
  }
  let { title, okLabel = 'OK', okDisabled = false, onsubmit, oncancel, children }: Props = $props();
</script>

<div class="backdrop" role="presentation" onclick={oncancel}></div>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  class="dialog"
  onsubmit={(e) => {
    e.preventDefault();
    if (!okDisabled) onsubmit();
  }}
  onkeydown={(e) => e.key === 'Escape' && oncancel()}
>
  <h2>{title}</h2>
  {@render children()}
  <div class="buttons">
    <button type="button" onclick={oncancel}>Annuleren</button>
    <button type="submit" class="primary" disabled={okDisabled}>{okLabel}</button>
  </div>
</form>
