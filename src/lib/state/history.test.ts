import { describe, expect, it } from 'vitest';
import { History } from './history';

describe('History', () => {
  it('gives back the previous state on undo and the newer one on redo', () => {
    const h = new History<string>();
    h.record('v1');
    // current state is now v2
    expect(h.undo('v2')).toBe('v1');
    expect(h.redo('v1')).toBe('v2');
  });
});

describe('History limits and flags', () => {
  it('has nothing to undo or redo at first', () => {
    const h = new History<string>();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.undo('v1')).toBeNull();
    expect(h.redo('v1')).toBeNull();
  });
  it('drops the redo steps when something new is recorded', () => {
    const h = new History<string>();
    h.record('v1');
    h.undo('v2');
    h.record('v1');
    expect(h.canRedo).toBe(false);
  });
  it('keeps at most `limit` undo steps, dropping the oldest', () => {
    const h = new History<string>(2);
    h.record('v1');
    h.record('v2');
    h.record('v3');
    expect(h.undo('v4')).toBe('v3');
    expect(h.undo('v3')).toBe('v2');
    expect(h.undo('v2')).toBeNull();
  });
  it('can be cleared', () => {
    const h = new History<string>();
    h.record('v1');
    h.clear();
    expect(h.canUndo).toBe(false);
  });
});
