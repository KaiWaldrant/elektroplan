export type SaveState = 'saved' | 'saving' | 'error';

/**
 * Debounced saving: `schedule()` after every change; the value is read and saved once
 * changes have paused for `delayMs`. `state` is reactive, so the UI can show it directly.
 */
export class Autosave<T> {
  state = $state<SaveState>('saved');
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly read: () => T,
    private readonly save: (value: T) => Promise<void>,
    private readonly delayMs = 400,
  ) {}

  schedule() {
    this.state = 'saving';
    clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      try {
        await this.save(this.read());
        this.state = 'saved';
      } catch (e) {
        console.error(e);
        this.state = 'error';
      }
    }, this.delayMs);
  }
}
