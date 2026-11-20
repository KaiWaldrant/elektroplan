import { describe, expect, it } from 'vitest';
import { formatDecimal, parseDecimal, parsePositiveDecimal } from './numbers';

describe('parseDecimal', () => {
  it('reads a Belgian comma decimal', () => {
    expect(parseDecimal('3,5')).toBe(3.5);
  });
  it('also reads a point decimal and surrounding spaces', () => {
    expect(parseDecimal('3.5')).toBe(3.5);
    expect(parseDecimal(' 3,5 ')).toBe(3.5);
  });
  it('returns null for empty or non-numeric text', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('  ')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
  });
});

describe('formatDecimal', () => {
  it('writes a fixed number of decimals with a comma', () => {
    expect(formatDecimal(1.5, 2)).toBe('1,50');
    expect(formatDecimal(3.68, 2)).toBe('3,68');
  });
});

describe('parsePositiveDecimal', () => {
  it('accepts numbers above zero only', () => {
    expect(parsePositiveDecimal('2,5')).toBe(2.5);
    expect(parsePositiveDecimal('0')).toBeNull();
    expect(parsePositiveDecimal('-3')).toBeNull();
    expect(parsePositiveDecimal('')).toBeNull();
  });
});
