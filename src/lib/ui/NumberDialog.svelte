<script lang="ts">
  interface Props {
    title: string;
    label: string;
    value?: number;
    unit?: string;
    onconfirm: (value: number) => void;
    oncancel: () => void;
  }
  let { title, label, value = undefined, unit = 'cm', onconfirm, oncancel }: Props = $props();
  // svelte-ignore state_referenced_locally
  let text = $state(value?.toString() ?? ''); // initial value only, on purpose
  let input: HTMLInputElement;
  const parsed = $derived(Number(text.replace(',', '.')));
  const valid = $derived(text.trim() !== '' && Number.isFinite(parsed) && parsed > 0);

  $effect(() => {
    input?.focus();
    input?.select();
  });

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (valid) onconfirm(parsed);
  }
</script>

<div class="backdrop" role="presentation" onclick={oncancel}></div>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form class="dialog" onsubmit={submit} onkeydown={(e) => e.key === 'Escape' && oncancel()}>
  <h2>{title}</h2>
  <label>
    {label}
    <span class="row">
      <input bind:this={input} bind:value={text} inputmode="decimal" />
      <span>{unit}</span>
    </span>
  </label>
  <div class="buttons">
    <button type="button" onclick={oncancel}>Annuleren</button>
    <button type="submit" class="primary" disabled={!valid}>OK</button>
  </div>
</form>
