import { describe, expect, it } from 'vitest';
import { toolForKey } from './tools';

describe('toolForKey', () => {
  it('finds a tool by its shortcut, in either case', () => {
    expect(toolForKey('w')).toBe('wall');
    expect(toolForKey('V')).toBe('select');
    expect(toolForKey('x')).toBeUndefined();
  });
});
