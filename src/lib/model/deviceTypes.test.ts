import { describe, expect, it } from 'vitest';
import { DEVICE_TYPES, deviceLabel, isWallMounted, kindFromKey, kindKey, variantsOf } from './deviceTypes';

describe('DEVICE_TYPES', () => {
  it('has one entry per kind, with a unique key and a Dutch label', () => {
    const keys = DEVICE_TYPES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of DEVICE_TYPES) {
      expect(kindKey(t.kind)).toBe(t.key);
      expect(t.label).toMatch(/\S/);
    }
  });

  it('covers the 11a Toestellen', () => {
    expect(DEVICE_TYPES.map((t) => t.key)).toEqual([
      'lightPoint:ceiling',
      'lightPoint:wall',
      'pushButton',
      'switch:singlePole',
      'switch:twoWay',
      'switch:intermediate',
      'switch:dimmer',
    ]);
  });
});

describe('kindFromKey', () => {
  it('turns a key back into its kind', () => {
    expect(kindFromKey('switch:dimmer')).toEqual({ type: 'switch', variant: 'dimmer' });
  });
  it('is undefined for an unknown key', () => {
    expect(kindFromKey('toaster')).toBeUndefined();
  });
});

describe('deviceLabel', () => {
  it('names a Toestel by its kind', () => {
    expect(deviceLabel({ type: 'lightPoint', mount: 'wall' })).toBe('Wandlichtpunt');
    expect(deviceLabel({ type: 'switch', variant: 'twoWay' })).toBe('Wisselschakelaar');
  });
});

describe('isWallMounted', () => {
  it('is true for Toestellen that sit against a wall', () => {
    expect(isWallMounted({ type: 'lightPoint', mount: 'ceiling' })).toBe(false);
    expect(isWallMounted({ type: 'lightPoint', mount: 'wall' })).toBe(true);
    expect(isWallMounted({ type: 'pushButton' })).toBe(true);
    expect(isWallMounted({ type: 'switch', variant: 'intermediate' })).toBe(true);
  });
});

describe('variantsOf', () => {
  it('lists the kinds a Toestel can switch to: same glossary term, other variant', () => {
    expect(variantsOf({ type: 'switch', variant: 'dimmer' }).map((t) => t.key)).toEqual([
      'switch:singlePole',
      'switch:twoWay',
      'switch:intermediate',
      'switch:dimmer',
    ]);
    expect(variantsOf({ type: 'pushButton' }).map((t) => t.key)).toEqual(['pushButton']);
  });
});
