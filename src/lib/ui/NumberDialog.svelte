<script lang="ts">
  import { parsePositiveDecimal } from '../model/numbers';
  import Dialog from './Dialog.svelte';

  interface Props {
    title: string;
    label: string;
    /** Extra explanation under the input, if any. */
    note?: string;
    value?: number;
    onconfirm: (value: number) => void;
    oncancel: () => void;
  }
  let { title, label, note = undefined, value = undefined, onconfirm, oncancel }: Props = $props();
  // svelte-ignore state_referenced_locally
  let text = $state(value?.toString() ?? ''); // initial value only, on purpose
  let input: HTMLInputElement;
  const parsed = $derived(parsePositiveDecimal(text));

  $effect(() => {
    input?.focus();
    input?.select();
  });

  function submit() {
    if (parsed !== null) onconfirm(parsed);
  }
</script>

<Dialog {title} okDisabled={parsed === null} onsubmit={submit} {oncancel}>
  <label>
    {label}
    <span class="row">
      <input bind:this={input} bind:value={text} inputmode="decimal" />
      <span>cm</span>
    </span>
  </label>
  {#if note}<p class="muted">{note}</p>{/if}
</Dialog>
