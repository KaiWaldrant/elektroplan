import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Autosave } from './autosave.svelte';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Autosave', () => {
  it('is saved at first', () => {
    const a = new Autosave(() => 'v', async () => {});
    expect(a.state).toBe('saved');
  });

  it('saves the value read at save time, after the delay', async () => {
    let value = 'v1';
    const save = vi.fn(async (_: string) => {});
    const a = new Autosave(() => value, save, 400);
    a.schedule();
    expect(a.state).toBe('saving');
    value = 'v2';
    await vi.advanceTimersByTimeAsync(399);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledExactlyOnceWith('v2');
    expect(a.state).toBe('saved');
  });

  it('saves once for a burst of changes, counting the delay from the last one', async () => {
    const save = vi.fn(async (_: string) => {});
    const a = new Autosave(() => 'v', save, 400);
    a.schedule();
    await vi.advanceTimersByTimeAsync(300);
    a.schedule();
    await vi.advanceTimersByTimeAsync(300);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledOnce();
  });

  it('reports an error when saving fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = new Autosave(
      () => 'v',
      async () => {
        throw new Error('disk full');
      },
    );
    a.schedule();
    await vi.runAllTimersAsync();
    expect(a.state).toBe('error');
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
