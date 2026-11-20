import { describe, expect, it } from 'vitest';
import { createProject } from './project';

describe('createProject', () => {
  it('starts with one ground floor', () => {
    const p = createProject();
    expect(p.floors).toHaveLength(1);
    expect(p.floors[0].level).toBe(0);
  });
});
