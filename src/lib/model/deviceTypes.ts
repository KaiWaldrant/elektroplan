import type { DeviceKind } from './types';

/** One kind of Toestel as the user sees it: in the palette, in the side panel, as a label. */
export interface DeviceType {
  /** Stable id of the kind, e.g. 'switch:twoWay'. */
  key: string;
  label: string;
  kind: DeviceKind;
}

/** Every kind of Toestel, in palette order. The single place a Toestel kind is named (symbols: ui/symbols). */
export const DEVICE_TYPES: readonly DeviceType[] = [
  { key: 'lightPoint:ceiling', label: 'Lichtpunt', kind: { type: 'lightPoint', mount: 'ceiling' } },
  { key: 'lightPoint:wall', label: 'Wandlichtpunt', kind: { type: 'lightPoint', mount: 'wall' } },
  { key: 'pushButton', label: 'Drukknop', kind: { type: 'pushButton' } },
  { key: 'switch:singlePole', label: 'Enkelpolige schakelaar', kind: { type: 'switch', variant: 'singlePole' } },
  { key: 'switch:twoWay', label: 'Wisselschakelaar', kind: { type: 'switch', variant: 'twoWay' } },
  { key: 'switch:intermediate', label: 'Kruisschakelaar', kind: { type: 'switch', variant: 'intermediate' } },
  { key: 'switch:dimmer', label: 'Dimmer', kind: { type: 'switch', variant: 'dimmer' } },
  { key: 'socket', label: 'Contactdoos', kind: { type: 'socket' } },
  { key: 'socket:washingMachine', label: 'Contactdoos wasmachine', kind: { type: 'socket', appliance: 'washingMachine' } },
  { key: 'socket:dryer', label: 'Contactdoos droogkast', kind: { type: 'socket', appliance: 'dryer' } },
  { key: 'socket:dishwasher', label: 'Contactdoos afwasmachine', kind: { type: 'socket', appliance: 'dishwasher' } },
  { key: 'socket:oven', label: 'Contactdoos oven', kind: { type: 'socket', appliance: 'oven' } },
  { key: 'socket:hob', label: 'Contactdoos kookplaat', kind: { type: 'socket', appliance: 'hob' } },
  { key: 'dataOutlet', label: 'Datacontactdoos', kind: { type: 'dataOutlet' } },
  { key: 'fan:wall', label: 'Wandventilator', kind: { type: 'fan', mount: 'wall' } },
  { key: 'fan:ceiling', label: 'Plafondventilator', kind: { type: 'fan', mount: 'ceiling' } },
];

/** The key of a kind; works on a whole Device too, since it only reads the kind fields. */
export function kindKey(kind: DeviceKind): string {
  switch (kind.type) {
    case 'lightPoint':
      return `lightPoint:${kind.mount}`;
    case 'switch':
      return `switch:${kind.variant}`;
    case 'socket':
      return kind.appliance ? `socket:${kind.appliance}` : 'socket';
    case 'fan':
      return `fan:${kind.mount}`;
    case 'pushButton':
    case 'dataOutlet':
      return kind.type;
  }
}

export function kindFromKey(key: string): DeviceKind | undefined {
  return DEVICE_TYPES.find((t) => t.key === key)?.kind;
}

export function deviceLabel(kind: DeviceKind): string {
  const key = kindKey(kind);
  return DEVICE_TYPES.find((t) => t.key === key)?.label ?? key;
}

/** Toestellen that sit against a wall (all but ceiling ones): they snap to walls and turn to face them. */
export function isWallMounted(kind: DeviceKind): boolean {
  return !('mount' in kind) || kind.mount === 'wall';
}

/** The kinds with the same glossary term (type), to switch a Toestel's variant. */
export function variantsOf(kind: DeviceKind): DeviceType[] {
  return DEVICE_TYPES.filter((t) => t.kind.type === kind.type);
}
